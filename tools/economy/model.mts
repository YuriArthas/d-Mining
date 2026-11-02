// The economy model. `build` turns the design parameters below into src/game/content/economy.json, the one table
// the game reads every economic number from; `simulate` plays a typical player through that table (and only that
// table, plus plan.json: how many pulls of each egg the player aims for), so hand edits to the JSON show up in
// `report`. Commands:
//   node tools/economy/model.mts calibrate   tune the per-layer budgets K to TARGET, write k3.json, plan.json, economy.json
//   node tools/economy/model.mts export      rebuild economy.json and plan.json from k3.json
//   node tools/economy/model.mts report      simulate economy.json and print arrival times and upgrade gaps
// Player knobs: AIM (s per block spent re-aiming), SELL (s per trip to sell; default: the measured trip of each world),
// PM (pull multiplier), DAY (minutes played per day: the daily lucky coins), UI (s per menu choice), CAPSULE=0.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LAYER_ITEMS } from '../../src/game/content/journeyResources.ts';
import { EGG_DEFINITIONS } from '../../src/game/content/pets.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { worldPortal } from '../../src/game/content/worldJourney.ts';

const ECONOMY_FILE = new URL('../../src/game/content/economy.json', import.meta.url);
const K_FILE = new URL('./k3.json', import.meta.url), PLAN_FILE = new URL('./plan.json', import.meta.url);
const AIM=+(process.env.AIM??.35), PM=+(process.env.PM??1);
const SELL=process.env.SELL?+process.env.SELL:null;
export const N=21; export const world=(i:number)=>Math.floor(i/7), local=(i:number)=>i%7;
/** Two significant figures: 468 -> 470, 4 680 -> 4 700, never below 1. */
export const nice=(x:number)=>{if(x<10)return Math.max(1,Math.round(x));const p=10**(Math.floor(Math.log10(x))-1);return Math.round(x/p)*p;};

// ---- design parameters ------------------------------------------------------------------------------------------
const CURRENCIES=[{id:'gold',name:'msg.gold_bbece6f8'},{id:'tech',name:'msg.tech_coins'},{id:'star',name:'msg.star_crystals'}] as const;
// tool: 30 levels. Swing speed 2 -> 8 (4x) over world 1, then flat; damage x1.5 per level, nice-rounded.
const SWING=[2,2.5,3,3.5,4,5,6,7,8];
const ENH={step:.12,max:3,cost:[.3,.45,.6]};
const toolPower=(L:number,e=0)=>nice(10*1.5**(L-1)*(1+ENH.step*e)), toolSpeed=(L:number)=>SWING[Math.min(L-1,SWING.length-1)];
// the tool level each layer needs; leaving worlds 1 and 2 needs L10 / L20 (the next world's first gate)
const GATES=[[1,2,3,5,6,8,9],[10,11,12,13,14,16,18],[20,21,22,23,24,26,28]];
const gate=(i:number)=>GATES[world(i)][local(i)];
// rest-room depths (m) of each world's layers: world 1 shallow first so layers 2 and 3 come at about 7 and 15 min
const DEPTHS=[[0,60,140,260,420,620,860],[0,400,800,1200,1600,2000,2400],[0,400,800,1200,1600,2000,2400]];
// Each layer's way down ends in a cap over the next hall's ceiling (2026-10-29: the first layer was dug through in
// half a minute with the first pickaxe; the old dense 30 % lay mostly inside the hall below): CAP_CELLS of hard
// rock across the layer. Any pickaxe digs it, at its own damage (2026-10-31: the levels gate only the ores). It was
// timed on a one-block shaft; a player digs down a hole of HOLE columns (2×2), four times the blocks, and
// ten minutes in had not got through world 1's first cap. Now that hole through a cap takes CAP_SECONDS with the
// pickaxe a player carries down (the next layer's, for its ores).
const CAP_CELLS=8, CAP_SECONDS=200, HOLE=4;
/** Metres from a layer's top to the ceiling of the hall under it (the halls' rooms, in the game's content). */
const hallCeiling=(i:number)=>DEPTHS[world(i)][local(i)+1]-DEPTHS[world(i)][local(i)]-GAME_CONTENT.worlds[world(i)].rooms[local(i)].height*2;
// Each world has its own currency; ore values restart there. Adjacent layers start around 3x,
// then accelerate. Base rock always sells for one; its volume tracks its health (20 HP per slot).
const ORE_GROWTH=[[3,3,3.5,4,4.5,5],[3,3.5,4,4.5,5,6],[3.5,4,4.5,5,6,7]];
const ORE_VALUE=ORE_GROWTH.map(ratios=>{const values=[3];for(const ratio of ratios)values.push(nice(values.at(-1)!*ratio));return values;});
const V=(i:number)=>ORE_VALUE[world(i)][local(i)]/3;
const rockVolume=(hp:number)=>nice(hp/20);
const HP=(i:number)=>i===0?20:nice(5*toolPower(gate(i)));
// a cap block: CAP_SECONDS / (CAP_CELLS · HOLE) of the next layer's pickaxe's damage per second (no cap on a world's
// last layer)
const capHp=(i:number)=>local(i)<6?nice(CAP_SECONDS/(CAP_CELLS*HOLE)*toolPower(gate(i+1))*toolSpeed(gate(i+1))):nice(5*HP(i));
const blocks=(i:number)=>({rock:{hp:HP(i),v:1},a:{hp:nice(2*HP(i)),v:nice(3*V(i))},b:{hp:nice(3*HP(i)),v:nice(6*V(i))},deep:{hp:capHp(i),v:1}});
// Ore share: 4.5..7 %. The user requested another halving of the existing rounded 9..14 % table (2026-11-02).
const ORE_CHANCE=(i:number)=>Math.round((.09+.05*local(i)/6)*1000)/2000, ORE_WEIGHTS=[12,10];
// eggs: one per layer; long layers of worlds 2 and 3 add a premium egg (pets x2, price x4)
type Slot={layer:number;premium:boolean};
const SLOTS:Slot[]=[];for(let i=0;i<N;i++){SLOTS.push({layer:i,premium:false});if((world(i)===1&&local(i)>=4)||(world(i)===2&&local(i)>=2))SLOTS.push({layer:i,premium:true});}
const RAR=[1,1.2,1.6,2.3,3.5],WT=[40,30,20,8,2];
const bonusPct=(s:Slot,r:number)=>nice(100*0.5*2.5**local(s.layer)*(s.premium?2:1)*RAR[r]);
// every pet also mines faster in every world (swing speed up to the 4× cap, then damage). 2026-11-02, the user: three
// pets should add about what the pickaxe does, or a little more. A typical team (the model's player, a golden or two
// among them) adds about +90..200 % in world 1 (it was +25..80 %); slow-growing across the journey, so more slots and
// goldens, not the layer, make the later teams stronger, and old pets still help early in the next world. The ore
// levels stay the pickaxe's.
const miningPct=(s:Slot,r:number)=>nice(15*1.03**s.layer*(s.premium?1.5:1)*RAR[r]);
const GOLD={need:5,bonusMultiplier:2.5};
// Capacity follows expected occupied units per mining second, using health, ore chance, tool stats,
// a representative +100% mining pet team and a 45-second load. Starter: 25 x one-slot surface rock.
function bagCapacities(){
 const capacities:number[]=[];
 for(let tier=1;tier<=30;tier++){
  const ww=Math.floor((tier-1)/10),i=Array.from({length:7},(_,k)=>ww*7+k).filter(i=>gate(i)<=tier).at(-1)!;
  const b=blocks(i),c=ORE_CHANCE(i),power=toolPower(tier),speed=toolSpeed(tier),m=2,actualSpeed=Math.min(8,speed*m),hit=power*speed*m/actualSpeed;
  let seconds=0,volume=0;
  for(const [block,q,v] of [[b.rock,1-c,rockVolume(b.rock.hp)],[b.a,c*12/22,1],[b.b,c*10/22,1]] as const){
   seconds+=q*(Math.ceil(block.hp/hit)/actualSpeed+Math.max(0,.45-1/actualSpeed));volume+=q*v;
  }
  capacities.push(tier===1?25:nice(Math.max(capacities.at(-1)!*1.25,volume/seconds*45)));
 }
 return capacities;
}
const BAG=bagCapacities();
// pet slots: 3, +1 in world 2 (layer 3), +1 in world 3 (layer 3)
const SLOT_LAYERS=[10,17];
// world tickets: the next world's price in this world's currency (budgeted) plus minerals of earlier worlds
const TICKET_MATERIALS:Record<number,{layer:number;ore:number;count:number}[]>={
  2:[{layer:3,ore:1,count:20},{layer:5,ore:1,count:15},{layer:6,ore:1,count:10}],
  3:[{layer:6,ore:0,count:30},{layer:11,ore:1,count:20},{layer:13,ore:1,count:15}],
};
// Each world's shops: its surface (layer 0) and the halls of layers 2 and 4, every one with its own shelf. A pickaxe is
// sold at the deepest of them a player has reached when the model buys it (on the layer whose way out needs it), so
// the furthest shop open always has the next pickaxe; a bag stands with the pickaxe of its rank.
const SHOP_LAYERS=[0,2,4];
const exitOf=(k:number)=>local(k)<6?gate(k+1):(world(k)+1)*10;
const shopLayer=(L:number)=>{const k=Array.from({length:N},(_,i)=>i).find(i=>exitOf(i)>=L)!;return [...SHOP_LAYERS].reverse().find(x=>x<=local(k))!;};
const CAPSULE_SECONDS=120;   // the capsule's coin prize: about this much income at the deepest layer reached
// minutes per layer for a typical player (layer i -> i+1; the last of each world: to the next world / the end)
const TARGET=[7,8,12,15,18,25,35, 12,20,30,38,42,46,52, 18,30,45,58,65,70,74];

// ---- build: parameters -> economy.json ------------------------------------------------------------------------
export type Economy=ReturnType<typeof build>['economy'];
export type Plan={pulls:number[]};
function arrivalIncome(i:number){const L=gate(i),power=toolPower(L),speed=toolSpeed(L),b=blocks(i),c=ORE_CHANCE(i);
  const prev=SLOTS.filter(e=>e.layer<i&&world(e.layer)===world(i)&&!e.premium).at(-1);const team=prev?1+3*1.2*bonusPct(prev,0)/100:1;
  let v=0,tt=0;for(const [x,q] of [[b.rock,1-c],[b.a,c*12/22],[b.b,c*10/22]] as const){v+=q*x.v;tt+=q*(Math.ceil(x.hp/power)/speed+AIM);}const volume=(1-c)*rockVolume(b.rock.hp)+c;const cap=BAG[Math.min(29,Math.max(0,L-1))];return v/(tt+sellTrip(world(i),local(i))/Math.max(1,Math.ceil(cap/volume)))*team;}
export function build(K:number[]){
  const tool=new Array(31).fill(0),egg=SLOTS.map(()=>0),portal=[0,0,0,0],slot=[0,0];
  for(const [k,e] of SLOTS.entries()){const base=arrivalIncome(e.layer)*Math.min(90,TARGET[e.layer]*6)/(e.layer===0?3:1);egg[k]=nice(Math.max(10,base*(e.premium?4:1)));}
  const pulls=SLOTS.map((e,k)=>{const i=e.layer,B=K[i]*V(i)*(1-(local(i)===6&&world(i)<2?.2:0)-(SLOT_LAYERS.includes(i)?.15:0))*.6,two=SLOTS.filter(x=>x.layer===i).length>1;
    return Math.max(e.premium?1:3,Math.min(25,Math.round(B*(two?(e.premium?.4:.6):1)/egg[k])));});
  for(let i=0;i<N;i++){const exit=local(i)<6?gate(i+1):(world(i)+1)*10,lv:number[]=[];for(let L=gate(i)+1;L<=exit;L++)lv.push(L);
    const exitShare=local(i)===6&&world(i)<2?.2:0,slotShare=SLOT_LAYERS.includes(i)?.15:0,B=K[i]*V(i);
    const eggSpend=SLOTS.map((e,k)=>e.layer===i?pulls[k]*egg[k]:0).reduce((a,b)=>a+b,0);
    const toolB=Math.max(B/4,B*(1-exitShare-slotShare)-eggSpend);
    lv.forEach((L,j)=>tool[L]=nice(Math.max(10,toolB*(1+.25*j)/lv.reduce((a,_,q)=>a+1+.25*q,0))));
    if(exitShare)portal[world(i)+2]=nice(B*exitShare);
    if(slotShare)slot[SLOT_LAYERS.indexOf(i)]=nice(B*slotShare);}
  for(let L=3;L<=30;L++)if(L%10!==1)tool[L]=nice(Math.max(tool[L],tool[L-1]*1.25));
  const bag=BAG.map((_,t)=>{if(t===0)return 0;const ww=Math.floor(t/10),i=Array.from({length:7},(_,k)=>ww*7+k).find(i=>exitOf(i)>=t+1)??ww*7+6;return nice(arrivalIncome(i)*30);});
  for(let t=1;t<30;t++)if(t%10)bag[t]=nice(Math.max(bag[t],bag[t-1]*1.25));
  const currency=(w:number)=>CURRENCIES[w].id;
  const eggDefinition=(s:Slot)=>EGG_DEFINITIONS.find(d=>d.world===world(s.layer)+1&&d.layer===local(s.layer)&&d.premium===s.premium)??null;
  for(const d of EGG_DEFINITIONS)if(!SLOTS.some(s=>eggDefinition(s)===d))throw Error(`蛋没有对应的层: ${d.id}`);
  const economy={
    currencies:CURRENCIES.map((c,w)=>({...c,world:w+1})),
    start:{toolLevel:1,bagTier:1,petSlots:3},
    worlds:[1,2,3].map(id=>({id,currency:currency(id-1),ticket:id===1?null:{currency:currency(id-2),price:portal[id],toolLevel:(id-1)*10,
      materials:TICKET_MATERIALS[id].map(m=>({itemId:LAYER_ITEMS[m.layer].ores[m.ore].itemId,count:m.count,world:world(m.layer)+1,layer:local(m.layer)}))}})),
    layers:Array.from({length:N},(_,i)=>{const b=blocks(i),items=LAYER_ITEMS[i],from=DEPTHS[world(i)][local(i)],cells=local(i)<6?(DEPTHS[world(i)][local(i)+1]-from)/2:0;
      return {world:world(i)+1,layer:local(i),from,deepAt:cells?hallCeiling(i)-CAP_CELLS*2:null,gate:gate(i),oreChance:ORE_CHANCE(i),
        capsuleCoins:nice(CAPSULE_SECONDS*arrivalIncome(i)),
        rock:{itemId:items.rock.itemId,hp:b.rock.hp,price:b.rock.v,volume:rockVolume(b.rock.hp)},deep:{itemId:items.deep.itemId,hp:b.deep.hp,price:b.deep.v,volume:rockVolume(b.deep.hp)},
        ores:[b.a,b.b].map((o,j)=>({itemId:items.ores[j].itemId,hp:o.hp,price:o.v,volume:1,weight:ORE_WEIGHTS[j]}))};}),
    tools:Array.from({length:30},(_,k)=>{const L=k+1;return {level:L,currency:currency(Math.floor(k/10)),shop:shopLayer(L),price:L===1?0:tool[L],power:toolPower(L),speed:toolSpeed(L),
      // enhancements cost a share of the next pickaxe; the last of a world (L10, L20) has its next one in another
      // currency, so its share is of this one's price grown like a level (×1.5)
      enhance:L<30?ENH.cost.map((cost,e)=>({price:nice((L%10?tool[L+1]:tool[L]*1.5)*cost),power:toolPower(L,e+1)})):[]};}),
    bags:BAG.map((capacity,t)=>({tier:t+1,currency:currency(Math.floor(t/10)),shop:shopLayer(t+1),price:bag[t],capacity})),
    petSlots:SLOT_LAYERS.map((i,k)=>({slot:4+k,currency:currency(world(i)),price:slot[k],world:world(i)+1,layer:local(i)})),
    eggs:SLOTS.map((s,k)=>{const d=eggDefinition(s);return {id:d?.id??null,world:world(s.layer)+1,layer:local(s.layer),premium:s.premium,currency:currency(world(s.layer)),price:egg[k],
      pets:WT.map((weight,r)=>({id:d?.pets[r][0]??null,weight,bonusPct:bonusPct(s,r),miningPct:miningPct(s,r)}))};}),
    golden:GOLD,
    rebirth:{world:3,layer:6,toolLevel:30,stepPct:50},
    capsule:{spinCost:1,timedSeconds:300,movementMultiplier:2,miningSpeedMultiplier:1.5,luckMultiplier:2,sellMultiplier:2,
      prizes:[{id:'coins',weight:65},{id:'speed',weight:10},{id:'mining',weight:5},{id:'sell',weight:5},{id:'autoHatch',weight:5},{id:'luck',weight:10}]},
    luckyCoins:{signin:[1,1,1,2,2,2,3],online:[{minutes:5,coins:1},{minutes:10,coins:1},{minutes:20,coins:2},{minutes:30,coins:3}],share:1,invite:2},
  };
  return {economy,plan:{pulls} as Plan};
}

// ---- the player's time outside the swings (P6, docs/phase-economy-calibration-20261029.md) -----------------------
// Measured (docs/phase-economy-calibration-20261029.md): on the public build, the sell button's trip (teleport, sold
// on entering the ring) 0.2 s and the station's trip to a hall 0.8 s; the rest with the game's own logic and no
// rendering (measure-headless.mts), a bot playing stretches of layers in each world. The swing cadence is exact
// (AttackCooldown), so the player's re-aim (AIM, an assumption) overlaps the wait for the next swing: a block costs
// its swings plus whatever of AIM and MOVE (stepping to the next face, the broken block's removal) outlasts one swing.
const SOLD=.2, TELEPORT=.8, TAP=.5, WALK=6, MOVE=.1;
const UI=+(process.env.UI??1.5);                          // s per menu choice: a hall at the station, a shop row
const DAY=+(process.env.DAY??120)*60;                      // s played per day: the daily lucky coins
const CAPSULE=process.env.CAPSULE!=='0';                     // CAPSULE=0: no lucky coins (to see what they are worth)
// a pull: the reveal by rarity (EggSheet HATCH_MS: 1.0 / 1.4 / 2.0 / 2.0 s, ≈1.2 s by the odds) and the press
const HATCH=2;
// on foot to the teleport station from where the sell, shop and egg buttons land the player (world 1 over the bridge)
const SURFACE=[{sale:7.8,shop:7.7,egg:8},{sale:5,shop:5.7,egg:5.3},{sale:5.1,shop:5.7,egg:5.6}];
// a bagful sold while mining a layer, measured whole: the button, the walk, the station, back down the pit to the face;
// the average over a whole journey played by the bot (playthrough.mts, seed 1: 189 / 313 / 346 trips), shorter than
// the 15-minute stretches with big bags measure-headless.mts timed (16.5 / 18.6 / 20.2 s)
const LAYER_TRIP=[14.3,12.9,13.2];
// 2026-11-02: Sell uses the nearest upper hall; portable travel returns directly.
// Four actual-session probes measured 4.1/5.0 s (W1), 12.5 s (W2), 7.9 s (W3).
const HALL_TRIP=[5,12.5,7.9];
const sellTrip=(w:number,k=0)=>SELL??(k?HALL_TRIP[w]:LAYER_TRIP[w])+(UI-1.5);
/** Selling during a descent: the same, then straight back down the shaft (fall added by the caller). */
const descentTrip=(w:number,k=0)=>SELL??TAP+SOLD+(k?0:SURFACE[w].sale)+UI+TELEPORT+1;
// a round of buying adds the choices and the shop's (or the egg's) way to the station instead of the ring's
const shopExtra=(w:number)=>2*UI+SURFACE[w].shop-SURFACE[w].sale, eggExtra=(w:number)=>UI+SURFACE[w].egg-SURFACE[w].sale;
const PORTAL=[1,2,3].map(id=>{const st=GAME_CONTENT.session.stations.find(x=>x.worldId===id)!.zone,p=worldPortal(id as 1).zone;return Math.hypot(p.x-st.x,p.z-st.z);});
const portalTrip=(w:number)=>PORTAL[w]/WALK+UI+TELEPORT+10.7/WALK;
/** Buying at a hall's shop after selling: the shop button there, the choices, back to the surface and on to the
 *  station (from the spawn, instead of from the ring). */
const hallShopExtra=(w:number)=>TAP+TELEPORT+2*UI+TAP+TELEPORT+10.7/WALK-SURFACE[w].sale;
const fall=(h:number)=>h<=28*28/48?Math.sqrt(2*h/24):28/24+(h-28*28/48)/28;

// ---- simulate: a typical player through economy.json ----------------------------------------------------------
type Pet={w:number;b:number;m:number;id:string;gold?:boolean};
export function simulate(E:Economy,plan:Plan,seed:number,trace=false,keep:Pet[]=[],mult=1,slots0=E.start.petSlots){
  let s=seed*7919+13;const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
  const L=E.layers,gateOf=(i:number)=>L[i].gate,exitLevel=(i:number)=>local(i)<6?gateOf(i+1):E.worlds[world(i)+1]?.ticket?.toolLevel??E.rebirth.toolLevel;
  const eggLayer=E.eggs.map(e=>(e.world-1)*7+e.layer),slotLayer=E.petSlots.map(p=>(p.world-1)*7+p.layer);
  const target=(j:number)=>Math.max(1,Math.round(plan.pulls[j]*PM));
  let T=0,lv=1,enh=0,bag=0,layer=0,slots=slots0,lastImp=0,maxGap=0;const cur=[0,0,0],pets:Pet[]=[...keep],arrive=[0],petMining=[0],ev:string[]=[],hatched=E.eggs.map(()=>0),gapAt:number[]=[];
  // the reward page and the capsule: lucky coins per play day, spins, the mining boost, double sale until sellUntil
  let lucky=0,day=-1,signins=0,boosted=false,sellUntil=0,spins=0,boostedAt:number|null=null,farmed=0;const online:number[]=[];
  // ticket minerals kept in the material store (expected counts)
  const stored:Record<string,number>={};
  const w=()=>world(layer);
  // where the time goes, per world (playthrough.mts reports the same for the bot)
  const spent:Record<string,number>[]=[{},{},{}];const add=(what:string,dt:number)=>{spent[w()][what]=(spent[w()][what]??0)+dt;T+=dt;};
  // "equip best": this world's currency first, then mining for the slots left
  const equipped=()=>[...pets].sort((a,b)=>(b.w===w()?b.b:0)-(a.w===w()?a.b:0)||b.m-a.m).slice(0,slots);
  const team=()=>1+equipped().filter(p=>p.w===w()).reduce((a,p)=>a+p.b,0);
  /** The equipped pets' mining bonus (a fraction: 1 = +100 %), and the mining multiplier with the capsule's boost. */
  const teamMining=()=>equipped().reduce((a,p)=>a+p.m,0);
  const mining=()=>(boosted?E.capsule.miningSpeedMultiplier:1)*(1+teamMining());
  const power=()=>enh?E.tools[lv-1].enhance[enh-1].power:E.tools[lv-1].power;
  const CAP=4*E.tools[0].speed;
  // a block: its swings, and whatever of the re-aim and MOVE outlasts one swing
  const bt=(hp:number,aim=AIM)=>{const base=E.tools[lv-1].speed,m=mining(),speed=Math.min(CAP,base*m),hit=power()*base*m/speed;
    return Math.ceil(hp/hit)/speed+Math.max(0,aim+MOVE-1/speed);};
  const rate=(i:number,aim=AIM)=>{const l=L[i],c=l.oreChance,wt=l.ores.reduce((a,o)=>a+o.weight,0);let v=0,t=0,volume=0;
    for(const [x,q] of [[l.rock,1-c],...l.ores.map(o=>[o,c*o.weight/wt] as const)] as const){v+=q*x.price;t+=q*bt(x.hp,aim);volume+=q*x.volume;}return {v:v*team()*mult,t,volume};};
  const bagOffer=()=>{
    const r=rate(layer),cap=E.bags[bag].capacity;
    if(Math.max(1,Math.ceil(cap/r.volume))*r.t>=35 && cap>=2*L[layer].deep.volume)return null;
    const target=Math.max(r.volume*45/r.t,2*L[layer].deep.volume);
    const offers=E.bags.map((b,j)=>({b,j})).filter(x=>x.j>bag&&x.b.currency===E.currencies[w()].id&&x.b.shop<=local(layer));
    return offers.find(x=>x.b.capacity>=target)??offers.at(-1)??null;
  };
  /** Income from mining that starts now and lasts dt: the capsule's double sale pays for the part of it inside. */
  const earn=(v:number,dt:number)=>v*(1+(E.capsule.sellMultiplier-1)*Math.min(1,Math.max(0,(sellUntil-T)/Math.max(dt,1e-9))));
  const imp=(what:string)=>{const g=T-lastImp;if(g>maxGap){maxGap=g;}gapAt.push(g);lastImp=T;if(trace)ev.push(`${(T/60).toFixed(1)}m ${what}`);};
  const pay=(c:number,cw=w())=>{cur[cw]-=c;};
  const wantEgg=(j:number)=>eggLayer[j]<=layer&&world(eggLayer[j])===w()&&hatched[j]<target(j)&&(eggLayer[j]===layer||E.eggs[j].premium);
  const deepestShop=()=>[...SHOP_LAYERS].reverse().find(x=>x<=local(layer))!;
  const enhPrice=()=>enh<3&&E.tools[lv-1].enhance.length?E.tools[lv-1].enhance[enh].price:Infinity;
  // the store takes a ticket mineral while a world not yet open still lacks it
  const needed=(item:string)=>E.worlds.filter(x=>x.id-1>w()&&x.ticket).flatMap(x=>x.ticket!.materials).filter(m=>m.itemId===item).reduce((a,m)=>a+m.count,0);
  const collect=(i:number,blocks:number)=>{let withheld=0;const l=L[i],wt=l.ores.reduce((a,o)=>a+o.weight,0);
    for(const o of l.ores){const room=needed(o.itemId)-(stored[o.itemId]??0);if(room>0){const kept=Math.min(room,blocks*l.oreChance*o.weight/wt);stored[o.itemId]=(stored[o.itemId]??0)+kept;withheld+=kept*o.price;}}return withheld*team()*mult;};
  /** Mine the next world's missing ticket minerals where they are found, on the way out of this world. */
  const farmTicket=()=>{for(const m of E.worlds[w()+1].ticket!.materials){const lack=m.count-(stored[m.itemId]??0);if(lack<=1e-9)continue;
    const i=(m.world-1)*7+m.layer,l=L[i],wt=l.ores.reduce((a,o)=>a+o.weight,0),o=l.ores.find(x=>x.itemId===m.itemId)!,blocks=lack/(l.oreChance*o.weight/wt),r=rate(i);
    const dt=blocks*r.t+Math.ceil(blocks/Math.max(1,Math.ceil(E.bags[bag].capacity/r.volume)))*sellTrip(world(i),local(i))+UI+TELEPORT+(world(i)!==w()?2*portalTrip(w()):0);
    const withheld=collect(i,blocks);if(world(i)===w())cur[w()]+=earn(Math.max(0,blocks*r.v-withheld),dt);
    farmed+=dt;add('ticket',dt);}};
  /** The day's lucky coins (sign-in, then online at 5/10/20/30 min), spun at the capsule in world 1: at once there,
   *  from later worlds once a handful has gathered (a trip through the portal and back). */
  const rewards=()=>{if(!CAPSULE)return;const d=Math.floor(T/DAY);if(d>day){day=d;online.length=0;lucky+=E.luckyCoins.signin[signins++%E.luckyCoins.signin.length];}
    for(const o of E.luckyCoins.online)if(T-d*DAY>=o.minutes*60&&!online.includes(o.minutes)){online.push(o.minutes);lucky+=o.coins;}
    if(!lucky||(w()>0&&lucky<7))return;
    if(w()>0)add('rewards',2*portalTrip(w()));
    const prizes=E.capsule.prizes,total=prizes.reduce((a,p)=>a+p.weight,0);
    for(;lucky>0;lucky--){add('rewards',UI);spins++;let r=rnd()*total,q=0;for(;q<prizes.length-1&&r>=prizes[q].weight;q++)r-=prizes[q].weight;
      const prize=prizes[q].id,coins=L[layer].capsuleCoins;
      if(prize==='coins')cur[w()]+=coins;
      else if(prize==='mining'){if(boosted)cur[w()]+=coins;else{boosted=true;boostedAt=T;}}
      else if(prize==='sell')sellUntil=Math.max(sellUntil,T)+E.capsule.timedSeconds;}};
  while(T<30*3600){
    rewards();
    let shop=-1,eggs=false;
    for(let k=0;k<400;k++){const opts:[string,number,number][]=[];
      E.eggs.forEach((e,j)=>{if(wantEgg(j))opts.push(['egg',e.price,j]);});
      // the next pickaxe once its shop is reached (its hall on this world's way down)
      if(lv<exitLevel(layer)&&E.tools[lv].shop<=local(layer))opts.push(['tool',E.tools[lv].price,0]);
      if(enhPrice()<Infinity)opts.push(['enh',enhPrice(),0]);
      const bo=bagOffer();if(bo)opts.push(['bag',bo.b.price,bo.j]);
      const si=slotLayer.findIndex((l,q)=>l<=layer&&slots===3+q&&world(l)===w());if(si>=0)opts.push(['slot',E.petSlots[si].price,si]);
      const ok=opts.filter(o=>o[1]<=cur[w()]).sort((a,b)=>a[1]-b[1]);if(!ok.length)break;const [what,c,j]=ok[0];pay(c);
      if(what==='egg'){eggs=true;add('hatch',HATCH);hatched[j]++;const pool=E.eggs[j].pets,total=pool.reduce((a,p)=>a+p.weight,0);let r=rnd()*total,q=0;for(;q<pool.length-1&&r>=pool[q].weight;q++)r-=pool[q].weight;
        const worth=()=>{const r=rate(layer);return r.v/r.t;},before=worth(),b=pool[q].bonusPct/100,m=pool[q].miningPct/100,id=`${j}:${q}`;pets.push({w:w(),b,m,id});const same=pets.filter(p=>p.id===id&&!p.gold);
        if(same.length>=E.golden.need){for(const p of same.slice(0,E.golden.need))pets.splice(pets.indexOf(p),1);pets.push({w:w(),b:b*E.golden.bonusMultiplier,m:m*E.golden.bonusMultiplier,id,gold:true});}
        if(worth()>before*1.05)imp(`egg${eggLayer[j]}${E.eggs[j].premium?'P':''} r${q}`);}
      else if(what==='bag'){bag=j;shop=Math.max(shop,E.bags[j].shop);imp(`bag${E.bags[bag].capacity}`);}
      else{if(what!=='slot')shop=Math.max(shop,what==='tool'?E.tools[lv].shop:deepestShop());if(what==='tool'){lv++;enh=0;imp(`L${lv}`);} else if(what==='enh'){enh++;imp(`L${lv}+${enh}`);} else {slots++;imp(`slot${slots}`);}}}
    add('shop',shop<0?0:shop>0?hallShopExtra(w()):shopExtra(w()));add('hatch',eggs?eggExtra(w()):0);
    const done=E.eggs.every((e,j)=>eggLayer[j]!==layer||hatched[j]>=target(j));
    const slotDone=!slotLayer.includes(layer)||slots>3+slotLayer.indexOf(layer);
    if(done&&lv>=exitLevel(layer)&&slotDone){
      if(local(layer)===6){if(w()===2){arrive.push(T);petMining.push(teamMining());break;}const price=E.worlds[w()+1].ticket!.price;if(cur[w()]>=price){farmTicket();pay(price);layer++;arrive.push(T);petMining.push(teamMining());imp('portal');continue;}}
      else{// the hole down (HOLE columns): the layer's rock and ores, then its cap (to the hall's ceiling); each
        // bagful sold, then back down the hole
        const l=L[layer],ceiling=L[layer+1].from-l.from-GAME_CONTENT.worlds[w()].rooms[local(layer)].height*2;
        const d=(ceiling-l.deepAt!)/2*HOLE,n=l.deepAt!/2*HOLE+d,cap=E.bags[bag].capacity,r=rate(layer);
        const dt=(n-d)*r.t+d*bt(l.deep.hp)+Math.ceil((n-d)/Math.max(1,Math.ceil(cap/r.volume))+d/Math.max(1,Math.ceil(cap/l.deep.volume)))*(descentTrip(w(),local(layer))+fall((L[layer+1].from-l.from)/2));
        const withheld=collect(layer,n-d);cur[w()]+=earn(Math.max(0,(n-d)*r.v+d*l.deep.price*team()*mult-withheld),dt);add('descend',dt);layer++;arrive.push(T);petMining.push(teamMining());imp('arrive');continue;}}
    let best=layer,br=-1;for(let i=w()*7;i<=layer;i++)if(gateOf(i)<=lv){const r=rate(i),cap=Math.max(1,Math.ceil(E.bags[bag].capacity/r.volume)),c=cap*r.v/(cap*r.t+sellTrip(w(),local(i)));if(c>br){br=c;best=i;}}
    // a player heads to sell once the next thing they want is paid for, or the bag is full
    const r=rate(best),bo=bagOffer();const want=[bo?.b.price??Infinity,...E.eggs.map((e,j)=>wantEgg(j)?e.price:Infinity),lv<exitLevel(layer)?E.tools[lv].price:Infinity,enhPrice(),
      local(layer)===6&&w()<2?E.worlds[w()+1].ticket!.price:Infinity];
    const need=Math.min(...want)-cur[w()],n=Math.min(Math.max(1,Math.ceil(E.bags[bag].capacity/r.volume)),Math.max(1,Math.ceil(need/r.v))),dt=n*r.t+sellTrip(w(),local(best));
    const withheld=collect(best,n);cur[w()]+=earn(Math.max(0,n*r.v-withheld),dt);add('mine',n*r.t);add('sell',sellTrip(w(),local(best)));
  }
  return {arrive,petMining,maxGap,ev,gapAt,T,pets,slots,spins,boostedAt,farmed,spent};
}

// ---- commands ------------------------------------------------------------------------------------------------
export const seeds=Array.from({length:15},(_,i)=>i+1);
export const median=(a:number[])=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
const readJson=(file:URL)=>JSON.parse(readFileSync(file,'utf8'));
const write=(file:URL,value:unknown)=>writeFileSync(file,JSON.stringify(value,null,1)+'\n');
export const loadEconomy=():Economy=>readJson(ECONOMY_FILE), loadPlan=():Plan=>readJson(PLAN_FILE), loadBudgets=():number[]=>readJson(K_FILE);
// Commands run only when this file is the program (tests import it for `build`).
const command=process.argv[1]===fileURLToPath(import.meta.url)?process.argv[2]:undefined;
if(command==='calibrate'||command==='export'){
  const K:number[]=command==='export'||existsSync(K_FILE)?readJson(K_FILE):TARGET.map(t=>t*60*2);
  if(command==='calibrate')for(let it=0;it<60;it++){const {economy,plan}=build(K),runs=seeds.map(s=>simulate(economy,plan,s));
    // The first layer keeps its designed budget: the first pickaxe should come within minutes whether or not the
    // player has found the capsule yet (the day's first lucky coins would otherwise price it up for everyone).
    for(let i=1;i<N;i++){const d=median(runs.map(r=>(r.arrive[i+1]??Infinity)-r.arrive[i]))/60;if(isFinite(d))K[i]*=Math.pow(TARGET[i]/Math.max(.3,d),.5);}}
  const {economy,plan}=build(K);
  if(command==='calibrate')writeFileSync(K_FILE,JSON.stringify(K));
  write(ECONOMY_FILE,economy);write(PLAN_FILE,plan);
}
if(command){
  const E=loadEconomy(),plan=loadPlan(),runs=seeds.map(s=>simulate(E,plan,s));const cum=(i:number)=>runs.map(r=>r.arrive[i]/60).sort((a,b)=>a-b);
  console.log(Array.from({length:22},(_,i)=>{const c=cum(i);return `${i}:${c[7]?.toFixed(0)}`;}).join(' '));
  for(const ww of [1,2,3]){const a=runs.map(r=>(r.arrive[ww*7]-r.arrive[(ww-1)*7])/60).sort((x,y)=>x-y);console.log('world',ww,'P10/P50/P90',a[1].toFixed(0),a[7].toFixed(0),a[13].toFixed(0));}
  console.log('pets\' mining on arriving (median %):',Array.from({length:21},(_,i)=>Math.round(100*median(runs.map(r=>r.petMining[i+1])))).join(' '));
  console.log('longest no-improvement (min): median',(median(runs.map(r=>r.maxGap))/60).toFixed(1),'worst',(Math.max(...runs.map(r=>r.maxGap))/60).toFixed(1),'| P90 of all gaps',(median(runs.map(r=>{const g=[...r.gapAt].sort((a,b)=>a-b);return g[Math.floor(g.length*.9)];}))/60).toFixed(1));
}
