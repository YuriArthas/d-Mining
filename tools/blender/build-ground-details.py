"""Two authored opaque grass silhouettes. Export small runtime buffers and editable source."""
import bpy,math,random,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];out=ROOT/'assets-source/quarry-v2/ground-details-blender';out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
meshes=[]
for variant,count in enumerate([6,8]):
 rng=random.Random(804+variant);verts=[];faces=[]
 for i in range(count):
  a=i*math.tau/count+rng.uniform(-.2,.2);height=rng.uniform(.33,.50);width=rng.uniform(.055,.085);cx=math.cos(a)*.055;cy=math.sin(a)*.055
  # Five-sided broad blade. Three triangles, with a small outward lean.
  for u,z,lean in [(-width,0,0),(width,0,0),(width*.7,height*.55,.055),(0,height,.12),(-width*.6,height*.55,.055)]:
   verts.append((cx+math.cos(a)*lean-math.sin(a)*u,cy+math.sin(a)*lean+math.cos(a)*u,z))
  k=len(verts)-5;faces.extend([(k,k+1,k+2),(k,k+2,k+4),(k+2,k+3,k+4)])
 mesh=bpy.data.meshes.new('wide-blade-'+str(variant));mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(mesh.name,mesh);bpy.context.collection.objects.link(obj)
 positions=[];normals=[];colors=[]
 for face in mesh.polygons:
  for vi in face.vertices:
   v=mesh.vertices[vi].co;n=face.normal;positions.extend([round(v.x,5),round(v.z,5),round(-v.y,5)]);normals.extend([round(n.x,5),round(n.z,5),round(-n.y,5)])
   shade=.55+.45*min(1,v.z/.35);colors.extend([round(shade*.88,4),round(shade,4),round(shade*.72,4)])
 meshes.append({'positions':positions,'normals':normals,'colors':colors,'triangles':len(faces)})
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'source.blend'))
runtime=ROOT/'src/game/assets/ground-details';runtime.mkdir(parents=True,exist_ok=True)
f=runtime/'grass.json';f.write_text(json.dumps(meshes,separators=(',',':')))
(out/'result.json').write_text(json.dumps({'generator':'Blender','generationId':'ground-details-blender-v1','script':'tools/blender/build-ground-details.py','source':'assets-source/quarry-v2/ground-details-blender/source.blend','triangles':[m['triangles'] for m in meshes],'runtimeSha256':hashlib.sha256(f.read_bytes()).hexdigest(),'blendSha256':hashlib.sha256((out/'source.blend').read_bytes()).hexdigest(),'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},indent=2))
print('grass triangles',[m['triangles'] for m in meshes])
