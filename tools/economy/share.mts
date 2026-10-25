// Pet vs tool share of income growth inside each world, and a second run after a rebirth (pets and slots kept).
import * as D from './model.mts';
const E=D.loadEconomy(),plan=D.loadPlan(),run=D.simulate(E,plan,3);
for(let w=0;w<3;w++){const s=E.layers[w*7],e=E.layers[w*7+6],exit=E.tools[(w+1)*10-1];
 const inc=(l:typeof s,power:number,speed:number)=>l.rock.price/(Math.ceil(l.rock.hp/power)/speed+.35);
 const team=1+run.pets.filter(p=>p.w===w).map(p=>p.b).sort((a,b)=>b-a).slice(0,w===0?3:w===1?4:5).reduce((a,b)=>a+b,0);
 const tg=inc(e,exit.enhance.at(-1)?.power??exit.power,exit.speed)/inc(s,E.tools[s.gate-1].power,E.tools[s.gate-1].speed);
 console.log(`world ${w+1}: tool side x${tg.toFixed(0)}, pets x${team.toFixed(0)}, pet share ${(Math.log(team)/(Math.log(team)+Math.log(tg))*100).toFixed(0)}%`);}
for(const count of [1,2,3]){const m=1+count*E.rebirth.stepPct/100,r=D.simulate(E,plan,4,false,run.pets,m,run.slots);
 console.log(`rebirth ${count} (x${m}): worlds`,[1,2,3].map(w=>((r.arrive[w*7]-r.arrive[(w-1)*7])/60).toFixed(0)).join('/'),'total',(r.arrive[21]/60).toFixed(0),'min');}
