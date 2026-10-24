import test from 'node:test';
import assert from 'node:assert/strict';
import {ThirdPersonCamera} from '../../src/game/ThirdPersonCamera.ts';
import {MINE_PAVILION_SOLIDS} from '../../src/game/world/MinePavilion.ts';
import {RAPIER,initPhysics} from '../../src/game/validation/physics.ts';

test('roofed mine leaves its front entry clear and constrains high camera orbits',async()=>{
 await initPhysics();const world=new RAPIER.World({x:0,y:0,z:0});
 try{
  for(const s of MINE_PAVILION_SOLIDS){const desc=s.hull?RAPIER.ColliderDesc.convexHull(new Float32Array(s.hull)):RAPIER.ColliderDesc.cuboid(...s.half);world.createCollider(desc.setTranslation(...s.at));}
  const player=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.35).setTranslation(0,.9,0));world.step();
  for(const x of [-2,0,2])assert.equal(world.castRay(new RAPIER.Ray({x,y:1,z:17},{x:0,y:0,z:-1}),8,true,undefined,undefined,player),null);
  for(const feet of [[0,0,0],[7,0,7],[0,0,10]]){
   const camera=new ThirdPersonCamera();
   for(const pitch of [.25,.8,1.3])for(let yaw=0;yaw<Math.PI*2;yaw+=Math.PI/4){camera.reset();camera.update(world,player,feet,yaw,pitch,1/60,16/9);assert.equal(camera.obstructed(world,player),false);}
  }
 }finally{world.free();}
});
