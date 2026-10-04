import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { ThirdPersonCamera, cameraClearance } from '../../src/game/ThirdPersonCamera.ts';
import { CharacterPhysics, initPhysics, RAPIER } from '../../src/game/validation/physics.ts';
import { GAME_CONFIG } from '../../src/game/config.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';
import { CELL, WORLD_GENERATION, RENDER_SIZE as CHUNK } from '../../src/game/terrain/SparseWorld.ts';
await initPhysics();
const ID={x:0,y:0,z:0,w:1};
function setup(){const p=new CharacterPhysics();p.world.createCollider(RAPIER.ColliderDesc.cuboid(90,.5,90).setTranslation(0,-.5,0));p.world.step();return p;}
function check(rig,p){
 assert.equal(rig.obstructed(p.world,p.collider),false,JSON.stringify(rig.snapshot()));
 assert.ok(rig.position.toArray().every(Number.isFinite));
 assert.ok(rig.distance<=rig.safeDistance+1e-6);
 // Independently inspect four actual near-plane corners, not just the center ray.
 const right=new Vector3().crossVectors(new Vector3(0,1,0),rig.direction).normalize(),up=new Vector3().crossVectors(rig.direction,right).normalize();
 const halfH=rig.near*Math.tan(GAME_CONFIG.camera.fov*Math.PI/360);
 for(const aspect of [16/9,844/390])for(const x of [-1,1])for(const y of [-1,1]){
  const v=rig.position.clone().addScaledVector(rig.direction,-rig.near).addScaledVector(right,halfH*aspect*x).addScaledVector(up,halfH*y);
  assert.equal(p.world.intersectionWithShape(v,ID,new RAPIER.Ball(.001),undefined,undefined,p.collider),null);
 }
}
test('near plane including wide landscape corners fits inside the clearance sphere',()=>{
 for(const aspect of [16/9,844/390,844/260,10]){
  const {near,radius}=cameraClearance(aspect,55),h=near*Math.tan(55*Math.PI/360);
  assert.ok(Math.hypot(near,h,h*aspect)<radius);assert.ok(radius<=.280001);assert.ok(near>0);
 }
});
test('open orbit uses requested yaw/pitch, including near-vertical and upward views',()=>{
 const p=setup(),r=new ThirdPersonCamera();try{
  for(const pitch of [-.55,0,.45,1.45])for(let yaw=0;yaw<Math.PI*2;yaw+=.17){r.update(p.world,p.collider,[40,.027,40],yaw,pitch,1/60,844/390);check(r,p);assert.ok(Math.abs(r.direction.y-Math.sin(pitch))<1e-7);}
 }finally{p.dispose();}
});
test('wall contraction is immediate and removal recovers monotonically without teleporting the boom',()=>{
 const p=setup(),r=new ThirdPersonCamera();try{
  r.update(p.world,p.collider,[40,.027,40],0,0,1/60,844/390);assert.equal(r.distance,GAME_CONFIG.camera.distance);
  const wall=p.world.createCollider(RAPIER.ColliderDesc.cuboid(3,4,.1).setTranslation(40,2,42));p.world.step();
  r.update(p.world,p.collider,[40,.027,40],0,0,1/60,844/390);check(r,p);assert.ok(r.distance<1.8);
  p.world.removeCollider(wall,false);p.world.step();let previous=r.distance;
  for(let i=0;i<90;i++){r.update(p.world,p.collider,[40,.027,40],0,0,1/60,844/390);assert.ok(r.distance>=previous);assert.ok(r.distance-previous<.85);check(r,p);previous=r.distance;}
  assert.ok(r.distance>GAME_CONFIG.camera.distance-.01);
 }finally{p.dispose();}
});
test('low ceiling jump keeps pivot and near plane in free space and fades the nearby avatar',()=>{
 const p=setup(),r=new ThirdPersonCamera();try{
  p.teleport([-10.8,.05,18]);for(let i=0;i<20;i++)p.tick(0,0,0,false,true);
  let hidden=false;
  for(let i=0;i<90;i++){
   p.tick(0,0,0,i===0,true);r.update(p.world,p.collider,p.feet(),i*.12,.45,1/60,844/390);check(r,p);
   assert.ok(r.target.y+r.radius<2.001);if(r.avatarOpacity===0)hidden=true;
  }
  assert.ok(hidden);
 }finally{p.dispose();}
});
test('inner/outer corners and narrow corridor remain clear throughout a complete orbit',()=>{
 const p=setup(),r=new ThirdPersonCamera();try{
  for(const feet of [[-16.9,.027,20.9],[-18.9,.027,22.9],[-10.8,.027,15],[-10.8,.027,21]]){
   r.reset();for(let i=0;i<120;i++){r.update(p.world,p.collider,feet,i*Math.PI/60,.45,1/60,844/390);check(r,p);}
  }
 }finally{p.dispose();}
});
test('actual voxel shaft descent and steep pitch preserve camera clearance',()=>{
 const p=new CharacterPhysics(),r=new ThirdPersonCamera();try{
  for(const z of [-1,0]){const data=buildRegion('collision',[-1,-1,z],CHUNK,[],{...WORLD_GENERATION,samples:true}),m=data.mesh;p.world.createCollider(RAPIER.ColliderDesc.trimesh(m.positions,m.indices,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setTranslation(-CELL*CHUNK,-CELL*CHUNK,z*CELL*CHUNK));}
  p.teleport([-23,.05,0]);
  for(let i=0;i<100;i++){p.tick(0,0,0,false,true);r.update(p.world,p.collider,p.feet(),i*.08,i<60?1.4:-.4,1/60,844/390);check(r,p);}
  assert.ok(p.grounded&&p.feet()[1]<-7.9);
 }finally{p.dispose();}
});
test('recovery duration is frame-rate independent; reset removes old target lag',()=>{
 const values=[];
 for(const hz of [30,60,90,120]){
  const p=setup(),r=new ThirdPersonCamera();try{
   const wall=p.world.createCollider(RAPIER.ColliderDesc.cuboid(3,4,.1).setTranslation(40,2,42));p.world.step();r.update(p.world,p.collider,[40,.027,40],0,0,1/hz,844/390);
   p.world.removeCollider(wall,false);p.world.step();for(let i=0;i<hz;i++)r.update(p.world,p.collider,[40,.027,40],0,0,1/hz,844/390);values.push(r.distance);
   r.reset();r.update(p.world,p.collider,[50,10,50],0,.45,1/hz,844/390);assert.ok(Math.abs(r.target.y-11.9)<1e-6);assert.equal(r.distance,GAME_CONFIG.camera.distance);
  }finally{p.dispose();}
 }
 assert.ok(Math.max(...values)-Math.min(...values)<1e-8);
});

test('idle constrained camera settles without oscillation at a low roof or a wall',()=>{
 const p=setup();try{
  for(const feet of [[-10.8,.027,18],[4.4,2.027,16]]){
   const r=new ThirdPersonCamera(),positions=[];
   for(let i=0;i<300;i++){r.update(p.world,p.collider,feet,Math.PI/2,.45,1/60,844/390);if(i>=180)positions.push(r.position.toArray());}
   for(let axis=0;axis<3;axis++){const values=positions.map(v=>v[axis]);assert.ok(Math.max(...values)-Math.min(...values)<.001);}
   check(r,p);
  }
 }finally{p.dispose();}
});
