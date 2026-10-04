import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderSubmission } from '../../src/game/presentation/RenderSubmission.ts';
function context(){return {SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,WAIT_FAILED:3,status:2,lost:false,deleted:0,flushes:0,
 fenceSync:()=>({}),clientWaitSync(condition,flags,timeout){assert.equal(timeout,0);return this.status},deleteSync(){this.deleted++},flush(){this.flushes++},isContextLost(){return this.lost}}}
test('GPU backpressure allows simulation to continue without queuing more draws',()=>{
 const gl=context(),gate=new RenderSubmission(gl);let logic=0,draws=0;
 for(let i=0;i<100;i++){logic++;gate.draw(()=>draws++);}
 assert.equal(logic,100);assert.equal(draws,1);assert.equal(gl.flushes,1);assert.equal(gate.snapshot().skipped,99);
 gl.status=4;gate.draw(()=>draws++);assert.equal(draws,2);assert.equal(gl.deleted,1);
 gate.dispose();assert.equal(gl.deleted,2);assert.equal(gate.snapshot().inFlight,false);
});
test('context restoration creates a fresh fence, failed synchronization is surfaced',()=>{
 const gl=context(),gate=new RenderSubmission(gl);let draws=0;
 gate.draw(()=>draws++);gl.lost=true;gate.draw(()=>draws++);assert.equal(draws,1);assert.equal(gate.snapshot().inFlight,false);
 gl.lost=false;gate.draw(()=>draws++);assert.equal(draws,2);
 gl.status=gl.WAIT_FAILED;assert.throws(()=>gate.draw(()=>draws++),/GPU/);assert.equal(draws,2);assert.equal(gate.snapshot().inFlight,false);
});
