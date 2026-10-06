"""New fungal station kit; Blender owns mesh/atlas generation, JSON owns placement.
Run: blender -b --python tools/blender/build-fungal.py
No input geometry or images from another scene.
"""
import bpy,bmesh,json,hashlib,base64,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
LAYOUT=ROOT/'src/game/content/rooms/fungal.layout.json'
DEFINITION=ROOT/'src/game/content/rooms/fungal.scene.json'
OUT=ROOT/'src/game/assets/rooms/fungal-v1.json'
SOURCE=ROOT/'assets-source/fungal-v1';SOURCE.mkdir(parents=True,exist_ok=True)
layout=json.loads(LAYOUT.read_text());scene=json.loads(DEFINITION.read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
meshes={}
def mesh(name,vertices,faces,smooth=False):
 m=bpy.data.meshes.new(name);m.from_pydata(vertices,[],faces);m.update()
 bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(m);bm.free()
 for p in m.polygons:p.use_smooth=smooth
 meshes[name]=m

def lathe(name,profile,segments=24):
 vertices=[(r*math.cos(i*2*math.pi/segments),y,r*math.sin(i*2*math.pi/segments)) for r,y in profile for i in range(segments)]
 faces=[]
 for j in range(len(profile)-1):
  for i in range(segments):
   a=j*segments+i;b=j*segments+(i+1)%segments
   faces.append((a,b,b+segments,a+segments))
 mesh(name,vertices,faces,True)

bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;meshes['block']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
lathe('cap',[(0,-.035),(.6,-.035),(.94,0),(1,.10),(.98,.22),(.86,.46),(.65,.74),(.37,.94),(0,1)],32)
lathe('stem',[(0,-.5),(.9,-.5),(.7,-.38),(.53,0),(.65,.4),(.82,.5),(0,.5)],16)
lathe('gills',[(0,.05),(.18,-.05),(.4,0),(.65,-.12),(.9,0),(1,.08),(.7,.12),(0,.12)],24)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.5);o=bpy.context.object;meshes['pebble']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
# Three broad folded fronds, not a web of tiny foliage.
vertices=[];faces=[]
for angle in [0,2.094,4.188]:
 c,s=math.cos(angle),math.sin(angle);start=len(vertices)
 for x,y,z in [(0,0,0),(-.22,.48,.3),(0,1,.6),(.22,.48,.3),(0,.5,.36)]:vertices.append((x*c+z*s,y,z*c-x*s))
 faces.extend(tuple(start+i for i in f) for f in [(0,1,4),(1,2,4),(2,3,4),(3,0,4),(4,1,0),(4,2,1),(4,3,2),(4,0,3)])
mesh('sprout',vertices,faces)
materials={}
for key,style in layout['materials'].items():
 c=style['color'].lstrip('#');m=bpy.data.materials.new(key);m.diffuse_color=(*[int(c[i:i+2],16)/255 for i in (0,2,4)],1);materials[key]=m
objects=[]
for g in layout['groups']:
 anchor=[0,0,0] if g['anchor']=='room' else scene['facilities'][g['anchor']]['at']
 base=[a+b for a,b in zip(anchor,g['offset'])]
 for p in g['instances']:
  o=bpy.data.objects.new(p['name'],meshes[p['mesh']]);bpy.context.collection.objects.link(o)
  o.location=[a+b for a,b in zip(base,p['at'])];o.scale=p['scale'];o.rotation_euler=p['rotation']
  if not o.data.materials:o.data.materials.append(materials[p['material']])
  o.material_slots[0].link='OBJECT';o.material_slots[0].material=materials[p['material']];objects.append(p)
# Quiet 32px tiles: fibre, broad stone, mottled moss/floor, soft cap patches.
S=layout['textureSize'];pixels=bytearray()
for y in range(S):
 for x in range(S):
  u,v=x%32,y%32;tile=x//32+2*(y//32)
  if tile==0:value=221-(12 if u%11==0 else 0)+(v//8%2)*5
  elif tile==1:value=205+((u//8+v//7)%3)*10-(8 if (u+v//8)%16==0 else 0)
  elif tile==2:value=210+((u//7*3+v//5)%4)*8
  else:value=229+int(10*math.sin(u*.2)*math.cos(v*.18))
  pixels.extend([value,value,value,255])
meshdata={}
for name,m in meshes.items():
 m.calc_loop_triangles();positions=[];normals=[];uv=[];indices=[]
 for t in m.loop_triangles:
  for vi in t.vertices:
   p=m.vertices[vi].co;n=m.vertices[vi].normal if m.polygons[t.polygon_index].use_smooth else t.normal
   positions.extend(round(v,5) for v in p);normals.extend(round(v,5) for v in n)
   uv.extend([round(p.x+.5,5),round(p.z+.5,5)]);indices.append(len(indices))
 meshdata[name]={'positions':positions,'normals':normals,'uv':uv,'indices':indices}
OUT.write_text(json.dumps({'id':scene['asset'],'generator':'Blender','meshes':meshdata,'texture':{'size':S,'data':base64.b64encode(pixels).decode()}},separators=(',',':'))+'\n')
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'source.blend'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
meta={'generator':'Blender','recipe':str(Path(__file__).relative_to(ROOT)),'source':str((SOURCE/'source.blend').relative_to(ROOT)),'layout':str(LAYOUT.relative_to(ROOT)),'sceneDefinition':str(DEFINITION.relative_to(ROOT)),
 'instances':len(objects),'triangles':sum(len(meshdata[p['mesh']]['indices'])//3 for p in objects),'uniqueMeshes':len(meshdata),'textureSize':S,
 'meshTriangles':{k:len(m['indices'])//3 for k,m in meshdata.items()},'assetSha256':sha(OUT),'recipeSha256':sha(Path(__file__)),'sourceSha256':sha(SOURCE/'source.blend'),'layoutSha256':sha(LAYOUT),'sceneSha256':sha(DEFINITION)}
(ROOT/'docs/art/fungal-v1/asset-record.json').write_text(json.dumps(meta,indent=2)+'\n');print(meta)
