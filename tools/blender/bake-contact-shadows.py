"""Bake short-range ground contact occlusion from selected shipped geometry."""
import bpy,json,base64,hashlib,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets-source/quarry-v2/contact-bake'
data=json.loads((OUT/'geometry.json').read_text());b=data['bounds'];size=data['size']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for item in data['objects']:
 mesh=bpy.data.meshes.new(item['name']);xyz=item['vertices'];mesh.from_pydata([xyz[i:i+3] for i in range(0,len(xyz),3)],[],item['faces']);mesh.update()
 obj=bpy.data.objects.new(item['name'],mesh);bpy.context.collection.objects.link(obj)
# The receiver is the existing meadow's flat top. Explicit UV orientation:
# image v=0 is world maxZ, u=0 is world minX.
verts=[(b['minX'],-b['maxZ'],data['floorY']),(b['maxX'],-b['maxZ'],data['floorY']),(b['maxX'],-b['minZ'],data['floorY']),(b['minX'],-b['minZ'],data['floorY'])]
mesh=bpy.data.meshes.new('ground-bake-receiver');mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update()
uv=mesh.uv_layers.new();coords=[(0,0),(1,0),(1,1),(0,1)]
for i in range(4):uv.data[i].uv=coords[i]
obj=bpy.data.objects.new('ground-bake-receiver',mesh);bpy.context.collection.objects.link(obj)
mat=bpy.data.materials.new('contact-occlusion-bake');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear()
ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=data['distance'];ao.samples=32
ao.inside=False;ao.only_local=False
emit=nodes.new('ShaderNodeEmission');output=nodes.new('ShaderNodeOutputMaterial')
mat.node_tree.links.new(ao.outputs['AO'],emit.inputs['Color']);mat.node_tree.links.new(emit.outputs[0],output.inputs['Surface'])
image=bpy.data.images.new('ground-contact-512',width=size,height=size,alpha=False,float_buffer=True);image.colorspace_settings.name='Non-Color'
tex=nodes.new('ShaderNodeTexImage');tex.image=image;nodes.active=tex;obj.data.materials.append(mat)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.bake_type='EMIT';scene.render.bake.margin=0
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.object.bake(type='EMIT')
pixels=list(image.pixels);raw=bytes(round(max(0,min(1,pixels[i*4]))*255) for i in range(size*size))
# Full scene is retained as an editable, reproducible bake source.
image.pack();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source.blend'))
image.filepath_raw=str(OUT/'contact-preview.png');image.file_format='PNG';image.save()
runtime=ROOT/'src/game/assets/ground-details/contact-shadow.json'
runtime.write_text(json.dumps({'size':size,'bounds':b,'floorY':data['floorY'],'distance':data['distance'],'data':base64.b64encode(raw).decode()},separators=(',',':')))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
result={'sourceFile':str((OUT/'source.blend').relative_to(ROOT)),'script':str(Path(__file__).relative_to(ROOT)),'geometryExporter':'tools/export-contact-bake.mjs','textureSizeBytes':len(raw),'generator':'Blender Cycles AO emit bake','version':'selected-ground-contact-v1','selectionCount':len(data['objects']),'triangles':sum(len(o['faces']) for o in data['objects']),'textureSize':[size,size],'runtimeFormat':'R8 + generated mipmaps','gpuBytesWithMipmaps':math.ceil(size*size*4/3),'nonWhitePixels':sum(v<253 for v in raw),'minimum':min(raw),'scriptSha256':sha(Path(__file__)),'geometrySha256':sha(OUT/'geometry.json'),'runtimeSha256':sha(runtime),'blendSha256':sha(OUT/'source.blend')}
(OUT/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
