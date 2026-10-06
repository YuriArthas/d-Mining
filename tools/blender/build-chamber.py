"""Generate one new geometric theme kit, without loading any existing model.
Usage: blender -b --python tools/blender/build-chamber.py -- ruins
Scenes: ruins, frozen, volcanic, fossil, machinery, core.
Placement and visual/collision/light declarations stay in each scene's JSON.
"""
import bpy,bmesh,math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from room_export import export_room
slug=sys.argv[sys.argv.index('--')+1]
assert slug in ['ruins','frozen','volcanic','fossil','machinery','core']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
meshes={}
def take(name):
 o=bpy.context.object;meshes[name]=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
def mesh(name,v,f,smooth=False):
 m=bpy.data.meshes.new(name);m.from_pydata(v,[],f);m.update();bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(m);bm.free()
 for p in m.polygons:p.use_smooth=smooth
 meshes[name]=m
bpy.ops.mesh.primitive_cube_add(size=1);take('block')
bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;b=o.modifiers.new('Stone arris','BEVEL');b.width=.05;b.segments=1;bpy.ops.object.modifier_apply(modifier=b.name);take('stone')
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=1,depth=1,rotation=(math.pi/2,0,0));bpy.ops.object.transform_apply(location=False,rotation=True,scale=False);take('column')
if slug in ['frozen','core']:
 n=6;v=[(math.cos(a*2*math.pi/n)*r,y,math.sin(a*2*math.pi/n)*r) for r,y in [(1,0),(.7,.72)] for a in range(n)]+[(0,1,0)]
 f=[tuple(reversed(range(n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]+[(i+n,(i+1)%n+n,2*n) for i in range(n)];mesh('spire',v,f)
if slug in ['ruins','volcanic']:
 # Vault unit, smoothly curved outline with broad radial masonry faces.
 n=24;v=[]
 for z in [-.5,.5]:
  for r in [.76,1]:
   for i in range(n+1):a=i*math.pi/n;v.append((r*math.cos(a),r*math.sin(a),z))
 k=n+1;f=[]
 for i in range(n):f.extend([(i,i+1,k+i+1,k+i),(2*k+i,3*k+i,3*k+i+1,2*k+i+1),(i,2*k+i,2*k+i+1,i+1),(k+i,k+i+1,3*k+i+1,3*k+i)])
 f.extend([(0,k,3*k,2*k),(n,2*k+n,3*k+n,k+n)]);mesh('arch',v,f)
if slug in ['fossil']:
 # Deliberately simple fossil shapes, broad smooth ribs and jointed vertebrae.
 n=32;sides=8;v=[]
 for i in range(n+1):
  a=i*math.pi/n
  for j in range(sides):
   b=j*2*math.pi/sides;r=1+.085*math.cos(b);v.append((r*math.cos(a),r*math.sin(a),.085*math.sin(b)))
 f=[]
 for i in range(n):
  for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;f.append((a,b,b+sides,a+sides))
 f.extend([tuple(reversed(range(sides))),tuple(n*sides+j for j in range(sides))]);mesh('rib',v,f,True)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.5);take('joint')
if slug in ['machinery','core']:
 bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=8,major_radius=1,minor_radius=.06);o=bpy.context.object
 for p in o.data.polygons:p.use_smooth=True
 take('ring')
if slug=='machinery':
 n=48;v=[]
 for z in [-.5,.5]:
  for i in range(n):
   a=i*math.tau/n;r=1 if i%4 in [1,2] else .84;v.append((r*math.cos(a),r*math.sin(a),z))
 f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];mesh('gear',v,f)
pixels=bytearray();style=['ruins','frozen','volcanic','fossil','machinery','core'].index(slug)
for y in range(64):
 for x in range(64):
  u,v=x%32,y%32;t=x//32+2*(y//32)
  value=[217+((u//8+style)%2)*12,202+((u//7+v//9+style)%3)*13,228-(15 if u%16==0 or v%16==0 else 0),226+((u//6+v//5+style)%2)*12][t]
  pixels.extend([value,value,value,255])
export_room(slug,meshes,pixels,__file__)
