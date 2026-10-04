import test from 'node:test';
import assert from 'node:assert/strict';
import { ThirdPersonCamera } from '../../src/game/ThirdPersonCamera.ts';
import { MINE_PAVILION_SOLIDS } from '../../src/game/world/MinePavilion.ts';
import { surfacePlan } from '../../src/game/world/SurfaceAssetPlan.ts';
import { SURFACE_SPAWN, SURFACE_SALE, SURFACE_SHOP, SURFACE_BUILDINGS } from '../../src/game/world/surfaceLayout.ts';
import { RAPIER, initPhysics } from '../../src/game/validation/physics.ts';

test('quarry collision keeps spawn, sale and the full shaft clear; buildings remain solid',async()=>{
 await initPhysics();
 const plan=surfacePlan(),world=new RAPIER.World({x:0,y:-9.8,z:0});
 try{
  for(const s of plan.solids){
   const {at,half,yaw}=s;
   assert.ok([...at,...half,yaw].every(Number.isFinite));
   const desc=s.triangles?RAPIER.ColliderDesc.trimesh(new Float32Array(s.triangles.vertices),new Uint32Array(s.triangles.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES):s.hull?RAPIER.ColliderDesc.convexHull(new Float32Array(s.hull)):RAPIER.ColliderDesc.cuboid(...half);
   world.createCollider(desc.setTranslation(...at).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}));
   if(s.triangles){
    const {vertices:v,indices:ix}=s.triangles;
    for(let i=0;i<ix.length;i+=3){const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;assert.ok((v[b+2]-v[a+2])*(v[c]-v[a])-(v[b]-v[a])*(v[c+2]-v[a+2])>0);}
   }
  }
  world.step();
  const ray=(x,z)=>world.castRay(new RAPIER.Ray({x,y:2,z},{x:0,y:-1,z:0}),3,true);
  assert.equal(ray(SURFACE_SPAWN[0],SURFACE_SPAWN[2]),null);
  assert.equal(ray(SURFACE_SALE.x,SURFACE_SALE.z),null);
  assert.equal(ray(SURFACE_SHOP.x,SURFACE_SHOP.z),null);
  for(let x=-7;x<8;x+=2)for(let z=-7;z<8;z+=2)assert.equal(ray(x,z),null);
  const clear=[];
  for(const x of [-1,0,1])for(let z=12;z<=40;z+=2)clear.push([x,z]);
  for(const x of [6,12,18,24,29,35])for(const z of [30,33,36])clear.push([x,z]);
  for(const x of [-23,-20,-15,-10,-5])for(const z of [26,30,35])clear.push([x,z]);
  for(const p of [SURFACE_SALE,SURFACE_SHOP])for(let t=0;t<=1;t+=.1)clear.push([p.x*t,17+(p.z-17)*t]);
  for(const [x,z] of clear)assert.equal(ray(x,z),null,`courtyard approach blocked at ${x},${z}`);
  for(const [x,z] of [[-11,-11],...Object.values(SURFACE_BUILDINGS).map(p=>[p.x,p.z]),[2,-44]]) {
   const hit=world.castRay(new RAPIER.Ray({x,y:30,z},{x:0,y:-1,z:0}),30,true);assert.ok(hit);
  }
 }finally{world.free();}
});


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
