import fs from 'node:fs';
import assert from 'node:assert/strict';
if(!process.argv[2])throw Error('Usage: node light-study/tools/analyze-dynamic-report.mjs <saved-report.json>');
const saved=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),r=saved.report,b=r.scene.benchmark;
if(!b)throw Error('Report has no automatic comparison');
const close=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
let auditedFrames=0;
for(const f of [...b.rounds.flatMap(r=>r.frames),...(b.motion?.gpuFrames??[])]){
 if(f.gpu===null)continue;
 const passes=f.gpuPasses,ordered=passes.map(p=>[p.startMs,p.endMs]).sort((a,b)=>a[0]-b[0]);
 const start=ordered[0][0],end=Math.max(...ordered.map(p=>p[1]));let cursor=start,union=0;
 for(const [a,z] of ordered){if(z>cursor){union+=z-Math.max(a,cursor);cursor=z;}}
 const sum=passes.reduce((n,p)=>n+p.ms,0);close(f.gpu,end-start);
 if(f.gpuPassSumMs!==undefined){close(f.gpuPassSumMs,sum);close(f.gpuOverlapMs,Math.max(0,sum-union));}
 auditedFrames++;
}
const groups=new Map();for(const row of b.rounds){const key=row.pose+'/'+row.mode;const g=groups.get(key)??{pose:row.pose,mode:row.mode,values:[]};g.values.push(...row.frames.map(f=>f.gpu).filter(v=>v!==null));groups.set(key,g);}
const median=values=>{const a=values.slice().sort((a,b)=>a-b);return a.length?(a[(a.length-1)>>1]+a[a.length>>1])/2:null;};
const result={id:saved.id,build:r.build,device:r.device,viewport:r.latestFrame.context.viewport,target:b.target,auditedFrames,
 motion:b.motion?(({gpuFrames,...rest})=>rest)(b.motion):null,
 variants:[...groups.values()].map(g=>({pose:g.pose,mode:g.mode,samples:g.values.length,medianMs:median(g.values)})),
 bytes:Buffer.byteLength(JSON.stringify(r)),hardwareAcceptance:'Compare genuine iPhone same-resolution motion data with target; software results are not acceptance.'};
console.log(JSON.stringify(result,null,2));
