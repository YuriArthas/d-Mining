import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSpawnTerrain } from '../../src/game/validation/prepareSpawnTerrain.ts';
import { TerrainStream } from '../../src/game/validation/TerrainStream.ts';
import { CharacterPhysics, initPhysics } from '../../src/game/validation/physics.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';
await initPhysics();
class Worker {
 onmessage=null;onerror=null;onmessageerror=null;closed=false;requests=0;
 constructor(mode='normal'){this.mode=mode}
 postMessage(job){this.requests++;if(this.mode==='silent')return;
  setTimeout(()=>{
   if(this.closed)return;
   if(this.mode==='error'){this.onerror?.({message:'worker startup failed'});return;}
   this.onmessage?.({data:{id:job.id,epoch:job.epoch,transaction:job.transaction,results:job.regions.map(r=>({version:r.version,data:buildRegion(job.kind,r.coord,job.size,r.edits,job.generation)}))}});
  },0);
 }
 terminate(){this.closed=true;}
}
function setup(mode){const physics=new CharacterPhysics(),workers=[];const terrain=new TerrainStream(physics,()=>{const w=new Worker(mode);workers.push(w);return w});return {physics,terrain,workers,dispose(){terrain.dispose();physics.dispose()}}}
test('spawn terrain becomes ready without any render frame or physics tick',async()=>{
 const f=setup(),controller=new AbortController(),progress=[];
 try{await prepareSpawnTerrain(f.terrain,f.physics.feet(),controller.signal,(done,total)=>progress.push([done,total]));
  assert.equal(f.physics.steps,0);assert.ok(f.terrain.ready(f.physics.feet()));assert.equal(f.terrain.snapshot().queue,0);assert.equal(f.terrain.snapshot().inFlight,false);
  assert.ok(progress.length>1);assert.deepEqual(progress.at(-1),[progress[0][1],progress[0][1]]);
  f.physics.tick(0,0,0,false,true);assert.ok(f.terrain.collision.handles.size>0);
 }finally{f.dispose()}
});
test('startup cancellation stops pumping and permits disposal while worker replies are pending',async()=>{
 const f=setup('silent'),controller=new AbortController();
 try{const pending=prepareSpawnTerrain(f.terrain,f.physics.feet(),controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});
  const requests=f.workers.map(w=>w.requests);await new Promise(r=>setTimeout(r,10));assert.deepEqual(f.workers.map(w=>w.requests),requests);
 }finally{f.dispose()}
});
test('worker errors and stalled startup reject instead of leaving a permanent loading label',async()=>{
 for(const mode of ['error','silent']){const f=setup(mode);try{
  await assert.rejects(prepareSpawnTerrain(f.terrain,f.physics.feet(),new AbortController().signal,undefined,20),mode==='error'?/worker startup failed/:/地形准备超时/);
 }finally{f.dispose()}}
});
