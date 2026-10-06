"""New faceted crystal station primitives. No imported meshes or texture assets."""
import bpy,bmesh,math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from room_export import export_room
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
meshes={}
bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;meshes['block']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;b=o.modifiers.new('Crystal chamfer','BEVEL');b.width=.09;b.segments=1;bpy.ops.object.modifier_apply(modifier=b.name);meshes['cutstone']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
# Six broad readable prismatic sides, asymmetrically terminated peak.
v=[(math.cos(a*math.pi/3)*r,y,math.sin(a*math.pi/3)*r) for r,y in [(1,0),(1,.72),(.62,.90)] for a in range(6)]+[(.15,1,.08)]
f=[tuple(reversed(range(6)))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]+[(i+6,(i+1)%6+6,(i+1)%6+12,i+12) for i in range(6)]+[(i+12,(i+1)%6+12,18) for i in range(6)]
m=bpy.data.meshes.new('crystal');m.from_pydata(v,[],f);m.update();bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(m);bm.free();meshes['crystal']=m
bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=1,depth=1,rotation=(math.pi/2,0,0));o=bpy.context.object;bpy.ops.object.transform_apply(location=False,rotation=True,scale=False);meshes['plinth']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,major_radius=1,minor_radius=.07);o=bpy.context.object;meshes['ring']=o.data.copy();bpy.data.objects.remove(o,do_unlink=True)
pixels=bytearray()
for y in range(64):
 for x in range(64):
  u,v=x%32,y%32;t=x//32+2*(y//32)
  value=[223+(u//8%2)*9,204+((u//10+v//9)%3)*13,224-(12 if u%16==0 or v%16==0 else 0),232+int(12*math.sin((u+v)*.11))][t]
  pixels.extend([value,value,value,255])
export_room('crystal',meshes,pixels,__file__)
