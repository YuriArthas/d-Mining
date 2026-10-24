import test from 'node:test';
import assert from 'node:assert/strict';
import {surfacePlan} from '../../src/game/world/SurfaceAssetPlan.ts';
import {CharacterPhysics,initPhysics,RAPIER} from '../../src/game/validation/physics.ts';

test('real capsule crosses low curb and service/egg approaches without jumping',async()=>{
 await initPhysics();
 const routes=[{from:[0,.1,38],dx:1,dz:0,axis:0,end:6},{from:[6,.1,38],dx:-1,dz:0,axis:0,end:0},{from:[0,.1,35],dx:0,dz:-1,axis:2,end:25},{from:[-12,.1,48],dx:0,dz:1,axis:2,end:51.6},{from:[23,.1,15.5],dx:1,dz:0,axis:0,end:29}];
 for(const r of routes){
  const p=new CharacterPhysics(false);
  try{
   p.world.createCollider(RAPIER.ColliderDesc.cuboid(90,.5,90).setTranslation(0,-.5,0));
   for(const s of surfacePlan().solids)p.world.createCollider(RAPIER.ColliderDesc.cuboid(...s.half).setTranslation(...s.at).setRotation({x:0,y:Math.sin(s.yaw/2),z:0,w:Math.cos(s.yaw/2)}));
   p.teleport(r.from);for(let i=0;i<20;i++)p.tick(0,0,0,false,true);
   const dir=r.axis===0?r.dx:r.dz;
   for(let i=0;i<180&&(r.end-p.feet()[r.axis])*dir>0;i++)p.tick(r.dx,-r.dz,0,false,true);
   assert.ok((p.feet()[r.axis]-r.end)*dir>=0,`blocked ${JSON.stringify(r)} at ${p.feet()}`);
  }finally{p.dispose();}
 }
});
