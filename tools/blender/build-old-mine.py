"""Export the editable old-mine scene. blender -b --python tools/blender/build-old-mine.py
Geometry/texture algorithms live here; placement, collisions and light markers live in JSON.
"""
import bpy, json, hashlib, base64
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'src/game/assets/rooms/old-mine-v2.json'
LAYOUT=ROOT/'src/game/content/rooms/oldMine.layout.json'
DEFINITION=ROOT/'src/game/content/rooms/oldMine.scene.json'
layout=json.loads(LAYOUT.read_text());scene=json.loads(DEFINITION.read_text())
SOURCE=ROOT/'assets-source/old-mine-v2';SOURCE.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Same X/Y-up/Z coordinates as the runtime, exported directly without GLTF axis conversion.
materials={}
for key,style in layout['materials'].items():
 c=style['color'].lstrip('#')
 m=bpy.data.materials.new(key);m.diffuse_color=(*[int(c[i:i+2],16)/255 for i in (0,2,4)],1);materials[key]=m
meshes={}
# Flat architectural infill and small trim share a 12-triangle unit. Hero timbers retain their bevels.
bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;meshes['panel']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name='new-square-unit';bevel=o.modifiers.new('Crafted tiny edge','BEVEL');bevel.width=.008;bevel.segments=1;bpy.ops.object.modifier_apply(modifier=bevel.name);meshes['block']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=1,depth=1);o=bpy.context.object;meshes['drum']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,major_radius=1,minor_radius=.10);o=bpy.context.object;meshes['wheel']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)

objects=[]
for group in layout['groups']:
 anchor=[0,0,0] if group['anchor']=='room' else scene['facilities'][group['anchor']]['at']
 base=[a+b for a,b in zip(anchor,group['offset'])]
 for part in group['instances']:
  o=bpy.data.objects.new(part['name'],meshes[part['mesh']]);bpy.context.collection.objects.link(o)
  o.location=[a+b for a,b in zip(base,part['at'])];o.scale=part['scale'];o.rotation_euler=part['rotation']
  if not o.data.materials:o.data.materials.append(materials[part['material']])
  o.material_slots[0].link='OBJECT';o.material_slots[0].material=materials[part['material']]
  objects.append(part)
# New atlas: four 32px grayscale islands (wood / stone / floor / iron), no old image inputs.
S=layout['textureSize'];pixels=bytearray()
columns=scene['render']['atlas']['columns'];rows=scene['render']['atlas']['rows']
assert S%columns==0 and S%rows==0
tile_w,tile_h=S//columns,S//rows
for y in range(S):
 for x in range(S):
  u,v=x%tile_w,y%tile_h;tile=x//tile_w+columns*(y//tile_h)
  h=((u//2)*37+(v//2)*71+(u//7)*13)%17
  if tile==0:value=207+(u//8%2)*10-(15 if (u+v//16)%8==0 else 0)
  elif tile==1:value=177+(u//5+v//4)%3*16+(h%3)*4
  elif tile==2:value=180 if (u%16==0 or v%16==0) else 216+((u//16+v//16)%2)*10-(7 if h<2 else 0)
  else:value=206+(u//5+v//7)%3*7
  pixels.extend([value,value,value,255])
meshdata={}
for name,m in meshes.items():
 m.calc_loop_triangles();positions=[];normals=[];uv=[];index=[]
 # Export split face normals once per kit primitive; instancing keeps duplication tiny.
 for t in m.loop_triangles:
  for vi in t.vertices:
   p=m.vertices[vi].co;n=t.normal
   positions.extend(round(v,5) for v in p);normals.extend(round(v,5) for v in n)
   if abs(n.y)>.6:a,b=p.x,p.z
   elif abs(n.x)>.6:a,b=p.z,p.y
   else:a,b=p.x,p.y
   uv.extend([round(a+.5,5),round(b+.5,5)]);index.append(len(index))
 meshdata[name]={'positions':positions,'normals':normals,'uv':uv,'indices':index}

result={'id':scene['asset'],'generator':'Blender','meshes':meshdata,'texture':{'size':S,'data':base64.b64encode(pixels).decode()}}
OUT.write_text(json.dumps(result,separators=(',',':'))+'\n')
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'source.blend'))
tri=sum(len(meshdata[o['mesh']]['indices'])//3 for o in objects)
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
meta={'generator':'Blender','recipe':'tools/blender/build-old-mine.py','source':'assets-source/old-mine-v2/source.blend',
 'layout':str(LAYOUT.relative_to(ROOT)),'sceneDefinition':str(DEFINITION.relative_to(ROOT)),
 'instances':len(objects),'triangles':tri,'uniqueMeshes':len(meshdata),'textureSize':S,
 'assetSha256':sha(OUT),'recipeSha256':sha(Path(__file__)),'sourceSha256':sha(SOURCE/'source.blend'),
 'layoutSha256':sha(LAYOUT),'sceneSha256':sha(DEFINITION)}
(ROOT/'docs/art/old-mine-v2/asset-record.json').write_text(json.dumps(meta,indent=2)+'\n');print(meta)
