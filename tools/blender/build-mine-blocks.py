"""Author exact 2m mine modules and 128px hand-designed color atlases in Blender.
Run: blender -b --python tools/blender/build-mine-blocks.py
No network, generated-model dependency, baked lighting or normal textures.
"""
import bpy, math, json, hashlib
from pathlib import Path
from array import array
ROOT=Path(__file__).resolve().parents[2]
SIZE=128

def rgb(hexcode):
    return tuple(int(hexcode[i:i+2],16)/255 for i in (0,2,4))

def color(kind,x,y):
    # Four 64px islands: vertical grain, end grain, cross grain, end grain.
    u,v=x%64,y%64
    end=(x//64)==1
    if kind=='timber':
        base=rgb('b9844d')
        if end:
            r=math.sqrt((u-31.5)**2+(v-31.5)**2)
            rings=(int(r/6)%2)*.035
            delta=-rings+(.018 if r<12 else 0)
        else:
            # Broad, low-contrast grain, deliberately no photoreal noise.
            offset=2*math.sin(v*.08)+math.sin(v*.19)
            stripe=(u+offset)%19
            delta=-.055 if stripe<1.7 else (.023 if stripe>15 else 0)
        return tuple(max(0,min(1,c+delta)) for c in base)
    if kind=='trim':
        base=rgb('eee1bd')
        delta=-.025 if (v%32)<2 else (.007 if (v%32)>28 else 0)
        return tuple(c+delta for c in base)
    # Blue ceramic roof block; large readable bands, no per-pixel grit.
    base=rgb('348bcc')
    row=v//32
    seam=(v%32)<2 or ((u+row*32)%64)<2
    delta=-.045 if seam else (.022 if v%32 in (2,3,4) else 0)
    return tuple(max(0,min(1,c+delta)) for c in base)

for kind in ('timber','trim','roof'):
    name=f'grid-mine-{kind}-blender'
    out=ROOT/'assets-source'/'quarry-v2'/name
    out.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    image=bpy.data.images.new(name+'-color-128',width=SIZE,height=SIZE,alpha=False)
    image.colorspace_settings.name='sRGB'
    pixels=array('f')
    # Byte-backed sRGB images store authored sRGB channel values.
    for y in range(SIZE):
        for x in range(SIZE):pixels.extend((*color(kind,x,y),1.0))
    image.pixels.foreach_set(pixels)
    image.filepath_raw=str(out/'color-128.png');image.file_format='PNG';image.save()
    # Reload to give the exporter the PNG and an explicit color-space contract.
    bpy.data.images.remove(image);image=bpy.data.images.load(str(out/'color-128.png'));image.pack()
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Metallic'].default_value=0;bsdf.inputs['Roughness'].default_value=.86
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Linear'
    mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    bpy.ops.mesh.primitive_cube_add(size=2,location=(0,0,0))
    block=bpy.context.object;block.name=name;block.data.materials.append(mat)
    uv=block.data.uv_layers.active
    for face in block.data.polygons:
        # Top and bottom use end grain. All vertical faces run grain vertically.
        top=abs(face.normal.z)>.5
        for li in face.loop_indices:
            p=block.data.vertices[block.data.loops[li].vertex_index].co
            if top:a,b=p.x,p.y
            elif abs(face.normal.x)>.5:a,b=p.y,p.z
            else:a,b=p.x,p.z
            # Inset 2px gutters protect mip filtering across unrelated islands.
            uv.data[li].uv=((64 if top else 0)+2+(a+1)*29,2+(b+1)*29)
            uv.data[li].uv/=SIZE
    bevel=block.modifiers.new('Tiny crafted edge','BEVEL');bevel.width=.009;bevel.segments=1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    # Deliberately flat large faces and tiny bevels; no weighted/baked normals.
    for face in block.data.polygons:face.use_smooth=False
    block.data.calc_loop_triangles();triangles=len(block.data.loop_triangles)
    assert triangles<=128,triangles
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'source.blend'))
    bpy.ops.export_scene.gltf(filepath=str(out/'model.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
    result={'status':'success','generator':'Blender','generationId':name+'-v1','type':'authored_mesh','faceLimit':128,'triangles':triangles,'textureSize':128,'reference':'tools/blender/build-mine-blocks.py','recipeSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    (out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
    print(name,triangles)
