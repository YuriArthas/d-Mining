import test from 'node:test';
import assert from 'node:assert/strict';
import {SURFACE_PONDS,POND_SOLIDS,pondDistance} from '../../src/game/world/SurfacePonds.ts';
import {SURFACE_ROADS} from '../../src/game/world/surfaceLayout.ts';
import {planGrass} from '../../src/game/world/GrassLayout.ts';
import {createSurfacePonds} from '../../src/game/presentation/SurfacePondsView.ts';
import {disposeScenery} from '../../src/game/presentation/disposeScenery.ts';
import {CharacterPhysics,initPhysics,RAPIER} from '../../src/game/validation/physics.ts';

test('ponds leave mine approach and side paths clear; grass never grows under water',()=>{
 for(const p of SURFACE_PONDS)for(const r of SURFACE_ROADS){
  assert.ok(p.x+6<=r.minX||p.x-6>=r.maxX||p.z+5<=r.minZ||p.z-5>=r.maxZ);
 }
 assert.ok(planGrass().every(p=>pondDistance(p.x,p.z)>=1.35));
 const root=createSurfacePonds({value:0});
 try{
  assert.equal(root.children.length,4);
  assert.equal(root.children[0].geometry,root.children[2].geometry);
  assert.equal(root.children[1].geometry,root.children[3].geometry);
  const normal=root.children[1].geometry.attributes.normal;
  for(let i=0;i<normal.count;i++)assert.ok(normal.getY(i)>.99);
  assert.equal(root.userData.ponds.extraTextures,0);
 }finally{disposeScenery(root);}
});

test('capsule steps over actual pond bank, walks through shallow bed and exits',async()=>{
 await initPhysics();const p=new CharacterPhysics(false);
 try{
  p.world.createCollider(RAPIER.ColliderDesc.cuboid(90,.5,90).setTranslation(0,-.5,0));
  for(const s of POND_SOLIDS)p.world.createCollider(RAPIER.ColliderDesc.cuboid(...s.half).setTranslation(...s.at));
  p.teleport([3.5,.1,21]);for(let i=0;i<20;i++)p.tick(0,0,0,false,true);
  let reachedBed=false;
  for(let i=0;i<360&&p.feet()[0]<18;i++){
   p.tick(1,0,0,false,true);
   if(Math.abs(p.feet()[0]-11)<.2){assert.ok(p.feet()[1]<.1);reachedBed=true;}
  }
  assert.ok(reachedBed);assert.ok(p.feet()[0]>=18,`blocked at ${p.feet()}`);
 }finally{p.dispose();}
});
