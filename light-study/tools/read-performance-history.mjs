import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Deliberately require a report file; never mix users, sessions, or QA cohorts.
if(!process.argv[2])throw Error('Usage: node light-study/tools/read-performance-history.mjs /path/to/report.json');
const saved=JSON.parse(await readFile(resolve(process.argv[2]),'utf8')),r=saved.report;
if(![2,3].includes(r.schemaVersion))throw Error('This reader expects schemaVersion 2 or 3; legacy cohort analysis uses analyze-iphone-reports.py');
const h=r.history;
const frames=h.rows.map(row=>{
 const f=Object.fromEntries(h.columns.map((key,i)=>[key,row[i]]));
 f.context=h.contexts[f.settings];
 f.cpuStages=f.cpuStages.map(([id,inclusiveMs,exclusiveMs])=>({label:h.stageLabels[id],inclusiveMs,exclusiveMs}));
 return f;
});
const interactions=frames.filter(f=>(f.reason==='interaction'||f.reason==='animation'));
console.log(JSON.stringify({id:saved.id,receivedAt:saved.receivedAt,sessionId:r.sessionId,build:r.build,device:r.device,frames:h.frameCount,gpuSamples:h.gpuSampleCount,
 benchmark:['district-pipeline-comparison','district-cost-comparison'].includes(r.scene.benchmark?.type)?{...r.scene.benchmark,rounds:r.scene.benchmark.rounds.map(({gpuFrames,frameIntervalsMs,...s})=>({...s,gpuFrameCount:gpuFrames.length,intervalCount:frameIntervalsMs.length}))}:['static-continuous','district-tour'].includes(r.scene.benchmark?.type)?(({gpuFrames,frameIntervalsMs,...summary})=>({...summary,gpuFrameCount:gpuFrames.length,intervalCount:frameIntervalsMs.length}))(r.scene.benchmark):r.scene.benchmark?{
  target:r.scene.benchmark.target,protocol:r.scene.benchmark.protocol,
  motion:r.scene.benchmark.motion?(({gpuFrames,...summary})=>summary)(r.scene.benchmark.motion):null,
  rounds:r.scene.benchmark.rounds.map(({frames,...summary})=>summary),
 }:null,
 summary:h.summary.map(s=>({...s,settings:h.contexts[s.context]})),
 worstCpu:interactions.slice().sort((a,b)=>b.cpu-a.cpu).slice(0,5),
 worstCompletion:interactions.slice().sort((a,b)=>b.completionMs-a.completionMs).slice(0,5),
 pipelineCreationFrames:frames.filter(f=>f.newPipelines||f.newPrograms),
 errors:r.scene.errors,
},null,2));
