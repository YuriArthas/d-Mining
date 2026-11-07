import bpy,math,json,hashlib
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.6):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
brass=mat('traveller_brass',(.19,.12,.055),.65,.38);glass=mat('traveller_glass',(1,.71,.32),0,.3)
def cylinder(name,r,depth,z,material,vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=(0,0,z));o=bpy.context.object;o.name=name;o.data.materials.append(material);return o
cylinder('Warm frosted chamber',.20,.38,0,glass)
cylinder('Bottom rim',.25,.065,-.225,brass)
cylinder('Top rim',.25,.06,.225,brass)
bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.26,radius2=.15,depth=.14,location=(0,0,.325));bpy.context.object.name='Tapered brass roof';bpy.context.object.data.materials.append(brass)
cylinder('Roof cap',.12,.035,.412,brass)
for i in range(4):
 a=math.pi/4+i*math.pi/2;o=cylinder('Corner rail %d'%i,.018,.44,0,brass,8);o.location.x=.213*math.cos(a);o.location.y=.213*math.sin(a)
bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=6,location=(0,0,.53),rotation=(math.pi/2,0,0),major_radius=.12,minor_radius=.018);bpy.context.object.name='Carry ring';bpy.context.object.data.materials.append(brass)
source=root/'source-art/moving-lantern.blend';resource=root/'public/assets/moving-lantern.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(source));bpy.ops.export_scene.gltf(filepath=str(resource),export_format='GLB',export_apply=True,export_yup=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.update()
points=[o.matrix_world@Vector(corner) for o in bpy.context.scene.objects if o.type=='MESH' for corner in o.bound_box]
dimensions=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
record={'method':'New Blender-authored portable lantern; no reused models, no decimation','source':str(source.relative_to(root)),'script':str(Path(__file__).resolve().relative_to(root)),'resource':str(resource.relative_to(root)),'triangles':triangles,'textureSizes':[],'materials':'Untextured brass PBR and runtime emissive frosted chamber','dimensionsMeters':{'width':dimensions[0],'depth':dimensions[1],'height':dimensions[2]},'sourceSha256':sha(source),'scriptSha256':sha(Path(__file__)),'resourceSha256':sha(resource)}
(root/'artifacts/moving-lantern-asset.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
