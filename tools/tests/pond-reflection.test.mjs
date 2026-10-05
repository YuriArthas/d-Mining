import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,PerspectiveCamera,Scene,Vector4} from 'three';
import {PondReflection} from '../../src/game/presentation/PondReflection.ts';

function harness(){
 const reflection=new PondReflection(.15),scene=new Scene(),camera=new PerspectiveCamera(60,16/9,.08,10000);
 camera.position.set(0,5,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const surfaces=[new Mesh(),new Mesh()],initial={name:'outer-target'};
 let target=initial,viewport=new Vector4(2,3,1280,720),scissor=new Vector4(4,5,600,300),scissorTest=true,calls=0,fail=false;
 const renderer={
  info:{render:{frame:1},autoReset:true},xr:{enabled:true},shadowMap:{autoUpdate:true},autoClear:true,
  state:{buffers:{depth:{setMask(){}}},viewport(){}},
  getDrawingBufferSize:v=>v.set(1920,1080),getRenderTarget:()=>target,setRenderTarget:v=>{target=v;},
  getViewport:v=>v.copy(viewport),setViewport:v=>{viewport=v.clone();},getScissor:v=>v.copy(scissor),setScissor:v=>{scissor=v.clone();},
  getScissorTest:()=>scissorTest,setScissorTest:v=>{scissorTest=v;},
  render:(_scene,reflected)=>{
   calls++;renderer.info.render.frame++;
   assert.ok(Math.abs(reflected.position.y+4.7)<1e-6,'camera mirrored across water plane');
   assert.ok(surfaces.every(p=>!p.visible));assert.equal(renderer.info.autoReset,false);
   reflection.capture(renderer,scene,reflected,surfaces); // No recursive capture.
   if(fail)throw Error('capture interrupted');
  },
 };
 const check=()=>{assert.equal(target,initial);assert.ok(surfaces.every(p=>p.visible));assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.info.autoReset,true);assert.deepEqual(viewport.toArray(),[2,3,1280,720]);assert.deepEqual(scissor.toArray(),[4,5,600,300]);assert.equal(scissorTest,true);};
 return {reflection,renderer,scene,camera,surfaces,check,get calls(){return calls;},setFail:()=>{fail=true;}};
}

test('coplanar ponds share a single clipped capture and a bounded released target',()=>{
 const h=harness();let released=0;h.reflection.mirror.getRenderTarget().addEventListener('dispose',()=>released++);
 try{
  h.reflection.capture(h.renderer,h.scene,h.camera,h.surfaces);h.check();
  h.reflection.capture(h.renderer,h.scene,h.camera,h.surfaces);assert.equal(h.calls,1);
  assert.equal(h.reflection.stats.width,1024);assert.equal(h.reflection.stats.height,576);assert.ok(h.reflection.stats.estimatedTargetBytes<8*1024*1024);
  assert.ok(h.reflection.projection.value.elements.every(Number.isFinite));
  h.renderer.info.render.frame++;h.reflection.capture(h.renderer,h.scene,h.camera,h.surfaces);assert.equal(h.calls,2);
 }finally{const before=released;h.reflection.dispose();h.reflection.dispose();assert.equal(released,before+1);}
});

test('failed reflection restores main target, viewport, visibility and render state',()=>{
 const h=harness();h.setFail();
 try{assert.throws(()=>h.reflection.capture(h.renderer,h.scene,h.camera,h.surfaces),/capture interrupted/);h.check();assert.equal(h.reflection.stats.captures,0);}
 finally{h.reflection.dispose();}
});
