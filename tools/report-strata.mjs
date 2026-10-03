import { STRATA } from '../src/game/terrain/strata.ts';
import { oreDefinition } from '../src/game/application/items.ts';
import { pickaxeStats } from '../src/game/logic/Pickaxe.ts';
// Sustained mining estimates only; excludes travel, aiming, streaming, overshoot
// and upgrade choices. The initial immediate strike is amortized over a run.
const report=STRATA.map(layer=>{
 const weights=[...layer.ores,{kind:layer.base,weight:100-layer.ores.reduce((s,o)=>s+o.weight,0)}];
 const mean=read=>weights.reduce((n,o)=>n+read(oreDefinition(o.kind))*o.weight/100,0);
 const volume=mean(o=>o.volume),price=mean(o=>o.price),hp=mean(o=>o.maxHp);
 return {layer:layer.name,meanVolume:volume,meanPrice:price,meanHp:hp,coinsPerCapacity:price/volume,
  gear:[1,6,11,16].map(level=>{const {power,speed}=pickaxeStats(level),secondsPerBlock=mean(o=>Math.ceil(o.maxHp/power))/speed;
   return {level,power,speed,secondsPerBlock,secondsPer200Blocks:200*secondsPerBlock,approxSecondsToFill50:50/volume*secondsPerBlock,approxCoinsPer50Capacity:50/volume*price};})};
});
console.log(JSON.stringify({assumptions:'Expected sustained mining only, not measured playtime or final balance',report},null,2));
