"""Bake geometry-only contact AO into the existing IrradianceUV, without changing the source scene."""
import bpy, hashlib, json, time
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'source-art/district.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU'
# AO node owns 32 rays per surface point; do not multiply them by 32 path samples.
scene.cycles.samples=1;scene.cycles.use_denoising=False
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.render.bake.margin=12;scene.render.bake.use_clear=True
size=4096
atlas=bpy.data.images.new('District geometry contact AO',width=size,height=size,alpha=False,float_buffer=True)
atlas.colorspace_settings.name='Non-Color'
for material in bpy.data.materials:
    material.use_nodes=True;nodes=material.node_tree.nodes;nodes.clear();links=material.node_tree.links
    ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.42;ao.samples=32
    emission=nodes.new('ShaderNodeEmission');links.new(ao.outputs['AO'],emission.inputs['Color'])
    out=nodes.new('ShaderNodeOutputMaterial');links.new(emission.outputs[0],out.inputs['Surface'])
    target=nodes.new('ShaderNodeTexImage');target.image=atlas;nodes.active=target
bpy.ops.object.select_all(action='DESELECT');receivers=[]
for obj in scene.objects:
    if obj.type!='MESH':continue
    if obj.data.materials[0].name=='lampglass':obj.hide_render=True;continue
    obj.select_set(True);receivers.append(obj)
bpy.context.view_layer.objects.active=receivers[0];bpy.ops.object.join()
start=time.time();bpy.ops.object.bake(type='EMIT',uv_layer='IrradianceUV')
data=np.empty(size*size*4,dtype=np.float32);atlas.pixels.foreach_get(data)
data=data.reshape(size,size,4)
assert np.isfinite(data).all()
# White outside UV islands is neutral; strength is applied at runtime.
ao=np.where(data[:,:,3]>0,data[:,:,0],1)
pixels=np.rint(np.clip(np.flipud(ao),0,1)*255).astype(np.uint8)
OUT=ROOT/'artifacts/district-ao';OUT.mkdir(parents=True,exist_ok=True)
np.save(OUT/'ao.npy',pixels)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'source':'source-art/district.blend','sourceSha256':sha(source),'script':'tools/blender/bake_district_ao.py','scriptSha256':sha(Path(__file__)), 'modelSha256':sha(ROOT/'public/assets/district.glb'),'layoutSha256':sha(ROOT/'public/assets/district-layout.json'),'size':size,'distanceMetres':.42,'samples':32,'bakeSamples':1,'strength':.55,'seconds':time.time()-start,'method':'Cycles geometry-normal ambient occlusion, no material micro normal, existing IrradianceUV; runtime affects indirect lighting only','rawSha256':sha(OUT/'ao.npy')}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n');print('AO_RESULT '+json.dumps(report))
