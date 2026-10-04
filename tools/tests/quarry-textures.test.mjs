import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import { QUARRY_PLACEMENTS } from '../../src/game/world/QuarryLayout.ts';

test('shipped quarry models use role-sized GPU-compressed mip chains and exact transport parts',()=>{
 const directory=new URL('../../src/game/assets/camp/',import.meta.url);
 const files=readdirSync(directory).filter(name=>name.endsWith('.manifest.json'));
 assert.equal(files.length,61);let textures=0,triangles=0,downloadBytes=0;
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
  triangles+=count;assert.equal(count,manifest.triangles);assert.ok(count<=manifest.faceLimit);assert.equal(manifest.geometryEdits,false);assert.ok(manifest.taskId);
  assert.ok(document.extensionsRequired.includes('KHR_texture_basisu'));
  const dimensions=new Map(),scale=file.startsWith('bank-')?.5:1;
  const source=index=>document.textures[index].extensions.KHR_texture_basisu.source;
  for(const material of document.materials){
   dimensions.set(source(material.pbrMetallicRoughness.baseColorTexture.index),512*scale);
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
 assert.equal(textures,183);
 const manifests=new Map(files.map(file=>[file.replace('.manifest.json',''),JSON.parse(readFileSync(new URL(file,directory)))]));
 const placed=QUARRY_PLACEMENTS.reduce((sum,p)=>sum+manifests.get(p.asset).triangles,0);assert.ok(placed<650_000,`${placed} placed triangles`);
 assert.ok(triangles<190_000,`Surface meshes contain ${triangles} unique triangles`);
 assert.ok(downloadBytes<26*1024*1024,`Surface download unexpectedly uses ${downloadBytes} bytes`);
});
