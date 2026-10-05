import assert from 'node:assert/strict';
import test from 'node:test';
import { initPhysics, CharacterPhysics, RAPIER } from '../../src/game/validation/physics.ts';
await initPhysics();
function setup(){const p=new CharacterPhysics();const floor=p.world.createCollider(RAPIER.ColliderDesc.cuboid(40,0.5,40).setTranslation(0,-0.5,0));return {p,floor};}
function tick(p,n,x=0,y=0,jump=false){for(let i=0;i<n;i++)p.tick(x,y,0,jump&&i===0,true);}
test('production spawn and former deck footprint are flat without invisible ramp colliders',()=>{
 const p=new CharacterPhysics(false);try{
  p.world.createCollider(RAPIER.ColliderDesc.cuboid(80,.5,80).setTranslation(0,-.5,0));
  tick(p,30);assert.ok(p.grounded);assert.ok(p.feet()[1]<.05);
  p.teleport([0,.05,6.5]);tick(p,20);
  for(let i=0;i<120;i++){tick(p,1,0,-1);assert.ok(p.grounded);assert.ok(p.feet()[1]>=0&&p.feet()[1]<.05);}
  assert.ok(p.feet()[2]>18);
 }finally{p.dispose();}
});
test('capsule lands, jumps once and returns to ground without penetration',()=>{
 const {p}=setup();try{
  p.teleport([12,12,0]);tick(p,180);assert.ok(p.grounded);assert.ok(p.feet()[1]>=0&&p.feet()[1]<0.1);
  tick(p,12,0,0,true);assert.ok(p.feet()[1]>1);assert.equal(p.grounded,false);
  tick(p,120);assert.ok(p.grounded);assert.ok(p.feet()[1]<0.1);
 }finally{p.dispose();}
});
test('ordinary slope joins platform and capsule slides along the wall',()=>{
 const {p}=setup();try{
  p.teleport([0,0.05,2]);tick(p,160,0,-1);assert.ok(p.feet()[1]>1.9&&p.feet()[1]<2.1,JSON.stringify(p.feet()));
  p.teleport([4,2.05,16]);tick(p,40,Math.SQRT1_2,Math.SQRT1_2);
  assert.ok(p.feet()[0]<4.7);assert.ok(p.feet()[2]<15);
 }finally{p.dispose();}
});
test('removing supporting terrain causes falling; unavailable collision region freezes movement',()=>{
 const {p,floor}=setup();try{
  p.teleport([12,0.05,0]);tick(p,20);assert.ok(p.grounded);
  p.world.removeCollider(floor,false);tick(p,20);assert.ok(p.feet()[1]<-0.5);
  const before=p.feet();for(let i=0;i<100;i++)p.tick(1,1,0,false,false);assert.deepEqual(p.feet(),before);
 }finally{p.dispose();}
});


test('idle capsule on ordinary platform remains stable without camera-height oscillation',()=>{
 const p=new CharacterPhysics();try{
  p.teleport([0,2.05,16]);tick(p,120);const heights=[];for(let i=0;i<300;i++){tick(p,1);heights.push(p.feet()[1]);}
  assert.ok(Math.max(...heights)-Math.min(...heights)<0.001);
  assert.ok(heights.every(y=>y>=2&&y<2.1));
 }finally{p.dispose();}
});

test('downhill ramp stays supported and shallow steps work in both directions',()=>{
 const {p}=setup();try{
  p.teleport([0,2.05,11]);tick(p,20);
  const heights=[];let airborne=0;
  for(let i=0;i<95;i++){tick(p,1,0,1);heights.push(p.feet()[1]);if(!p.grounded)airborne++;}
  assert.equal(airborne,0);assert.ok(p.feet()[1]<0.1);
  for(let i=1;i<heights.length;i++)assert.ok(heights[i]<=heights[i-1]+0.005);
  p.teleport([-7,0.05,9]);tick(p,20);tick(p,75,0,-1);
  assert.ok(p.feet()[2]>15&&p.feet()[1]>1.19,JSON.stringify(p.feet()));
  let unsupported=0, longest=0;
  for(let i=0;i<75;i++){tick(p,1,0,1);unsupported=p.grounded?0:unsupported+1;longest=Math.max(longest,unsupported);}
  assert.ok(longest<=1,`stair-lip transition lasted ${longest} steps`);
  assert.ok(p.feet()[1]<0.1);
 }finally{p.dispose();}
});
test('jumping on a slope rises freely; airborne and removed-support jump requests are rejected',()=>{
 const {p,floor}=setup();try{
  p.teleport([0,1.05,7]);tick(p,20);const base=p.feet()[1];
  tick(p,1,0,0,true);const jumps=p.jumps;tick(p,10,0,1,true);
  assert.equal(p.jumps,jumps);assert.ok(p.feet()[1]>base+1);
  p.teleport([20,0.05,0]);tick(p,20);p.world.removeCollider(floor,false);
  tick(p,1,0,0,true);assert.equal(p.jumps,jumps);assert.ok(p.verticalSpeed<0);
 }finally{p.dispose();}
});
test('narrow passage permits travel; low ceiling stops a jump without crossing the roof',()=>{
 const {p}=setup();try{
  p.teleport([-10.8,0.05,13]);tick(p,20);tick(p,45,0,-1);
  assert.ok(p.feet()[2]>17);assert.ok(p.grounded);
  let peak=0;for(let i=0;i<50;i++){tick(p,1,0,0,i===0);peak=Math.max(peak,p.feet()[1]);}
  assert.ok(peak>0.1&&peak<0.351,`peak ${peak}`);assert.ok(p.grounded);
  tick(p,60,0,-1);assert.ok(p.feet()[2]>22.5);
 }finally{p.dispose();}
});
test('inner wall corner blocks the capsule; reversing away releases it',()=>{
 const {p}=setup();try{
  p.teleport([-16,0.05,20]);tick(p,20);tick(p,80,-1,-1);
  assert.ok(p.feet()[0]>-17.21);assert.ok(p.feet()[2]<21.21);
  const before=p.feet();tick(p,30,1,1);
  assert.ok(p.feet()[0]>before[0]+1);assert.ok(p.feet()[2]<before[2]-1);
 }finally{p.dispose();}
});
test('terminal-speed fall hits a thin floor; a full mining-cell ledge is not snapped down',()=>{
 const p=new CharacterPhysics();try{
  p.world.createCollider(RAPIER.ColliderDesc.cuboid(5,0.025,5).setTranslation(20,-0.025,0));
  p.teleport([20,90,0]);let lowest=Infinity;
  for(let i=0;i<300;i++){tick(p,1);lowest=Math.min(lowest,p.feet()[1]);}
  assert.ok(lowest>=-0.001);assert.ok(p.grounded);
  p.world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,2).setTranslation(20,1,0));
  p.teleport([20,2.05,0]);tick(p,20);let left=false;
  for(let i=0;i<40;i++){const prev=p.feet();tick(p,1,1,0);if(!p.grounded){left=true;assert.ok(prev[1]-p.feet()[1]<0.25);}}
  assert.ok(left);
 }finally{p.dispose();}
});
test('ordinary floor triangle seams and independent chunk seams stay walkable',()=>{
 const p=new CharacterPhysics();try{
  for(let i=0;i<3;i++)p.world.createCollider(RAPIER.ColliderDesc.trimesh(
   new Float32Array([20+i*4,0,-4,24+i*4,0,-4,20+i*4,0,4,24+i*4,0,4]),
   new Uint32Array([0,2,1,1,2,3]),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES));
  p.teleport([21,0.05,0]);tick(p,20);let lo=Infinity,hi=-Infinity;
  for(let i=0;i<95;i++){tick(p,1,1,0);assert.ok(p.grounded);lo=Math.min(lo,p.feet()[1]);hi=Math.max(hi,p.feet()[1]);}
  assert.ok(p.feet()[0]>30);assert.ok(hi-lo<0.001);
 }finally{p.dispose();}
});
test('shaft staircase requires jumping and provides a continuous route to the surface',()=>{
 const p=new CharacterPhysics();try{
  p.world.createCollider(RAPIER.ColliderDesc.cuboid(8,0.5,8).setTranslation(-24,-8.5,0));
  p.teleport([-24,-7.95,-7]);tick(p,20);tick(p,30,-1,0);
  assert.ok(p.feet()[0]>-25.7);assert.ok(p.feet()[1]<-7.9);
  tick(p,26,-1,0,true);tick(p,60);assert.ok(p.feet()[1]>-7.01,JSON.stringify(p.feet()));
  // Move to each next tread, land, then request a new jump.
  for(let i=1;i<8;i++){
   tick(p,20,0,-1,true);tick(p,60);
   assert.ok(p.grounded);assert.ok(p.feet()[1]>-7+i-0.01,JSON.stringify({i,p:p.feet()}));
  }
  assert.ok(p.feet()[1]>=0);assert.equal(p.jumps,8);
 }finally{p.dispose();}
});

test('outer corner can be walked around without getting stuck on a convex edge',()=>{
 const {p}=setup();try{
  p.teleport([-16,.05,14]);tick(p,20);tick(p,45,-1,0);tick(p,105,0,-1);tick(p,55,1,0);
  assert.ok(p.feet()[0]>-15.1);assert.ok(p.feet()[2]>24);assert.ok(p.grounded);
 }finally{p.dispose();}
});
