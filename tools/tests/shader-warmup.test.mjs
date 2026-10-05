import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Mesh,MeshStandardMaterial,PerspectiveCamera,Scene,Vector4} from 'three';
import {prepareShaders} from '../../src/game/presentation/prepareShaders.ts';
function fixture(parallel){
 const scene=new Scene(),camera=new PerspectiveCamera(60,1,.1,100),geometry=new BoxGeometry(),material=new MeshStandardMaterial();
 const mesh=new Mesh(geometry,material);mesh.position.z=-5;scene.add(mesh);
 const calls=[],scissor=new Vector4(2,3,10,20);let enabled=false;
 const error=()=>{};
 const renderer={info:{programs:[]},extensions:{has:()=>parallel},debug:{onShaderError:error},
 getScissor:v=>v.copy(scissor),getScissorTest:()=>enabled,setScissor:(...args)=>{args[0] instanceof Vector4?scissor.copy(args[0]):scissor.set(...args);},setScissorTest:value=>enabled=value,
 compile:()=>calls.push('compile'),compileAsync:async()=>calls.push('compileAsync'),render:()=>{assert.equal(enabled,true);assert.deepEqual(scissor.toArray(),[0,0,1,1]);calls.push('render');}};
 return {scene,camera,geometry,material,mesh,calls,renderer,error,scissor,get enabled(){return enabled;}};
}
for(const parallel of [false,true])test(`shader warmup preserves live scene and selects parallel=${parallel}`,async()=>{
 const f=fixture(parallel);try{const result=await prepareShaders(f.renderer,f.scene,f.camera,new AbortController().signal,()=>{});
 assert.equal(result.objects,1);assert.deepEqual(f.calls,[parallel?'compileAsync':'compile','render']);assert.equal(f.mesh.parent,f.scene);assert.equal(f.mesh.material,f.material);
 assert.deepEqual(f.scissor.toArray(),[2,3,10,20]);assert.equal(f.enabled,false);assert.equal(f.renderer.debug.onShaderError,f.error);
 }finally{f.geometry.dispose();f.material.dispose();}
});
test('exit during compilation cancels first use and restores renderer state',async()=>{
 const f=fixture(true),controller=new AbortController();f.renderer.compileAsync=async()=>controller.abort();
 try{await assert.rejects(prepareShaders(f.renderer,f.scene,f.camera,controller.signal,()=>{}),{name:'AbortError'});
 assert.equal(f.calls.includes('render'),false);assert.equal(f.mesh.parent,f.scene);assert.equal(f.renderer.debug.onShaderError,f.error);assert.equal(f.enabled,false);
 }finally{f.geometry.dispose();f.material.dispose();}
});
