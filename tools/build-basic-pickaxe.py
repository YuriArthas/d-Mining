"""Blender 自制基础镐：握持点为原点，独立可编辑文件和游戏 GLB。"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets-source/basic-pickaxe'
OUTPUT=ROOT/'src/game/assets/tools'
SOURCE.mkdir(parents=True,exist_ok=True);OUTPUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
image=bpy.data.images.new('PickaxePalette',width=64,height=64)
colors=[(.47,.25,.10),(.29,.39,.47),(.16,.12,.09),(.65,.73,.77)]
pixels=[]
for y in range(64):
    for x in range(64):
        region=x//16
        noise=((x*17+y*5)%11-5)*.006
        grain=(.035 if x%5==0 else 0) if region==0 else 0
        pixels.extend([max(0,min(1,c+noise-grain)) for c in colors[region]]+[1])
image.pixels=pixels;image.filepath_raw=str(SOURCE/'pickaxe-palette.png');image.file_format='PNG';image.save();image.pack()
mat=bpy.data.materials.new('PickaxeAtlas');mat.use_nodes=True
node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;node.interpolation='Closest'
bsdf=mat.node_tree.nodes.get('Principled BSDF');mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value=.73
parts=[]
def finish(obj,name,region,bevel=0):
    obj.name=name
    if bevel:
        modifier=obj.modifiers.new('CraftedEdges','BEVEL');modifier.width=bevel;modifier.segments=1
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.clear();obj.data.materials.append(mat)
    uv=obj.data.uv_layers.new(name='UVMap') if not obj.data.uv_layers else obj.data.uv_layers.active
    for poly in obj.data.polygons:
        axis=max(range(3),key=lambda a:abs(poly.normal[a]));axes=[a for a in range(3) if a!=axis]
        points=[obj.data.vertices[obj.data.loops[i].vertex_index].co for i in poly.loop_indices]
        lo=[min(p[a] for p in points) for a in axes];hi=[max(p[a] for p in points) for a in axes]
        for i,p in zip(poly.loop_indices,points):
            coords=[(p[a]-lo[j])/max(.00001,hi[j]-lo[j]) for j,a in enumerate(axes)]
            uv.data[i].uv=((region*16+1+coords[0]*13)/64,(1+coords[1]*61)/64)
    parts.append(obj)
def shaft(name,z,length,radius,region):
    bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=radius*1.04,radius2=radius*.94,depth=length,location=(0,0,z))
    finish(bpy.context.object,name,region,.006)
shaft('WoodHandle',.24,.88,.043,0)
shaft('LeatherGrip',-.005,.19,.049,2)
shaft('GripLowerBand',-.11,.035,.053,3)
shaft('HeadCollar',.615,.15,.072,1)
# 宽刃钢镐轮廓，前端收尖，后端为短凿；X 为厚度，+Y 为前。
profile=[(-.28,.56),(-.28,.67),(-.09,.745),(.12,.72),(.30,.63),(.43,.46),(.35,.49),(.20,.585),(.015,.615),(-.15,.59)]
verts=[(x,y,z) for x in [-.055,.055] for y,z in profile];n=len(profile)
faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
data=bpy.data.meshes.new('SteelHead');data.from_pydata(verts,[],faces);data.update()
head=bpy.data.objects.new('SteelHead',data);bpy.context.collection.objects.link(head)
bpy.context.view_layer.objects.active=head;head.select_set(True);finish(head,'SteelHead',1,.008)
bpy.ops.object.select_all(action='DESELECT')
for p in parts:p.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();tool=bpy.context.object;tool.name='BasicPickaxe'
bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
tip=bpy.data.objects.new('PickaxeTip',None);bpy.context.collection.objects.link(tip);tip.parent=tool;tip.location=(0,.43,.46)
tool['origin']='palm grip';tool['maker']='Blender authored, no Tripo task'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'basic-pickaxe.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUTPUT/'basic-pickaxe.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
data=(OUTPUT/'basic-pickaxe.glb').read_bytes()
report={'maker':'Blender','script':'tools/build-basic-pickaxe.py','blend':'assets-source/basic-pickaxe/basic-pickaxe.blend','glb':'src/game/assets/tools/basic-pickaxe.glb','triangles':sum(len(p.vertices)-2 for p in tool.data.polygons),'texture':[64,64],'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'grip':[0,0,0],'tip':[0,.46,-.43]}
(OUTPUT/'basic-pickaxe.manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report))
