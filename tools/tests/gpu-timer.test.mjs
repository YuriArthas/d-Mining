import test from 'node:test';
import assert from 'node:assert/strict';
import {GpuTimer} from '../../src/game/presentation/GpuTimer.ts';
function harness(supported=true){
 const gl={QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,active:null,deleted:0,created:0,disjoint:false,available:false,lost:false,
 getExtension:()=>supported?{TIME_ELAPSED_EXT:3,GPU_DISJOINT_EXT:4}:null,isContextLost(){return this.lost;},getParameter(){return this.disjoint;},
 createQuery(){this.created++;return {ms:this.created};},beginQuery(_target,q){assert.equal(this.active,null,'timer queries cannot nest');this.active=q;},endQuery(){assert.ok(this.active);this.active=null;},
 getQueryParameter(q,property){if(property===1)return this.available;assert.ok(this.available,'never fetch unavailable results');return q.ms*1e6;},deleteQuery(){this.deleted++;}};
 return {gl,timer:new GpuTimer(gl)};
}
test('main/reflection GPU segments are non-overlapping and consumed asynchronously',()=>{
 const {gl,timer}=harness();timer.beginFrame();timer.segment('reflection');timer.segment('main');timer.endFrame();
 timer.poll();assert.equal(timer.snapshot().samples,0);assert.equal(gl.created,3);
 gl.available=true;timer.poll();assert.equal(timer.snapshot().mainMs,4);assert.equal(timer.snapshot().reflectionMs,2);assert.equal(timer.snapshot().totalMs,6);assert.equal(gl.deleted,3);
 timer.dispose();assert.equal(gl.deleted,3);
});
test('query queue is bounded and disjoint timings discarded, unsupported devices stay explicit',()=>{
 const {gl,timer}=harness();for(let i=0;i<100;i++){timer.beginFrame();timer.segment('reflection');timer.segment('main');timer.endFrame();}
 assert.equal(timer.snapshot().pending,8);assert.equal(gl.created,24);
 gl.disjoint=true;timer.poll();assert.equal(gl.deleted,24);assert.equal(timer.snapshot().totalMs,null);assert.equal(timer.snapshot().pending,0);
 timer.dispose();const no=harness(false);no.timer.beginFrame();no.timer.endFrame();assert.equal(no.timer.snapshot().supported,false);assert.equal(no.gl.created,0);
});

test('disabled GPU timing makes no capability lookup or synchronous result queries',()=>{
 const gl=new Proxy({}, {get(){throw Error('GPU API accessed while timing is disabled');}});
 const timer=new GpuTimer(gl,false);timer.beginFrame();timer.segment('reflection');timer.segment('main');timer.endFrame();timer.poll();
 assert.equal(timer.snapshot().enabled,false);assert.equal(timer.snapshot().samples,0);timer.dispose();
});
