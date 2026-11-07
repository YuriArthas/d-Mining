"""Bake combined stationary-lamp diffuse radiance, preserving authored normal maps.

Run after build_district.py. The saved source scene has no imported geometry.
This bake contains lamp direct light and two-bounce indirect light only; runtime
sky, sun/moon, environment specular, emission and tone mapping remain separate.
"""
import bpy
import hashlib
import json
import math
import time
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'source-art/district.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene;scene.render.engine='CYCLES'
scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=False
scene.cycles.max_bounces=3;scene.cycles.diffuse_bounces=2;scene.cycles.glossy_bounces=0
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=0
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=False
scene.render.bake.margin=12;scene.render.bake.use_clear=True

manifest=json.loads((ROOT/'public/assets/materials/materials.json').read_text())
records={**manifest['materials'],**manifest['variants']['crafted']['materials']}
records['plaster_rose']={**records['plaster_ivory'],'tint':'#b79d89'}
for name,color,roughness in [('roof','#465968',.87),('roof_red','#84564a',.87),('canvas_red','#8b5142',.94),('canvas_cream','#c7b38a',.94),('windowglass','#8c7150',.44),('leaf_light','#81935d',.94)]:
    records[name]={'baseColor':color,'roughness':roughness,'metalness':0}

def linear_color(color):
    srgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in srgb)+(1,)

atlas=bpy.data.images.new('District lamp irradiance',width=4096,height=4096,alpha=True,float_buffer=True)
atlas.colorspace_settings.name='Non-Color'
dependencies={}
for material in bpy.data.materials:
    if material.name not in records and material.name!='lampglass':raise ValueError('Missing bake material: '+material.name)
    record=records.get(material.name,{'baseColor':'#ffe5ac','roughness':.28})
    nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=record['roughness'];shader.inputs['Metallic'].default_value=record.get('metalness',0)
    shader.inputs['Base Color'].default_value=linear_color(record['baseColor'])
    if record.get('maps'):
        coords=nodes.new('ShaderNodeUVMap');coords.uv_map='MetricUV'
        scale=nodes.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs[3].default_value=1/record['tileMetres'];links.new(coords.outputs['UV'],scale.inputs[0])
        for role in ('albedo','normal','roughness'):
            path=ROOT/'public/assets/materials'/record['maps'][role]['file']
            dependencies[str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
            tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(path),check_existing=True)
            tex.image.colorspace_settings.name='sRGB' if role=='albedo' else 'Non-Color';links.new(scale.outputs['Vector'],tex.inputs['Vector'])
            if role=='normal':
                normal=nodes.new('ShaderNodeNormalMap');normal.uv_map='MetricUV';links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
            elif role=='roughness':links.new(tex.outputs['Color'],shader.inputs['Roughness'])
            elif 'tint' in record:
                mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=linear_color(record['tint']);links.new(tex.outputs['Color'],mix.inputs[1]);links.new(mix.outputs['Color'],shader.inputs['Base Color'])
            else:links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    target=nodes.new('ShaderNodeTexImage');target.image=atlas;nodes.active=target

layout=json.loads((ROOT/'public/assets/district-layout.json').read_text())
for lamp in layout['lamps']:
    light=bpy.data.lights.new('Baked lamp '+str(lamp['id']),'POINT')
    light.energy=lamp['intensity']*4*math.pi;light.color=linear_color('#ffcb8b')[:3];light.shadow_soft_size=lamp['radius']
    obj=bpy.data.objects.new(light.name,light);scene.collection.objects.link(obj)
    x,y,z=lamp['position'];obj.location=(x,-z,y)

# Glass and its small metal cage do not block their internal source. The post,
# footing, architecture and every other solid remain full shadow casters.
bpy.ops.object.select_all(action='DESELECT')
receivers=[]
for obj in scene.objects:
    if obj.type!='MESH':continue
    if '_cage_' in obj.name or obj.data.materials[0].name=='lampglass':
        obj.hide_render=True
    else:obj.select_set(True);receivers.append(obj)
bpy.context.view_layer.objects.active=receivers[0]
bpy.ops.object.join()
receiver=bpy.context.object;receiver.name='Combined static bake receiver'
start=time.time()
bpy.ops.object.bake(type='DIFFUSE',uv_layer='IrradianceUV')
data=np.empty(4096*4096*4,dtype=np.float32);atlas.pixels.foreach_get(data)
data=data.reshape(4096,4096,4)
if not np.isfinite(data).all():raise ValueError('Non-finite lightmap')
rgb=np.maximum(data[:,:,:3],0)
maximum=float(rgb.max());scale=max(16,math.ceil(maximum/16)*16)
if maximum<.05:raise ValueError('Lamp bake is unexpectedly dark')
multiplier=np.maximum(np.ceil(np.max(rgb,axis=2)/scale*255)/255,1/255)
encoded=np.empty_like(data,dtype=np.uint8)
encoded[:,:,:3]=np.rint(np.clip(rgb/(multiplier[:,:,None]*scale),0,1)*255).astype(np.uint8)
encoded[:,:,3]=np.rint(multiplier*255).astype(np.uint8)
decoded=encoded[:,:,:3].astype(np.float32)/255*(encoded[:,:,3:4].astype(np.float32)/255)*scale
OUT=ROOT/'artifacts/district-bake';OUT.mkdir(parents=True,exist_ok=True)
# Keep the float reference once, compressed, outside the deployed assets.
np.savez_compressed(OUT/'radiance-reference.npz',rgb=rgb.astype(np.float16))
np.save(OUT/'rgbm-top-down.npy',np.flipud(encoded))
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
report={'method':'Blender Cycles combined stationary lamps, diffuse direct + indirect without albedo; runtime decodes RGBM and multiplies by PI to obtain irradiance.',
 'sourceSha256':sha(source),'modelSha256':sha(ROOT/'public/assets/district.glb'),'layoutSha256':sha(ROOT/'public/assets/district-layout.json'),
 'script':'tools/blender/bake_district.py','scriptSha256':sha(Path(__file__)),'materialManifestSha256':sha(ROOT/'public/assets/materials/materials.json'),
 'textureDependencies':dependencies,'samples':32,'diffuseBounces':2,'lampCount':len(layout['lamps']),'lampColor':'#ffcb8b','emitterRadiusMetres':.22,
 'size':4096,'encoding':'RGBM8 linear data, lossless WebP storage','range':scale,'maxRadiance':maximum,
 'meanRadiance':float(rgb.mean()),'radianceP99':float(np.percentile(rgb,99)),'maxQuantizationError':float(np.max(abs(decoded-rgb))),
 'meanQuantizationError':float(np.mean(abs(decoded-rgb))),'seconds':time.time()-start,'rawSha256':sha(OUT/'rgbm-top-down.npy')}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print('BAKE_RESULT '+json.dumps(report))
