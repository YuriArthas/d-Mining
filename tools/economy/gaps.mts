// The longest stretches without an effective upgrade, for two seeds.
import * as D from './model.mts';
const E=D.loadEconomy(),plan=D.loadPlan();
for(const seed of [3,8]){const r=D.simulate(E,plan,seed,true);const ev=r.ev.map(e=>[parseFloat(e),e] as const);const g:[number,string,string][]=[];
for(let k=1;k<ev.length;k++)g.push([ev[k][0]-ev[k-1][0],ev[k-1][1],ev[k][1]]);g.sort((a,b)=>b[0]-a[0]);
console.log('seed',seed,g.slice(0,8).map(x=>`${x[0].toFixed(1)}m: ${x[1]} -> ${x[2]}`).join(' ; '));}
