// Joint price/health/carry report. Pure read; does not recalibrate or mutate content.
import {writeFileSync} from 'node:fs';
import {ECONOMY as E} from '../../src/game/content/economy.ts';
import {simulate,loadPlan,seeds,median} from './model.mts';
const runs=seeds.map(seed=>simulate(E,loadPlan(),seed,true));
const layers=E.layers.map((l,i)=>{
 const tool=E.tools[l.gate-1],bag=E.bags[l.gate-1],m=2,speed=Math.min(8,tool.speed*m),power=tool.power*tool.speed*m/speed;
 let seconds=0,value=0,volume=0;
 const wt=l.ores.reduce((a,o)=>a+o.weight,0);
 for(const [block,chance] of [[l.rock,1-l.oreChance],...l.ores.map(o=>[o,l.oreChance*o.weight/wt] as const)] as const){
  seconds+=chance*(Math.ceil(block.hp/power)/speed+Math.max(0,.45-1/speed));value+=chance*block.price;volume+=chance*block.volume;
 }
 const count=Math.ceil(bag.capacity/volume);
 return {world:l.world,layer:l.layer,rockHp:l.rock.hp,rockVolume:l.rock.volume,denseVolume:l.deep.volume,oreChance:l.oreChance,orePrices:l.ores.map(o=>o.price),tool:l.gate,bag:bag.capacity,loadSeconds:+(count*seconds).toFixed(1),loadBaseCoins:+(count*value).toFixed(1),medianLayerMinutes:+median(runs.map(r=>(r.arrive[i+1]-r.arrive[i])/60)).toFixed(1)};
});
const report={assumptions:{capacity:'gate tool; +100% pet mining; before sale bonuses; expected ore mix (not sampled terrain)',progression:'15 pet/capsule seeds; average ore mix; player locks required ticket minerals, sells surplus; 2x2 descent; 120-minute play days'},worlds:[1,2,3].map(w=>{const a=runs.map(r=>(r.arrive[w*7]-r.arrive[(w-1)*7])/60).sort((a,b)=>a-b);return {world:w,p10:a[1],p50:a[7],p90:a[13]}}),firstPurchases:runs[0].ev.slice(0,20),layers};
writeFileSync(process.argv[2]??'output/economy-carry/model.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.worlds));
