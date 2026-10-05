"""Symmetric portal plinth: low stone steps and four theme-colour inset strips."""
import bpy,json,hashlib,math
from pathlib import Path
from array import array
ROOT=Path(__file__).resolve().parents[2]
name='portal-plinth-blender';out=ROOT/'assets-source/quarry-v2'/name;out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
im=bpy.data.images.new('stone-color-128',width=128,height=128,alpha=False);im.colorspace_settings.name='sRGB';pixels=array('f')
for y in range(128):
 for x in range(128):
  grain=.97+.015*math.sin(x*.83+y*.43)+.012*math.cos(x*.39-y*.71)
  pixels.extend((.87*grain,.89*grain,.88*grain,1))
im.pixels.foreach_set(pixels);im.filepath_raw=str(out/'color-128.png');im.file_format='PNG';im.save();bpy.data.images.remove(im);im=bpy.data.images.load(str(out/'color-128.png'));im.pack()
def material(name,color,textured=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=0;n.inputs['Roughness'].default_value=.85
 if textured:
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.links.new(tex.outputs['Color'],n.inputs['Base Color'])
 return m
stone=material('portal-stone',(.86,.88,.87),True);edge=material('portal-base',(.27,.34,.39));accent=material('portal-accent',(.3,.75,.8))
def slab(label,x,y,z,dx,dy,dz,mat,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z));o=bpy.context.object;o.name=label;o.scale=(dx,dy,dz);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  b=o.modifiers.new('crafted-edge','BEVEL');b.width=bevel;b.segments=1;bpy.ops.object.modifier_apply(modifier=b.name)
 o.data.materials.append(mat)
# Blender +X becomes the shipped +Z front after loader normalization.
slab('foundation',0,0,.045,3.9,5.1,.09,edge,.025)
slab('stone-top',0,0,.125,3.72,4.92,.07,stone,.018)
for x in [-1.72,1.72]:slab('theme-inlay',x,0,.163,.065,4.52,.006,accent)
for y in [-2.26,2.26]:slab('theme-inlay',0,y,.163,3.38,.065,.006,accent)
bpy.ops.object.select_all(action='SELECT');triangles=0
for o in bpy.context.selected_objects:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
assert triangles<=192,triangles
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'source.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'model.glb'),export_format='GLB',use_selection=True,export_yup=True)
result={'status':'success','generator':'Blender','generationId':name+'-v1','type':'authored_mesh','faceLimit':192,'triangles':triangles,'textureSize':128,'reference':'tools/blender/build-portal-plinth.py','recipeSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(name,triangles)
