import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderSubmission } from '../../src/game/presentation/RenderSubmission.ts';
function context(){return {SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,WAIT_FAILED:3,status:2,lost:false,deleted:0,flushes:0,
 fenceSync:()=>({}),clientWaitSync(condition,flags,timeout){assert.equal(timeout,0);return this.status},deleteSync(){this.deleted++},flush(){this.flushes++},isContextLost(){return this.lost}}}
test('GPU backpressure allows simulation to continue without queuing more draws',()=>{
 const gl=context(),gate=new RenderSubmission(gl,1,'fenced');let logic=0,draws=0;
 for(let i=0;i<100;i++){logic++;gate.draw(()=>draws++);}
 assert.equal(logic,100);assert.equal(draws,1);assert.equal(gl.flushes,1);assert.equal(gate.snapshot().skipped,99);
 gl.status=4;gate.draw(()=>draws++);assert.equal(draws,2);assert.equal(gl.deleted,1);
 gate.dispose();assert.equal(gl.deleted,2);assert.equal(gate.snapshot().inFlight,false);
});
test('context restoration creates a fresh fence, failed synchronization is surfaced',()=>{
 const gl=context(),gate=new RenderSubmission(gl,2,'fenced');let draws=0;
 gate.draw(()=>draws++);gl.lost=true;gate.draw(()=>draws++);assert.equal(draws,1);assert.equal(gate.snapshot().inFlight,false);
 gl.lost=false;gate.draw(()=>draws++);assert.equal(draws,2);
 gl.status=gl.WAIT_FAILED;assert.throws(()=>gate.draw(()=>draws++),/GPU/);assert.equal(draws,2);assert.equal(gate.snapshot().inFlight,false);
});

test('two bounded frames overlap without an unlimited queue; drain before applying smaller limit',()=>{
 const gl=context(),gate=new RenderSubmission(gl,2,'fenced');let draws=0;
 for(let i=0;i<100;i++)gate.draw(()=>draws++);
 assert.equal(draws,2);assert.equal(gate.snapshot().queued,2);assert.equal(gate.snapshot().skipped,98);
 gate.setMaxInFlight(1);assert.equal(gate.draw(()=>draws++),false);
 gl.status=4;gate.draw(()=>draws++);assert.equal(gl.deleted,2);assert.equal(draws,3);assert.equal(gate.snapshot().queued,1);
 gate.dispose();assert.equal(gl.deleted,3);assert.throws(()=>gate.setMaxInFlight(3));
});
test('a failed render adds no fence; dispose deletes every outstanding fence',()=>{
 const gl=context(),gate=new RenderSubmission(gl,2,'fenced');
 assert.throws(()=>gate.draw(()=>{throw Error('render');}),/render/);assert.equal(gate.snapshot().queued,0);
 gate.draw(()=>{});gate.draw(()=>{});gate.dispose();gate.dispose();assert.equal(gl.deleted,2);
});

test('browser-managed RAF submits without fence creation, polling, or explicit flush',()=>{
 const gl=context();gl.fenceSync=gl.clientWaitSync=gl.flush=()=>{throw Error('synchronous GPU API on normal path');};
 const gate=new RenderSubmission(gl);let draws=0;
 for(let i=0;i<120;i++)assert.equal(gate.draw(()=>draws++),true);
 assert.equal(draws,120);assert.equal(gate.snapshot().mode,'browser');assert.equal(gate.snapshot().queued,0);assert.equal(gate.snapshot().waitCpuMs,0);
 gl.lost=true;assert.equal(gate.draw(()=>draws++),false);assert.equal(draws,120);
});
test('switching from fenced to browser presentation releases old fences',()=>{
 const gl=context(),gate=new RenderSubmission(gl,2,'fenced');gate.draw(()=>{});gate.draw(()=>{});
 gate.setMode('browser');assert.equal(gl.deleted,2);assert.equal(gate.snapshot().queued,0);assert.equal(gate.draw(()=>{}),true);
});
