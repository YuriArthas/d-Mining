import assert from 'node:assert/strict';
import test from 'node:test';
import { TerrainStream } from '../../src/game/validation/TerrainStream.ts';
import { CharacterPhysics, initPhysics } from '../../src/game/validation/physics.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';
import { Inventory } from '../../src/game/logic/Inventory.ts';
import { Mining } from '../../src/game/application/Mining.ts';
import { oreDrops } from '../../src/game/application/items.ts';
import { chunkKey, regionOf, WORLD_GENERATION } from '../../src/game/terrain/SparseWorld.ts';
await initPhysics();
class WorkerProbe {
 requests=[];onmessage=null;onerror=null;onmessageerror=null;terminated=false;
 postMessage(job){this.requests.push(job);assert.ok(this.requests.length<=1,'unbounded worker queue');}
 flush(){const job=this.requests.shift();if(!job)return false;const results=job.regions.map(r=>({version:r.version,data:buildRegion(job.kind,r.coord,job.size,r.edits,job.generation)}));this.onmessage?.({data:{id:job.id,epoch:job.epoch,transaction:job.transaction,results}});return true;}
 terminate(){this.terminated=true;}
}
function setup(onExcavated){const p=new CharacterPhysics();p.teleport([0,2.1,16]);const workers=[],stream=new TerrainStream(p,()=>{const w=new WorkerProbe();workers.push(w);return w;},onExcavated,{...WORLD_GENERATION,samples:true});stream.recenter(p.feet());return {p,stream,workers};}
function drain(s,workers){for(let i=0;i<500;i++){s.process();for(const w of workers)w.flush();const v=s.snapshot();if(!v.pendingEdit&&!v.inFlight&&!v.queue)return;}throw new Error('stream did not drain');}
function finish(f){f.stream.dispose();assert.ok(f.workers.every(w=>w.terminated));f.p.dispose();}
test('render and physics have independent windows; logical data exists without either cache',()=>{
 const f=setup();try{const {stream:s,workers:w}=f;assert.ok(s.cell([40,-100,40]));assert.equal(s.snapshot().cellBytes,0);drain(s,w);
 assert.ok(s.ready(f.p.feet()));assert.ok(s.render.pipeline.residents.size>s.collision.pipeline.residents.size);
 const oldKey=chunkKey(regionOf([0,-1,8],8));assert.ok(s.collision.pipeline.residents.has(oldKey));
 s.recenter([60,2,16],true);drain(s,w);assert.equal(s.collision.pipeline.residents.has(oldKey),false);
 assert.ok(s.render.pipeline.residents.has('0,-1,0'),'old nearby surface remains rendered beyond physics window');
 assert.ok(s.snapshot().physicsUnloaded>0);assert.equal(s.snapshot().cellBytes,0);
 }finally{finish(f);}
});
test('batched excavation keeps source and active colliders unchanged until both layers prepare',()=>{
 const f=setup();try{const {stream:s,workers:w,p}=f;drain(s,w);const cells=[[0,-1,0],[1,-1,0],[2,-1,0],[7,-1,0],[8,-1,0],[15,-1,0],[16,-1,0]];
 const oldHandles=[...s.collision.handles];for(const c of cells)assert.ok(s.mine(c));assert.equal(s.mine(cells[0]),false);s.process();
 // Collision worker finishes first; render worker deliberately remains outstanding.
 for(let i=0;i<10;i++){w[1].flush();s.process();}
 assert.ok(cells.every(c=>s.cell(c)>0));assert.deepEqual([...s.collision.handles],oldHandles);
 for(const stage of s.collision.pipeline.staged.values())if(stage.resource?.collider)assert.equal(stage.resource.collider.isEnabled(),false);
 drain(s,w);assert.ok(cells.every(c=>s.cell(c)===0));assert.equal(s.snapshot().committedEdits,cells.length);assert.equal(s.snapshot().revision,1);
 p.world.step();for(const h of s.collision.handles)assert.ok(p.world.getCollider(h).isEnabled());
 for(const c of cells)assert.equal(s.mine(c),false);
 assert.ok(s.snapshot().editBytes<512);
 }finally{finish(f);}
});
test('travel cancels staged edits and discards delayed replies without resurrecting old terrain',()=>{
 const f=setup();try{const {stream:s,workers:w}=f;drain(s,w);assert.ok(s.mine([1,-1,1]));s.process();
 s.relocate([0,-1999.9,0]);for(const worker of w)worker.flush();drain(s,w);
 assert.ok(s.cell([1,-1,1]));assert.equal(s.snapshot().committedEdits,0);assert.ok(s.snapshot().staleResults>0);
 assert.ok(s.mine([0,-1001,0]));drain(s,w);s.relocate([90,.1,90]);drain(s,w);s.relocate([0,-1999.9,0]);drain(s,w);assert.equal(s.cell([0,-1001,0]),0);
 }finally{finish(f);}
});
test('pending input is bounded and drains in immutable batches without duplicate commits',()=>{
 const f=setup();try{const {stream:s,workers:w}=f;drain(s,w);let accepted=0;
 for(let x=0;x<40;x++)if(s.mine([x,-2,5]))accepted++;assert.equal(accepted,32);drain(s,w);
 assert.equal(s.snapshot().committedEdits,32);assert.equal(s.snapshot().revision,4);assert.equal(s.snapshot().pendingCells,0);
 }finally{finish(f);}
});
test('movement during construction extends transaction dependencies to newly wanted regions',()=>{
 const f=setup();try{const {stream:s,workers:w}=f;drain(s,w);
 assert.ok(s.mine([31,-1,0]));s.process();s.recenter([64,.1,0],true);drain(s,w);
 assert.equal(s.cell([31,-1,0]),0);for(const item of s.collision.pipeline.residents.values())assert.ok(s.collision.pipeline.has(item.coord));
 }finally{finish(f);}
});

test('12-cell collection spans worker jobs; admission checks once, committed rewards ignore later full state',()=>{
 const bag=new Inventory(1),receipts=[];let mining;
 const f=setup(resources=>{assert.ok(resources.every(r=>f.stream.cell(r.cell)===0));receipts.push(resources);mining.collected(resources)});
 mining=new Mining(bag,targets=>f.stream.mineMany(targets),oreDrops);
 try{drain(f.stream,f.workers);
 const cells=Array.from({length:12},(_,x)=>[x,-1,-25]);
 assert.equal(mining.request([...cells,cells[0],[0,1,0]]),'accepted');
 f.stream.process();bag.add([{itemId:'gift',count:3}]);
 for(let i=0;i<10;i++){f.workers[1].flush();f.stream.process();}
 assert.equal(bag.getSnapshot().used,3);assert.ok(cells.every(c=>f.stream.cell(c)>0));
 drain(f.stream,f.workers);assert.equal(receipts.length,1);assert.equal(receipts[0].length,12);assert.equal(bag.getSnapshot().used,15);
 assert.equal(f.stream.snapshot().revision,1);assert.equal(mining.request([[15,-1,-25]]),'full');assert.ok(f.stream.cell([15,-1,-25])>0);
 f.stream.process();assert.equal(bag.getSnapshot().used,15);
 }finally{finish(f);}
});
test('cancelled and late terrain results do not reward; cancellation preserves committed edits',()=>{
 const receipts=[],f=setup(resources=>receipts.push(resources));
 try{drain(f.stream,f.workers);assert.ok(f.stream.mineMany([[0,-1,-25],[1,-1,-25]]));drain(f.stream,f.workers);
 assert.equal(receipts.length,1);assert.ok(f.stream.mineMany([[2,-1,-25],[3,-1,-25]]));f.stream.process();f.stream.cancelPending();
 drain(f.stream,f.workers);assert.equal(receipts.length,1);assert.equal(f.stream.cell([0,-1,-25]),0);assert.ok(f.stream.cell([2,-1,-25])>0);
 assert.ok(f.stream.mineMany([[2,-1,-25],[3,-1,-25]]));drain(f.stream,f.workers);assert.equal(receipts.length,2);
 }finally{finish(f);}
});

test('combat damage survives streaming; actual removal alone awards and clears HP', async()=>{
 const {GameSession}=await import('../../src/game/application/GameSession.ts');
 let now=0;const session=new GameSession(1,()=>now),receipts=[];
 const f=setup(resources=>{receipts.push(resources);session.collected(resources)}),s=f.stream;
 session.attach({cell:c=>s.cell(c),pending:c=>s.pending(c),mine:cs=>s.mineMany(cs),cancelMining:()=>s.cancelPending(),returnToSurface:()=>{}});
 try{
  drain(s,f.workers);const c=[8,-1,-25];assert.equal(session.blockHealth(c),90);
  const before=s.snapshot();assert.equal(session.hit(c).status,'hit');drain(s,f.workers);
  assert.equal(session.blockHealth(c),80);assert.equal(s.snapshot().revision,before.revision);assert.equal(receipts.length,0);
  s.relocate([0,-1999.9,0]);drain(s,f.workers);assert.equal(session.blockHealth(c),80);
  s.relocate([17,.1,-47]);drain(s,f.workers);for(let i=1;i<8;i++){now=i*.5;assert.equal(session.hit(c).status,'hit')}
  now=4;assert.equal(session.hit(c).status,'breaking');s.process();
  // An independent completed collection fills the bag while this destruction is prepared.
  session.collected([{kind:1}]);
  for(let i=0;i<10;i++){f.workers[1].flush();s.process();}
  assert.ok(s.cell(c));assert.equal(session.blockHealth(c),0);assert.equal(session.getSnapshot().inventory.used,1);
  drain(s,f.workers);assert.equal(s.cell(c),0);assert.equal(receipts.length,1);assert.equal(session.getSnapshot().inventory.used,6);
  assert.equal(session.combatDebug().damagedCells,0);assert.equal(session.blockHealth(c),null);
 }finally{finish(f)}
});
test('cancelled lethal strike keeps sparse damage and retries without duplicate rewards',async()=>{
 const {GameSession}=await import('../../src/game/application/GameSession.ts');
 let now=0;const session=new GameSession(50,()=>now),receipts=[];
 const f=setup(resources=>{receipts.push(resources);session.collected(resources)}),s=f.stream;
 session.attach({cell:c=>s.cell(c),pending:c=>s.pending(c),mine:cs=>s.mineMany(cs),cancelMining:()=>s.cancelPending(),returnToSurface:()=>{}});
 try{
  drain(s,f.workers);const c=[0,-1,-25];assert.equal(session.hit(c).status,'breaking');s.process();
  s.relocate([0,-1999.9,0]);drain(s,f.workers);assert.ok(s.cell(c));assert.equal(receipts.length,0);assert.equal(session.blockHealth(c),0);
  assert.equal(session.hit(c).status,'cooldown');now=.5;
  assert.deepEqual(session.hit(c),{status:'breaking',remaining:0,damage:0});drain(s,f.workers);
  assert.equal(receipts.length,1);assert.equal(session.getSnapshot().inventory.used,1);assert.equal(session.combatDebug().damagedCells,0);
  assert.equal(session.hit(c).status,'unavailable');drain(s,f.workers);assert.equal(receipts.length,1);
 }finally{finish(f)}
});
