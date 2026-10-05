"""Small voxel wall sconce. Authored solid geometry and vertex palette; no texture downloads."""
import bpy,json,hashlib,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
out=ROOT/'assets-source/quarry-v2/wall-torch-blender';out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts={'body':[],'amber':[],'core':[]}
def box(name,center,size,color,part='body',tilt=0):
 # Author in game axes (+Y up, +Z outward), convert to Blender Z-up.
 x,y,z=center;w,h,d=size
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y))
 o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.rotation_euler.x=tilt
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);o.data.materials.append(m)
 parts[part].append((o,color))
box('square-wall-plate',(0,0,.02),(.38,.65,.18),(.13,.16,.18))
for y in [-.23,.23]:box('square-iron-stud',(0,y,.13),(.10,.10,.07),(.36,.38,.34))
box('short-bracket',(0,-.17,.31),(.14,.14,.48),(.19,.20,.19))
box('oak-handle',(0,.09,.43),(.20,.88,.20),(.43,.24,.09),tilt=.24)
box('oak-highlight',(.105,.08,.43),(.025,.75,.16),(.58,.34,.12),tilt=.24)
box('iron-collar',(0,.42,.52),(.29,.16,.29),(.22,.24,.21))
box('charred-wick',(0,.55,.55),(.25,.19,.25),(.13,.08,.025))
box('ember-base',(0,.64,.55),(.38,.14,.36),(.95,.27,.025),'amber')
box('flame-main',(0,.88,.55),(.32,.40,.30),(1,.47,.055),'amber')
box('flame-tip',(-.06,1.14,.55),(.18,.22,.18),(1,.64,.12),'amber')
box('flame-side',(.20,.84,.55),(.13,.22,.18),(1,.37,.025),'amber')
box('hot-core',(0,.83,.724),(.17,.28,.06),(1,.94,.55),'core')
# Thin bright insets on all four sides, not a single billboard.
box('hot-core-back',(0,.83,.376),(.17,.28,.06),(1,.91,.46),'core')
box('hot-core-left',(-.179,.82,.55),(.055,.24,.15),(1,.91,.46),'core')
box('hot-core-right',(.179,.82,.55),(.055,.24,.15),(1,.91,.46),'core')
result={}
for part,objects in parts.items():
 p=[];n=[];c=[]
 for o,color in objects:
  tri=o.modifiers.new('triangles','TRIANGULATE');bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=tri.name)
  for face in o.data.polygons:
   normal=o.matrix_world.to_3x3()@face.normal
   for index in face.vertices:
    v=o.matrix_world@o.data.vertices[index].co
    p.extend(round(x,6) for x in (v.x,v.z,-v.y));n.extend(round(x,6) for x in (normal.x,normal.z,-normal.y));c.extend(color)
 result[part]={'positions':p,'normals':n,'colors':c,'triangles':len(p)//9}
runtime=ROOT/'src/game/assets/ground-details/wall-torch.json';runtime.write_text(json.dumps(result,separators=(',',':')))
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'source.blend'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
(out/'result.json').write_text(json.dumps({'generator':'Blender','generationId':'wall-torch-blender-v1','source':str((out/'source.blend').relative_to(ROOT)),'script':str(Path(__file__).relative_to(ROOT)),'triangles':sum(p['triangles'] for p in result.values()),'textures':[],'palette':'authored vertex colors, no texture allocation','runtimeSha256':sha(runtime),'blendSha256':sha(out/'source.blend'),'scriptSha256':sha(Path(__file__))},indent=2))
print('wall torch triangles',sum(p['triangles'] for p in result.values()))
