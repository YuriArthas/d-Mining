import { pathToFileURL } from 'node:url';
import { STAGES, EGG_STAGES, upgradePrice } from '../../src/game/content/progression.ts';
import { LAYERS } from '../../src/game/content/layers.ts';
import { resourceByKind } from '../../src/game/content/resources.ts';
import { PET_CONTENT } from '../../src/game/content/pets.ts';
import { BACKPACK_TIERS } from '../../src/game/application/BackpackUpgrade.ts';
import { pickaxeStats } from '../../src/game/logic/Pickaxe.ts';
import { calculateMiningStats, drawEgg } from '../../src/game/logic/pets/petRules.ts';
import { generatedMineral } from '../../src/game/terrain/strata.ts';

export function simulate({policy='normal', seed=1, stages=7, maxSeconds=72*3600}={}) {
  let rng=seed>>>0;
  const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  let level=1,coins=0,bag=50,used=0,value=0,elapsed=0,block=0;
  const owned=[], purchases=[], milestones=[], breakdown={farm:0,shaft:0,aim:0,sale:0,menu:0};
  const stats=()=>calculateMiningStats(pickaxeStats(level),{powerBonusBps:owned.slice().sort((a,b)=>b-a).slice(0,3).reduce((a,b)=>a+b,0)});
  const addTime=(key,sec)=>{elapsed+=sec;breakdown[key]+=sec;};
  // Routing approximation: nearest room sale via surface-return/teleport and
  // re-entry, plus increasing distance from the room. These are explicit input
  // assumptions, not real navigation or playtest measurements.
  const sell=(stage,depthOffset=40)=>{
    if(!used)return;
    addTime('sale', (policy==='casual'?38:18) + depthOffset/12);
    coins+=value;used=0;value=0;
  };
  const mine=(kind,mode,stage,offset=40)=>{
    let ore=resourceByKind(kind);
    if((ore.requiredLevel??0)>level){ // revealed locked ore: take the adjacent host block
      ore=resourceByKind(LAYERS[stage].base);addTime('aim',1);
    }
    if(used>=bag)sell(stage,offset);
    const s=stats();addTime(mode,Math.ceil(ore.maxHp/s.power)/s.speed);
    addTime('aim',policy==='casual'?.8:.4);
    used+=ore.volume;value+=ore.price;block++;
  };
  for(let i=0;i<Math.min(stages,STAGES.length);i++){
    const stage=STAGES[i],start=elapsed,phasePurchases=purchases.length;
    const eggs=PET_CONTENT.eggs.filter(e=>EGG_STAGES[e.id][0]===i);
    const draws=new Map();
    const buy=()=>{
      if(policy==='no-upgrades')return;
      for(let n=0;n<50;n++){
        const nextBag=BACKPACK_TIERS.find(b=>b.capacity>bag&&b.capacity<=stage.capacity);
        const egg=policy==='no-pets'?null:eggs.find(e=>(draws.get(e.id)??0)<(policy==='casual'?6:3)
          && (!EGG_STAGES[e.id][1] || level>=stage.entryLevel+Math.floor((stage.exitLevel-stage.entryLevel)/2)));
        const price=upgradePrice(level);
        let action=null,spent=0;
        if(nextBag&&coins>=nextBag.price){bag=nextBag.capacity;action='bag';spent=nextBag.price;}
        else if(egg&&coins>=egg.price){const species=drawEgg(egg,random());owned.push(PET_CONTENT.pets.find(p=>p.id===species).powerBonusBps);draws.set(egg.id,(draws.get(egg.id)??0)+1);spent=egg.price;action=egg.id;addTime('menu',eggs.indexOf(egg)===0&&(draws.get(egg.id)===1)?35:5);}
        else if(level<stage.exitLevel&&coins>=price){level++;spent=price;action='pickaxe';}
        if(!action)break;
        coins-=spent;addTime('menu',2);purchases.push({minute:elapsed/60,stage:i+1,action,spent,level,power:stats().power});
      }
    };
    // Observable recommendation policy: build the displayed stage equipment.
    // Optimizer may leave earlier if the remaining shaft is already cheap.
    const ready=()=>level>=stage.exitLevel || policy==='direct'||policy==='no-upgrades'
      || (policy==='efficient' && Math.ceil(resourceByKind(stage.deepKind).maxHp/stats().power)*50/stats().speed<600);
    while(!ready()&&elapsed<maxSeconds){
      buy();if(ready())break;
      // Mine a deterministic shallow frontier. Efficient players compare only
      // six newly visible candidates, never future RNG or unrevealed positions.
      const x=(block%41)-20,z=Math.floor(block/41)%41-20,y=-i*200-20-Math.floor(block/1681)%90;
      let kind=generatedMineral(x,y,z,0);
      if(policy==='efficient'){
        const s=stats();let best=-1;
        for(let j=0;j<6;j++){
          const k=generatedMineral(x+j,y,z,0),r=resourceByKind(k);
          if((r.requiredLevel??0)>level)continue;
          const score=r.price/(Math.ceil(r.maxHp/s.power)/s.speed+.4+r.volume/bag*22);
          if(score>best){best=score;kind=k;}
        }
      }
      mine(kind,'farm',i);
      if(used>=bag){sell(i);buy();}
    }
    if(elapsed>=maxSeconds)return {policy,seed,completed:false,elapsedMinutes:elapsed/60,milestones,purchases,breakdown};
    for(let depth=0;depth<380;depth+=2){
      const kind=generatedMineral(0,-i*200-depth/2-1,0,0);
      mine(kind,'shaft',i,depth);
      if(elapsed>=maxSeconds)break;
      if(used>=bag){sell(i,depth);buy();}
    }
    if(elapsed>=maxSeconds)return {policy,seed,completed:false,elapsedMinutes:elapsed/60,milestones,purchases,breakdown};
    addTime('aim',5);sell(i,380);
    milestones.push({layer:i+2,minutes:elapsed/60,segmentMinutes:(elapsed-start)/60,level,power:stats().power,coins,bag,
      purchases:purchases.length-phasePurchases,breakdown:{...breakdown}});
    if(elapsed>=maxSeconds)break;
  }
  return {policy,seed,completed:milestones.length===stages,elapsedMinutes:elapsed/60,milestones,purchases,breakdown};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const policies=process.argv.includes('--all')?['normal','efficient','casual','no-pets','direct','no-upgrades']:['normal'];
  for(const policy of policies)console.log(JSON.stringify(simulate({policy,seed:Number(process.env.BALANCE_SEED??1)})));
}
