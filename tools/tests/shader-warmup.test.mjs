import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Mesh,MeshBasicMaterial,MeshStandardMaterial,PerspectiveCamera,Scene,Vector4} from 'three';
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
test('objects behind the camera are warmed too; one first use per program without parallel compile, batches with it',async()=>{
 for(const parallel of [false,true]){
  const f=fixture(parallel),extra=[];
  // Forty labels, each its own material, behind the camera: one program.
  for(let i=0;i<40;i++){const m=new Mesh(f.geometry,new MeshBasicMaterial({transparent:true}));m.position.z=5;f.scene.add(m);extra.push(m);}
  try{const result=await prepareShaders(f.renderer,f.scene,f.camera,new AbortController().signal,()=>{});
   assert.equal(result.objects,41);
   assert.deepEqual(f.calls,parallel?['compileAsync','render','render']:['compile','render','compile','render']);
  }finally{for(const m of extra)m.material.dispose();f.geometry.dispose();f.material.dispose();}
 }
});
test('hidden cave point lights still warm the lit shader variant',async()=>{
 const f=fixture(false);
 const {Group,PointLight}=await import('three');
 const group=new Group();group.visible=false;group.name='cave-lights';
 const light=new PointLight();light.userData.caveLight=true;group.add(light);f.scene.add(group);
 try{await prepareShaders(f.renderer,f.scene,f.camera,new AbortController().signal,()=>{});
  assert.deepEqual(f.calls,['compile','render','compile','render']);
 }finally{f.geometry.dispose();f.material.dispose();}
});
test('hidden parts are skipped unless they ask to be warmed (the onboarding arrow, the first crack)',async()=>{
 const f=fixture(false),later=new Mesh(f.geometry,new MeshBasicMaterial({map:null,transparent:true})),never=new Mesh(f.geometry,new MeshBasicMaterial({color:'red'}));
 const arrow=new Mesh(f.geometry,new MeshBasicMaterial({wireframe:true}));arrow.userData.prewarm=true;later.add(arrow);
 later.visible=false;never.visible=false;f.scene.add(later,never);
 const {BlockCracks}=await import('../../src/game/presentation/BlockCracks.ts'),cracks=new BlockCracks();f.scene.add(cracks.group);
 try{const result=await prepareShaders(f.renderer,f.scene,f.camera,new AbortController().signal,()=>{});
  assert.equal(result.objects,2,'the live box and the crack overlay; an arrow under a hidden parent without the flag stays out');
 }finally{cracks.dispose();for(const m of [later,never,arrow])m.material.dispose();f.geometry.dispose();f.material.dispose();}
});
