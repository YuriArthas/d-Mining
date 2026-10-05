import assert from 'node:assert/strict';
import test from 'node:test';
import { SparseWorld, regionOf, sampleXYZ, WORLD_GENERATION } from '../../src/game/terrain/SparseWorld.ts';
import {initialExcavationDepth} from '../../src/game/world/SurfaceExcavation.ts';
import { ROOMS } from '../../src/game/world/rooms.ts';
import { inEntrance, PROTECTED_FLOOR } from '../../src/game/world/entrance.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { TerrainStream } from '../../src/game/validation/TerrainStream.ts';
import { CharacterPhysics, initPhysics, PLAYER, STEP } from '../../src/game/validation/physics.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';

test('surface excavation and every camp floor retain the same 64 mineable columns',()=>{
 const w=new SparseWorld();let baseline;
 for(const y of [-1,...ROOMS.map(r=>-r.depth/2-1)]){
  const cells=[];const extent=y===-1?[-48,51]:[-10,9];
  for(let x=extent[0];x<=extent[1];x++)for(let z=extent[0];z<=extent[1];z++){
   const c=[x,y-(y===-1?initialExcavationDepth(x,z):0),z];assert.ok(w.cell(c));
   if(w.canMine(c))cells.push([x,z]);else assert.equal(w.cell(c),PROTECTED_FLOOR);
  }
  assert.equal(cells.length,64);if(baseline)assert.deepEqual(cells,baseline);baseline=cells;
 }
 for(const r of ROOMS){assert.equal(r.x,0);assert.equal(r.z,0);assert.equal(inEntrance(Math.floor(r.spawn[0]/2),Math.floor(r.spawn[2]/2)),false);}
});
test('one-cell floor protection allows sideways excavation immediately below it',()=>{
 const w=new SparseWorld();
 for(const y of [-1,-201,-401])for(const x of [-5,4]){
  const floor=[x,y,0],below=[x,y-1,0];assert.equal(w.canMine(floor),false);assert.equal(w.canMine(below),true);
  assert.deepEqual(w.remove([floor,below]),[below]);assert.equal(w.cell(floor),PROTECTED_FLOOR);assert.equal(w.cell(below),0);
  for(const size of [8,16]){const staged=w.snapshot(regionOf(floor,size),size,[floor]);assert.equal(sampleXYZ(...floor,new Map(staged)),PROTECTED_FLOOR);}
 }
 // Room floors do not introduce an invisible full-width barrier outside the room.
 assert.ok(w.canMine([30,-201,30]));assert.ok(w.canMine([30,-401,30]));
});
test('protected floor is not a combat resource and consumes no HP, cooldown or capacity',()=>{
 const w=new SparseWorld(),s=new GameSession();
 s.attach({cell:c=>w.cell(c),canMine:c=>w.canMine(c),pending:()=>false,mine:cs=>w.remove(cs).length>0,cancelMining:()=>{},returnToSurface:()=>{}});
 const c=[5,-1,0];s.selectTarget(c);assert.equal(s.getSnapshot().target,null);assert.equal(s.blockHealth(c),null);
 const before=s.combatDebug().nextAttackAt;assert.equal(s.hit(c).status,'unavailable');
 assert.equal(s.combatDebug().nextAttackAt,before);assert.equal(s.combatDebug().damagedCells,0);assert.equal(s.getSnapshot().inventory.used,0);
});
test('ordinary test shaft is absent in production and remains explicit in fixture world',()=>{
 assert.equal(new SparseWorld().cell([-12,-1,0]),PROTECTED_FLOOR);
 assert.equal(new SparseWorld({...WORLD_GENERATION,samples:true}).cell([-12,-1,0]),0);
});
test('stream batch filters protected floors before either mesh staging or rewards',async()=>{
 await initPhysics();const p=new CharacterPhysics(false),workers=[],receipts=[];
 const factory=()=>{const w={requests:[],onmessage:null,onerror:null,onmessageerror:null,postMessage(job){this.requests.push(job)},terminate(){}};workers.push(w);return w};
 const s=new TerrainStream(p,factory,r=>receipts.push(...r));
 const drain=()=>{for(let i=0;i<400;i++){
  s.process();for(const w of workers){const job=w.requests.shift();if(job)w.onmessage({data:{id:job.id,epoch:job.epoch,transaction:job.transaction,results:job.regions.map(r=>({version:r.version,data:buildRegion(job.kind,r.coord,job.size,r.edits,job.generation)}))}})}
  const v=s.snapshot();if(!v.queue&&!v.inFlight&&!v.pendingEdit)return;
 }throw Error('drain timeout')};
 try{
  s.recenter([0,.1,0]);drain();assert.equal(s.mineMany([[5,-1,0]]),false);
  assert.ok(s.mineMany([[5,-1,0],[3,-1,0],[4,-2,0]]));drain();
  assert.equal(s.cell([5,-1,0]),PROTECTED_FLOOR);assert.equal(s.cell([3,-1,0]),0);assert.equal(s.cell([4,-2,0]),0);
  assert.equal(receipts.length,2);assert.ok(receipts.every(r=>r.kind!==PROTECTED_FLOOR));
 }finally{s.dispose();p.dispose()}
});

test('production flat home route remains walkable without covering the 8 by 8 entrance',async()=>{
 await initPhysics();const p=new CharacterPhysics(false);
 const {RAPIER}=await import('../../src/game/validation/physics.ts');
 p.world.createCollider(RAPIER.ColliderDesc.cuboid(80,.5,80).setTranslation(0,-.5,0));
 try{
  for(let i=0;i<30;i++)p.tick(0,0,0,false,true);
  const walkingSteps=Math.ceil((p.feet()[2]-6.5+1)/(PLAYER.speed*STEP))+30;
  for(let i=0;i<walkingSteps&&p.feet()[2]>6.5;i++)p.tick(0,1,0,false,true);
  assert.ok(p.feet()[2]<7);assert.ok(p.feet()[1]<.1);assert.ok(p.grounded);
 }finally{p.dispose()}
});

test('initial uneven pit has real air and solid floors in both worker queries without player edits',()=>{
 const w=new SparseWorld(),heights=new Set();let air=0;
 for(let x=-4;x<=3;x++)for(let z=-4;z<=3;z++){
  const depth=initialExcavationDepth(x,z);heights.add(depth);
  for(let y=-1;y>=-depth;y--){
   const c=[x,y,z];assert.equal(w.cell(c),0);air++;
   for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(w.snapshot(regionOf(c,size),size))),0);
  }
  assert.ok(w.canMine([x,-depth-1,z]));
 }
 assert.deepEqual([...heights].sort(),[0,1,2,3,4]);assert.ok(air>40&&air<150);
 assert.equal(w.revision,0);assert.equal(w.removed,0);assert.equal(w.stats().editBytes,0);
 assert.ok(new SparseWorld({...WORLD_GENERATION,samples:true}).cell([0,-1,0]));
});

test('character lands on the generated deep pocket, without an invisible surface collider',async()=>{
 await initPhysics();const p=new CharacterPhysics(false);const {RAPIER}=await import('../../src/game/validation/physics.ts');
 try{
  for(const x of [-1,0])for(const z of [-1,0]){
   const m=buildRegion('collision',[x,-1,z],8,[],WORLD_GENERATION).mesh;
   p.world.createCollider(RAPIER.ColliderDesc.trimesh(m.positions,m.indices,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setTranslation(x*16,-16,z*16));
  }
  p.teleport([1,.1,-1]);for(let i=0;i<160;i++)p.tick(0,0,0,false,true);
  assert.ok(p.grounded);assert.ok(Math.abs(p.feet()[1]+8)<.08,JSON.stringify(p.feet()));
 }finally{p.dispose();}
});
