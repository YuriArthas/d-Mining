import assert from 'node:assert/strict';
import {test} from 'node:test';
import {summarizeBenchmark,summarizeMotion,dynamicShadowModes} from '../src/dynamicBenchmark.ts';
const fixture=(frame)=>({frame,startedAtMs:frame*16,cpu:2,completionMs:8,draws:48,passes:16,cpuOutsideStagesMs:.5,newPipelines:0,newPrograms:0,context:{lightMode:'night',view:'entrance',ao:true,shadowMode:'static visibility atlas',renderMode:'optimized',postMode:'optimized',probe:'none',camera:{position:[1,2,3],target:[0,0,-10]},viewport:{width:390,height:655,dpr:1.5,bufferWidth:585,bufferHeight:982}}});
import {packHistory} from '../src/performanceHistory.ts';
const passes=Array.from({length:16},(_,i)=>({label:i<6?`Point Light Shadow [ Moving lantern screen visibility ] - Face ${i+1}`:`Pass ${i}`,samples:1,ms:1.23456789,startMs:i*.456789012,endMs:i*.456789012+1.23456789}));
const frame=i=>({...fixture(i),reason:'animation',gpu:i%15===0?4:null,gpuPassSumMs:i%15===0?16:null,gpuOverlapMs:i%15===0?12:null,gpuPasses:i%15===0?passes:undefined,cpuStages:passes.map(p=>({label:p.label,inclusiveMs:.987654321,exclusiveMs:.123456789})),context:{...fixture(i).context,dynamicShadow:'screen',shadowGeometry:'spatial',scheduler:'pipelined',benchmarkPhase:'route/measure',motion:'moving',movingLight:{seconds:i/60,position:[.65,1.12,7-Math.cos(i/60)*10]}}});
test('controlled variants keep independent statistics and retain raw overlapping GPU intervals',()=>{
 const a=frame(15),b={...frame(30),gpu:8};
 const summaries=summarizeBenchmark([{mode:'screen',pose:'entrance',round:0,frames:[a,b]},{mode:'off',pose:'entrance',round:0,frames:[{...a,gpu:null}]}]);
 assert.equal(summaries[0].gpu.median,6);assert.equal(summaries[0].gpu.p95,8);assert.deepEqual(summaries[0].frames[0].gpuPasses,passes);assert.equal(summaries[1].gpu.count,0);
 const route=summarizeMotion([a,b,{...frame(45),newPrograms:1},{...frame(60),reason:'settings'}]);
 assert.equal(route.frames,2);assert.equal(route.excludedFrames,2);assert.equal(route.gpu.median,6);assert.equal(route.gpuFrames.length,2);
});
test('full history, maximum comparison and route detail fit the server 2 MiB body limit',()=>{
 const frames=Array.from({length:1800},(_,i)=>frame(i+1));
 const rounds=[];for(let round=0;round<2;round++)for(const pose of ['entrance','raised-middle'])for(const mode of dynamicShadowModes){
  rounds.push({round,pose,mode,frames:Array.from({length:10},(_,i)=>({...frame(i),gpu:4,gpuPasses:passes}))});
 }
 const body={schemaVersion:3,latestFrame:frames.at(-1),scene:{benchmark:{motion:summarizeMotion(frames),rounds:summarizeBenchmark(rounds)}},...packHistory(frames)};
 const bytes=Buffer.byteLength(JSON.stringify(body));assert.ok(bytes<2*1024*1024-65536,`body ${bytes} bytes leaves too little space for device/scene metadata`);
});
