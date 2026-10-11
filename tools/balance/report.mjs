import { writeFile, mkdir } from 'node:fs/promises';
import { simulate } from './simulate.mjs';
const runs=[];
for(const policy of ['normal','efficient','casual'])for(let seed=1;seed<=9;seed++)runs.push(simulate({policy,seed}));
const quantile=(values,p)=>values.sort((a,b)=>a-b)[Math.round((values.length-1)*p)];
const summary=['normal','efficient','casual'].map(policy=>{
 const selected=runs.filter(r=>r.policy===policy);
 return {policy,mapSeed:0,eggSeeds:[1,2,3,4,5,6,7,8,9],
  totalMinutes:[.1,.5,.9].map(p=>quantile(selected.map(r=>r.elapsedMinutes),p)),
  segmentMedians:Array.from({length:7},(_,i)=>quantile(selected.map(r=>r.milestones[i].segmentMinutes),.5)),
  longestPurchaseGapMinutes:Math.max(...selected.flatMap(r=>r.purchases.map((event,i)=>event.minute-(r.purchases[i-1]?.minute??0)))),
 };
});
await mkdir('artifacts/progression',{recursive:true});
await writeFile('artifacts/progression/balance-runs.json',JSON.stringify({summary,runs},null,2));
console.log(JSON.stringify(summary,null,2));
