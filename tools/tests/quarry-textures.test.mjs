import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import { QUARRY_PLACEMENTS } from '../../src/game/world/QuarryLayout.ts';

test('shipped quarry models use role-sized GPU-compressed mip chains and exact transport parts',()=>{
 const directory=new URL('../../src/game/assets/camp/',import.meta.url);
 const files=readdirSync(directory).filter(name=>name.endsWith('.manifest.json'));
 assert.deepEqual(files.map(f=>f.replace('.manifest.json','')).sort(),[...new Set(QUARRY_PLACEMENTS.map(p=>p.asset))].sort());let textures=0,texturedModels=0,authoredModels=0,triangles=0,downloadBytes=0;
 for(const file of files){
  const manifest=JSON.parse(readFileSync(new URL(file,directory)));
  const packed=Buffer.concat(manifest.parts.map(name=>readFileSync(new URL(name,directory))));
  downloadBytes+=packed.length;
  const parts=manifest.parts.map(name=>readFileSync(new URL(name,directory)));
  assert.ok(parts.every(part=>part.length<=4*1024*1024));
  const joined=Buffer.concat(parts);assert.deepEqual(joined,packed);
  assert.equal(joined.length,manifest.bytes);assert.equal(createHash('sha256').update(joined).digest('hex'),manifest.sha256);
  const buffer=gunzipSync(packed),jsonLength=buffer.readUInt32LE(12);
  const document=JSON.parse(buffer.subarray(20,20+jsonLength)),binaryStart=28+jsonLength;
  const count=document.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+document.accessors[p.indices??p.attributes.POSITION].count/3,0),0);
  triangles+=count;assert.equal(count,manifest.triangles);assert.ok(count<=manifest.faceLimit);assert.equal(manifest.geometryEdits,false);assert.ok(manifest.taskId||manifest.generationId);
  if(manifest.materialProfile==='solid-color'){
   assert.ok(file.startsWith('grid-mine-')||file==='mine-fence.manifest.json');
   assert.equal(document.images?.length??0,0);assert.equal(document.textures?.length??0,0);
   for(const m of document.materials){assert.equal(m.pbrMetallicRoughness.metallicFactor,0);assert.equal(m.pbrMetallicRoughness.roughnessFactor,.82);assert.equal(m.normalTexture,undefined);assert.equal(m.pbrMetallicRoughness.baseColorTexture,undefined);}
   continue;
  }
  if(manifest.materialProfile==='authored-color'){
   authoredModels++;
   assert.equal(manifest.source,'Blender authored mesh and texture');
   assert.ok(manifest.generationId);assert.equal(manifest.taskId,undefined);
   assert.ok(count<=(file.startsWith('egg-')?1600:file==='portal-plinth-blender.manifest.json'?192:128));assert.equal(document.images.length,1);
   for(const material of document.materials){assert.equal(material.normalTexture,undefined);assert.equal(material.pbrMetallicRoughness.metallicRoughnessTexture,undefined);}
  }else texturedModels++;
  assert.ok(document.extensionsRequired.includes('KHR_texture_basisu'));
  const dimensions=new Map(),scale=(file.startsWith('portal-')||file.startsWith('egg-')||file.startsWith('bank-')||file.startsWith('grid-mine-')||file.startsWith('mine-pendant'))?.5:1;
  const source=index=>document.textures[index].extensions.KHR_texture_basisu.source;
  for(const material of document.materials){
   if(material.pbrMetallicRoughness.baseColorTexture)dimensions.set(source(material.pbrMetallicRoughness.baseColorTexture.index),manifest.materialProfile==='authored-color'?128:512*scale);
   if(manifest.materialProfile==='authored-color')continue;
   dimensions.set(source(material.pbrMetallicRoughness.metallicRoughnessTexture.index),128*scale);
   dimensions.set(source(material.normalTexture.index),256*scale);
  }
  for(const [index,image] of document.images.entries()){
   assert.equal(image.mimeType,'image/ktx2');
   const view=document.bufferViews[image.bufferView],ktx=buffer.subarray(binaryStart+(view.byteOffset??0));
   assert.equal(ktx.subarray(0,12).toString('hex'),'ab4b5458203230bb0d0a1a0a');
   const dimension=dimensions.get(index);assert.ok(dimension);
   assert.equal(ktx.readUInt32LE(20),dimension);assert.equal(ktx.readUInt32LE(24),dimension);
   assert.equal(ktx.readUInt32LE(40),Math.log2(dimension)+1);textures++;
  }
 }
 assert.equal(textures,texturedModels*3+authoredModels);
 const manifests=new Map(files.map(file=>[file.replace('.manifest.json',''),JSON.parse(readFileSync(new URL(file,directory)))]));
 const placed=QUARRY_PLACEMENTS.reduce((sum,p)=>sum+manifests.get(p.asset).triangles,0);// Voxel-scale assembled mine adds 35,835 placed triangles; unique geometry shrinks.
 assert.ok(placed<675_000,`${placed} placed triangles`);
 assert.ok(triangles<190_000,`Surface meshes contain ${triangles} unique triangles`);
 assert.ok(downloadBytes<26*1024*1024,`Surface download unexpectedly uses ${downloadBytes} bytes`);
});

test('surface material and shadow samplers fit the WebGL2 minimum with headroom',async()=>{
 const {SceneLightingRig}=await import('../../src/game/presentation/SceneLightingRig.ts');
 const rig=new SceneLightingRig();
 try{
  // Each Three material uniform allocates a unit, even if ORM channels share an image.
  const shadowSamplers=1+[rig.key,...rig.fills].filter(light=>light.castShadow).length; // moon + spotlights
  const directory=new URL('../../src/game/assets/camp/',import.meta.url);
  for(const name of new Set(QUARRY_PLACEMENTS.map(p=>p.asset))){
   const manifest=JSON.parse(readFileSync(new URL(`${name}.manifest.json`,directory)));
   const glb=gunzipSync(Buffer.concat(manifest.parts.map(p=>readFileSync(new URL(p,directory)))));
   const document=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)));
   for(const m of document.materials){
    const pbr=m.pbrMetallicRoughness??{};
    const materialSamplers=Number(!!pbr.baseColorTexture)+2*Number(!!pbr.metallicRoughnessTexture)+Number(!!m.normalTexture)+Number(!!m.occlusionTexture)+Number(!!m.emissiveTexture);
    assert.ok(shadowSamplers+materialSamplers+2<=14,`${name}: ${shadowSamplers+materialSamplers+2} samplers, keep 2 of the guaranteed 16 spare`); // environment + Three r186 DFG lookup
   }
  }
 }finally{rig.dispose();}
});
