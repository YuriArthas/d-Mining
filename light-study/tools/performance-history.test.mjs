import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PerformanceHistory,packHistory,statistics,HISTORY_CAPACITY} from '../src/performanceHistory.ts';
import {CpuStageTimer} from '../src/cpuTiming.ts';
export const fixture=(frame=1)=>({frame,startedAtMs:frame*16,cpu:2,completionMs:8,gpu:null,gpuPassSumMs:null,gpuOverlapMs:null,draws:48,passes:8,
 reason:frame===1?'startup':'interaction',cpuOutsideStagesMs:.5,newPipelines:0,newPrograms:0,cpuStages:[{label:'Lighting',inclusiveMs:1.5,exclusiveMs:1.5}],
 context:{motion:'off',movingLight:{seconds:0,position:[.65,1.12,7]},lightMode:'night',view:'entrance',ao:true,shadowMode:'static visibility atlas',renderMode:'optimized',postMode:'optimized',probe:'none',camera:{position:[1,2,3],target:[0,0,-10]},viewport:{width:390,height:655,dpr:1.5,bufferWidth:585,bufferHeight:982}}});
const gpu=f=>Object.assign(f,{gpu:5,gpuPassSumMs:8,gpuOverlapMs:3,gpuPasses:[{label:'Lighting',samples:4,ms:5,startMs:0,endMs:5},{label:'Composite',samples:1,ms:3,startMs:2,endMs:5}]});
test('ring retains 1800 ordered frames; idle and export do not expire or clear history',()=>{
 const h=new PerformanceHistory();for(let i=1;i<=2000;i++)h.add(fixture(i));
 assert.equal(h.size,1800);assert.equal(h.values()[0].frame,201);assert.equal(h.values().at(-1).frame,2000);
 const a=h.export();assert.equal(a.history.frameCount,1800);assert.deepEqual(h.export(),a);
 const click=fixture(2001);click.startedAtMs+=600000;click.reason='report';h.add(click);
 assert.equal(h.values()[0].frame,202);assert.equal(h.export().history.summary.find(s=>s.reason==='interaction').cpu.count,1799);
});
test('statistics use nearest-rank P95, midpoint median, and preserve missing GPU values',()=>{
 assert.deepEqual(statistics([null,null]),{count:0,median:null,p95:null,max:null});
 assert.deepEqual(statistics([1,3,null,2,44]),{count:4,median:2.5,p95:44,max:44});
});
test('settings, startup and report frames never contaminate interaction statistics',()=>{
 const frames=[fixture(1),gpu(fixture(2)),fixture(3),fixture(4),fixture(5)];
 frames[0].cpu=1000;frames[2].context.lightMode='day';frames[3].reason='settings';frames[4].reason='report';frames[4].cpu=2000;
 const p=packHistory(frames);assert.equal(p.history.contexts.length,2);
 assert.equal(p.history.summary.find(s=>s.reason==='interaction'&&s.context===0).cpu.median,2);
 assert.equal(p.history.summary.find(s=>s.reason==='interaction'&&s.context===0).gpu.count,1);
 assert.equal(p.history.summary.find(s=>s.reason==='interaction'&&s.context===1).gpu.count,0);
 assert.equal(p.history.rows[2][6],null);
});
test('one upload preserves worst CPU/completion frames, sampled intervals, and the whole compact history within the body budget',()=>{
 const frames=Array.from({length:HISTORY_CAPACITY},(_,i)=>{
  const f=fixture(i+1);f.context.camera.position=[Math.sin(i),Math.cos(i),i/17];
  f.cpuStages=Array.from({length:8},(_,j)=>({label:`stage ${j}`,inclusiveMs:.2+j/100,exclusiveMs:.1}));
  if(i%15===0)gpu(f);return f;
 });
 frames[33].cpu=44;frames[61].completionMs=56;
 const p=packHistory(frames);assert.equal(p.history.rows.length,1800);assert.ok(p.recentFrames.length<=150);
 assert.ok(p.recentFrames.some(f=>f.frame===34));assert.ok(p.recentFrames.some(f=>f.frame===62));
 assert.equal(p.history.gpuSampleCount,120);assert.ok(Buffer.byteLength(JSON.stringify(p))<1024*1024);
 // Stress distinct viewport settings too: no loss of original frame context.
 frames.forEach((f,i)=>f.context.viewport.width=400+i);
 assert.ok(Buffer.byteLength(JSON.stringify(packHistory(frames)))<2*1024*1024);
});
test('nested CPU stages use exclusive attribution and reject incomplete instrumentation',()=>{
 const t=new CpuStageTimer();t.begin('a','composite',0);t.begin('b','lighting',2);t.begin('c','normals',3);t.end('c',5);t.end('b',8);t.end('a',10);
 assert.deepEqual(t.finish(),[{label:'normals',inclusiveMs:2,exclusiveMs:2},{label:'lighting',inclusiveMs:6,exclusiveMs:4},{label:'composite',inclusiveMs:10,exclusiveMs:4}]);
 assert.equal(t.finish().reduce((a,s)=>a+s.exclusiveMs,0),10);
 t.reset();t.begin('a','stage',0);assert.throws(()=>t.finish(),/incomplete/);assert.throws(()=>t.end('b',1),/mismatch/);
});

test('animation positions stay per frame without splitting settings, while paused/off modes remain distinct',()=>{
 const frames=[fixture(1),fixture(2),fixture(3)];
 frames.forEach((f,i)=>{f.reason='animation';f.context.motion='moving';f.context.movingLight={seconds:i,position:[.65,1.12,7-i]};});
 const h=new PerformanceHistory();frames.forEach(f=>h.add(f));
 const p=h.export(2);assert.equal(p.history.rows.length,2);assert.equal(p.history.contexts.length,1);
 assert.deepEqual(p.history.rows[1].slice(21),[1,.65,1.12,6]);assert.equal(p.history.summary[0].cpu.count,2);
 frames[2].context.motion='paused';assert.equal(h.export().history.contexts.length,2);
});
