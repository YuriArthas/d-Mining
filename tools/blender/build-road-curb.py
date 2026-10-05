"""Authored modular stone curb, metre-scale mesh with baked bevels; no textures."""
import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
out=ROOT/'assets-source/quarry-v2/road-curb-blender';out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,.06))
obj=bpy.context.object;obj.name='sandstone-curb';obj.dimensions=(1,.28,.12)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bevel=obj.modifiers.new('small-chamfer','BEVEL');bevel.width=.014;bevel.segments=1
bpy.ops.object.modifier_apply(modifier=bevel.name)
tri=obj.modifiers.new('triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
positions=[];normals=[]
for face in obj.data.polygons:
 for index in face.vertices:
  v=obj.matrix_world@obj.data.vertices[index].co;n=face.normal
  positions.extend([round(v.x,6),round(v.z,6),round(-v.y,6)])
  normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)])
runtime=ROOT/'src/game/assets/ground-details/curb.json'
runtime.write_text(json.dumps({'positions':positions,'normals':normals,'triangles':len(obj.data.polygons)},separators=(',',':')))
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'source.blend'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
(out/'result.json').write_text(json.dumps({'generator':'Blender','generationId':'road-curb-blender-v1','script':str(Path(__file__).relative_to(ROOT)),'source':str((out/'source.blend').relative_to(ROOT)),'triangles':len(obj.data.polygons),'dimensions':[1,.12,.28],'textures':[],'runtimeSha256':sha(runtime),'blendSha256':sha(out/'source.blend'),'scriptSha256':sha(Path(__file__))},indent=2))
print('curb triangles',len(obj.data.polygons))
