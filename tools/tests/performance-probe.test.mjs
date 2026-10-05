import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformanceProbe,PROBE_STAGES} from '../../src/game/presentation/PerformanceProbe.ts';
import {PerformanceMeter} from '../../src/game/presentation/PerformanceMeter.ts';
const sample={sampleMs:500,rafFps:60,fps:60,logicCpuMs:2,renderCpuMs:4};
test('probe excludes warm-up, weights measurement windows and restores normal after all stages',()=>{
 const probe=new PerformanceProbe(0);
 for(let i=0;i<PROBE_STAGES.length;i++){
  assert.equal(probe.mode,PROBE_STAGES[i].mode);
  for(let t=500;t<=6000;t+=500)probe.record(i*6000+t,{...sample,rafFps:t<=2000?2:60});
  const result=probe.results[i];assert.equal(result.raf,60);assert.equal(result.milliseconds,3500);assert.equal(result.samples,7);
 }
 assert.equal(probe.done,true);assert.equal(probe.mode,'normal');assert.equal(probe.results.length,6);
 assert.equal(probe.record(40000,sample),false);
});
test('a long stalled frame cannot be recorded as a valid warmed measurement',()=>{
 const probe=new PerformanceProbe(0);probe.record(6100,{...sample,sampleMs:6100});
 assert.equal(probe.results[0].samples,0);assert.equal(probe.results[0].milliseconds,0);
});
test('intentionally stopping drawing retains RAF and does not claim GPU backpressure',()=>{
 const meter=new PerformanceMeter();meter.record(0,0,false,0,0);
 let result;for(let i=1;i<=30;i++){meter.recordRaf(true);result=meter.record(i*1000/60,1,false,0,0,undefined,0,true);}
 assert.ok(Math.abs(result.rafFps-60)<.001);assert.equal(result.fps,0);assert.equal(result.skipPercent,0);assert.equal(result.renderCpuMs,null);
});
