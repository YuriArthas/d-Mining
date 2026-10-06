import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture,CompressedTexture,RGBA_BPTC_Format} from 'three';
import {disposeScenery} from '../../src/game/presentation/disposeScenery.ts';
import {surfaceTextureMemory} from '../../src/game/presentation/surfaceTextureMemory.ts';
import {uploadSurfaceTexture} from '../../src/game/presentation/uploadSurfaceTexture.ts';

test('scene disposal releases all map slots and shared resources exactly once',()=>{
 const group=new Group(),geometry=new BoxGeometry(),image={close(){closed++}},map=new Texture(image),normal=new Texture(),orm=new Texture();
 const material=new MeshStandardMaterial({map,normalMap:normal,roughnessMap:orm,metalnessMap:orm});
 let closed=0,noiseDisposed=0;const counts=new Map();
 group.userData.disposeSurfaceNoise=()=>noiseDisposed++;
 for(const resource of [geometry,material,map,normal,orm])resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)??0)+1));
 group.add(new Mesh(geometry,material),new Mesh(geometry,material));
 disposeScenery(group);
 for(const resource of [geometry,material,map,normal,orm])assert.equal(counts.get(resource),1);
 assert.equal(closed,1);assert.equal(group.children.length,0);
 disposeScenery(group);assert.equal(closed,1);assert.equal(noiseDisposed,1);
});

test('memory accounting counts mip bytes once for shared texture sources',()=>{
 const texture=new CompressedTexture([{data:new Uint8Array(16),width:4,height:4},{data:new Uint8Array(16),width:2,height:2}],4,4,RGBA_BPTC_Format);
 const clone=texture.clone(),stats=surfaceTextureMemory([texture,texture,clone]);
 assert.equal(stats.uniqueSources,1);assert.equal(stats.encodedMipBytes,32);assert.equal(stats.allCompressed,true);
});

function renderer(){
 let uploads=0,deletes=0,polls=0;
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,WAIT_FAILED:3,fenceSync:()=>({}),flush(){},isContextLost:()=>false,
  clientWaitSync(fence,flags,timeout){assert.equal(timeout,0);return ++polls===1?2:4},deleteSync(){deletes++}};
 return {gl,getContext:()=>gl,initTexture(){uploads++},stats:()=>({uploads,deletes})};
}
test('texture staging waits asynchronously and always releases its fence',async()=>{
 const r=renderer();await uploadSurfaceTexture(r,new Texture({width:1,height:1}),new AbortController().signal);
 assert.deepEqual(r.stats(),{uploads:1,deletes:1});
 const abort=new AbortController();abort.abort();
 await assert.rejects(uploadSurfaceTexture(r,new Texture({width:1,height:1}),abort.signal),{name:'AbortError'});
 assert.deepEqual(r.stats(),{uploads:1,deletes:1});
});
test('cancel during an upload and GPU failures release staging fences',async()=>{
 for(const mode of ['abort','failed']){
  const r=renderer(),abort=new AbortController();
  r.gl.clientWaitSync=()=>{if(mode==='abort')abort.abort();return mode==='abort'?2:3};
  await assert.rejects(uploadSurfaceTexture(r,new Texture({width:1,height:1}),abort.signal));
  assert.deepEqual(r.stats(),{uploads:1,deletes:1});
 }
});

test('asset bundle retains displaced materials and releases shared textures once; borrowed maps stay external',async()=>{
 const {SceneAssetBundle}=await import('../../src/game/presentation/SceneAssetBundle.ts');
 const geometry=new BoxGeometry(),map=new Texture(),borrowed=new Texture();
 const original=new MeshStandardMaterial({map,emissiveMap:borrowed}),clone=original.clone();
 const root=new Group(),mesh=new Mesh(geometry,original);root.add(mesh);
 const counts=new Map();for(const resource of [geometry,map,borrowed,original,clone])resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)??0)+1));
 const bundle=new SceneAssetBundle();bundle.retain(root);mesh.material=clone;
 bundle.dispose(root,new Set([borrowed]));bundle.dispose(root,new Set([borrowed]));
 for(const resource of [geometry,map,original,clone])assert.equal(counts.get(resource),1);
 assert.equal(counts.get(borrowed),undefined);borrowed.dispose();assert.equal(counts.get(borrowed),1);
});
