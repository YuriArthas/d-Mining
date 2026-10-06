import test from 'node:test';
import assert from 'node:assert/strict';
import {CompressedTexture,RGBA_BPTC_Format} from 'three';
import {planTextureUploads,uploadSurfaceTextures} from '../../src/game/presentation/uploadSurfaceTexture.ts';
const texture=bytes=>new CompressedTexture([{data:new Uint8Array(bytes),width:4,height:4}],4,4,RGBA_BPTC_Format);
test('uploads obey both byte and texture limits, and repeated references upload once',()=>{
 const a=texture(40),b=texture(40),c=texture(40),d=texture(10);
 assert.deepEqual(planTextureUploads([a,b,a,c,d],{maxTextures:4,maxBytes:100}).map(b=>[b.textures.length,b.bytes]),[[2,80],[2,50]]);
 assert.deepEqual(planTextureUploads([a,b,c,d],{maxTextures:2,maxBytes:1000}).map(b=>b.textures.length),[2,2]);
 assert.throws(()=>planTextureUploads([a],{maxTextures:4,maxBytes:39}),/预算/);
});
test('one fence covers each batch, and batches never overlap',async()=>{
 const events=[],sources=Array.from({length:9},()=>texture(16));let inFlight=false;
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,WAIT_FAILED:3,isContextLost:()=>false,
 fenceSync(){assert.equal(inFlight,false);inFlight=true;events.push('fence');return {};},flush(){},clientWaitSync(){return 4;},deleteSync(){assert.equal(inFlight,true);inFlight=false;events.push('done');}};
 const renderer={getContext:()=>gl,initTexture(t){assert.equal(inFlight,false);events.push(sources.indexOf(t));}};
 const stats=await uploadSurfaceTextures(renderer,sources,new AbortController().signal);
 assert.deepEqual(events,[0,1,2,3,'fence','done',4,5,6,7,'fence','done',8,'fence','done']);
 assert.equal(stats.textures,9);assert.equal(stats.batches,3);assert.equal(stats.maxBatchBytes,64);
});
