import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformanceMeter} from '../../src/game/presentation/PerformanceMeter.ts';

test('HUD counts submitted frames under GPU backpressure, not simulation or reflection passes',()=>{
 const meter=new PerformanceMeter();meter.record(0,0,false,0,0);let result;
 for(let i=1;i<=30;i++)result=meter.record(i*1000/60,4,i%2===0,1200,500000);
 assert.ok(Math.abs(result.fps-30)<.001);assert.ok(Math.abs(result.frameMs-1000/30)<.001);
 assert.equal(result.cpuMs,4);assert.equal(result.calls,1200);assert.equal(result.triangles,500000);
 // No completed new submissions must display zero, never the old nominal 60 FPS.
 for(let i=31;i<=60;i++)result=meter.record(i*1000/60,1,false,9999,999999);
 assert.equal(result.fps,0);assert.equal(result.frameMs,null);assert.equal(result.calls,1200);
});

test('render CPU is not diluted by skipped frames; simulation has a separate denominator',()=>{
 const meter=new PerformanceMeter();meter.record(0,0,false,0,0);
 meter.record(100,12,true,100,500,{renderCpuMs:10,reflectionCpuMs:4,mainCalls:60,reflectionCalls:40});
 meter.record(200,2,false,0,0);
 meter.record(300,2,false,0,0);
 meter.record(400,2,false,0,0);
 const result=meter.record(500,12,true,100,500,{renderCpuMs:10,reflectionCpuMs:4,mainCalls:60,reflectionCalls:40});
 assert.equal(result.logicCpuMs,2);assert.equal(result.renderCpuMs,10);assert.equal(result.reflectionCpuMs,4);assert.equal(result.skipPercent,60);
 assert.equal(result.mainCalls,60);assert.equal(result.reflectionCalls,40);
});

test('browser RAF, limiter skips and GPU skips have separate denominators',()=>{
 const meter=new PerformanceMeter();meter.record(0,0,false,0,0);let result;
 for(let i=1;i<=30;i++){
  const scheduled=i%3!==0;meter.recordRaf(scheduled);
  if(scheduled)result=meter.record(i*1000/60,1,i%2===0,10,20);
 }
 // Flush on a scheduled timestamp at 500 ms for an exact common window.
 result=meter.record(500,1,false,10,20);
 assert.equal(result.rafFps,60);assert.ok(Math.abs(result.scheduleSkipPercent-100/3)<1e-8);
 assert.equal(result.fps,20);assert.ok(result.skipPercent>50);assert.equal(result.waitCpuMs,0);
});
