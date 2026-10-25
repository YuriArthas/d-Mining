// The economy model. `build` turns the design parameters below into src/game/content/economy.json, the one table
// the game reads every economic number from; `simulate` plays a typical player through that table (and only that
// table, plus plan.json: how many pulls of each egg the player aims for), so hand edits to the JSON show up in
// `report`. Commands:
//   node tools/economy/model.mts calibrate   tune the per-layer budgets K to TARGET, write k3.json, plan.json, economy.json
//   node tools/economy/model.mts export      rebuild economy.json and plan.json from k3.json
//   node tools/economy/model.mts report      simulate economy.json and print arrival times and upgrade gaps
// Player knobs: AIM (s per block spent aiming), SELL (s per trip to sell), PM (pull multiplier).
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LAYER_ITEMS } from '../../src/game/content/journeyResources.ts';
import { EGG_DEFINITIONS } from '../../src/game/content/pets.ts';

const ECONOMY_FILE = new URL('../../src/game/content/economy.json', import.meta.url);
const K_FILE = new URL('./k3.json', import.meta.url), PLAN_FILE = new URL('./plan.json', import.meta.url);
const AIM=+(process.env.AIM??.35), SELL=+(process.env.SELL??15), HATCH=3, PM=+(process.env.PM??1);
export const N=21; export const world=(i:number)=>Math.floor(i/7), local=(i:number)=>i%7;
/** Two significant figures: 468 -> 470, 4 680 -> 4 700, never below 1. */
export const nice=(x:number)=>{if(x<10)return Math.max(1,Math.round(x));const p=10**(Math.floor(Math.log10(x))-1);return Math.round(x/p)*p;};

// ---- design parameters ------------------------------------------------------------------------------------------
const CURRENCIES=[{id:'gold',name:'金币'},{id:'tech',name:'科技币'},{id:'star',name:'星晶'}] as const;
// tool: 30 levels. Swing speed 2 -> 8 (4x) over world 1, then flat; damage x1.5 per level, nice-rounded.
const SWING=[2,2.5,3,3.5,4,5,6,7,8];
const ENH={step:.12,max:3,cost:[.3,.45,.6]};
const toolPower=(L:number,e=0)=>nice(10*1.5**(L-1)*(1+ENH.step*e)), toolSpeed=(L:number)=>SWING[Math.min(L-1,SWING.length-1)];
// the tool level each layer needs; leaving worlds 1 and 2 needs L10 / L20 (the next world's first gate)
const GATES=[[1,2,3,5,6,8,9],[10,11,12,13,14,16,18],[20,21,22,23,24,26,28]];
const gate=(i:number)=>GATES[world(i)][local(i)];
// rest-room depths (m) of each world's layers: world 1 shallow first so layers 2 and 3 come at about 7 and 15 min
const DEPTHS=[[0,60,140,260,420,620,860],[0,400,800,1200,1600,2000,2400],[0,400,800,1200,1600,2000,2400]];
const DEEP_SHARE=.3;   // the last 30 % of a layer's descent is dense rock
// rock value restarts every world (own currency); HP = 5 swings of the layer's gate tool
const VALS=[1,2,3,5,8,12,20];
const V=(i:number)=>VALS[local(i)];
const HP=(i:number)=>i===0?20:nice(5*toolPower(gate(i)));
const blocks=(i:number)=>({rock:{hp:HP(i),v:V(i)},a:{hp:nice(2*HP(i)),v:3*V(i)},b:{hp:nice(3*HP(i)),v:6*V(i)},deep:{hp:nice(5*HP(i)),v:Math.max(1,Math.round(V(i)/4))}});
const ORE_CHANCE=(i:number)=>Math.round((.18+.1*local(i)/6)*1000)/1000, ORE_WEIGHTS=[12,10];
// eggs: one per layer; long layers of worlds 2 and 3 add a premium egg (pets x2, price x4)
type Slot={layer:number;premium:boolean};
const SLOTS:Slot[]=[];for(let i=0;i<N;i++){SLOTS.push({layer:i,premium:false});if((world(i)===1&&local(i)>=4)||(world(i)===2&&local(i)>=2))SLOTS.push({layer:i,premium:true});}
const RAR=[1,1.2,1.6,2.3,3.5],WT=[40,30,20,8,2];
const bonusPct=(s:Slot,r:number)=>nice(100*0.5*2.5**local(s.layer)*(s.premium?2:1)*RAR[r]);
// every pet also mines faster in every world (swing speed up to the 4× cap, then damage): small and slow-growing
// across the whole journey, so the pickaxe stays the gate and old pets still help early in the next world
const miningPct=(s:Slot,r:number)=>nice(4*1.12**s.layer*(s.premium?1.5:1)*RAR[r]);
const GOLD={need:5,bonusMultiplier:2.5};
// bag: 10 sizes per world, in blocks
const BAG=[25,30,35,40,50,60,70,80,90,100, 110,120,140,160,180,200,220,240,260,280, 300,320,340,360,380,400,420,450,480,500];
// pet slots: 3, +1 in world 2 (layer 3), +1 in world 3 (layer 3)
const SLOT_LAYERS=[10,17];
// world tickets: the next world's price in this world's currency (budgeted) plus minerals of earlier worlds
const TICKET_MATERIALS:Record<number,{layer:number;ore:number;count:number}[]>={
  2:[{layer:3,ore:1,count:20},{layer:5,ore:1,count:15},{layer:6,ore:1,count:10}],
  3:[{layer:6,ore:0,count:30},{layer:11,ore:1,count:20},{layer:13,ore:1,count:15}],
};
const CAPSULE_SECONDS=120;   // the capsule's coin prize: about this much income at the deepest layer reached
// minutes per layer for a typical player (layer i -> i+1; the last of each world: to the next world / the end)
const TARGET=[7,8,12,15,18,25,35, 12,20,30,38,42,46,52, 18,30,45,58,65,70,74];

// ---- build: parameters -> economy.json ------------------------------------------------------------------------
export type Economy=ReturnType<typeof build>['economy'];
export type Plan={pulls:number[]};
function arrivalIncome(i:number){const L=gate(i),power=toolPower(L),speed=toolSpeed(L),b=blocks(i),c=ORE_CHANCE(i);
  const prev=SLOTS.filter(e=>e.layer<i&&world(e.layer)===world(i)&&!e.premium).at(-1);const team=prev?1+3*1.2*bonusPct(prev,0)/100:1;
  let v=0,tt=0;for(const [x,q] of [[b.rock,1-c],[b.a,c*12/22],[b.b,c*10/22]] as const){v+=q*x.v;tt+=q*(Math.ceil(x.hp/power)/speed+AIM);}return v/tt*team*.85;}
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
  const bag=BAG.map((_,t)=>t%10===0?(t===0?0:nice(tool[t+1]*.5)):nice(tool[Math.min(30,t+1)]*.15));
  const currency=(w:number)=>CURRENCIES[w].id;
  const eggDefinition=(s:Slot)=>EGG_DEFINITIONS.find(d=>d.world===world(s.layer)+1&&d.layer===local(s.layer)&&d.premium===s.premium)??null;
  for(const d of EGG_DEFINITIONS)if(!SLOTS.some(s=>eggDefinition(s)===d))throw Error(`蛋没有对应的层: ${d.id}`);
  const economy={
    currencies:CURRENCIES.map((c,w)=>({...c,world:w+1})),
    start:{toolLevel:1,bagTier:1,petSlots:3},
    worlds:[1,2,3].map(id=>({id,currency:currency(id-1),ticket:id===1?null:{currency:currency(id-2),price:portal[id],toolLevel:(id-1)*10,
      materials:TICKET_MATERIALS[id].map(m=>({itemId:LAYER_ITEMS[m.layer].ores[m.ore].itemId,count:m.count,world:world(m.layer)+1,layer:local(m.layer)}))}})),
    layers:Array.from({length:N},(_,i)=>{const b=blocks(i),items=LAYER_ITEMS[i],from=DEPTHS[world(i)][local(i)],cells=local(i)<6?(DEPTHS[world(i)][local(i)+1]-from)/2:0;
      return {world:world(i)+1,layer:local(i),from,deepAt:cells?(cells-Math.round(cells*DEEP_SHARE))*2:null,gate:gate(i),oreChance:ORE_CHANCE(i),
        capsuleCoins:nice(CAPSULE_SECONDS*arrivalIncome(i)),
        rock:{itemId:items.rock.itemId,hp:b.rock.hp,price:b.rock.v},deep:{itemId:items.deep.itemId,hp:b.deep.hp,price:b.deep.v},
        ores:[b.a,b.b].map((o,j)=>({itemId:items.ores[j].itemId,hp:o.hp,price:o.v,weight:ORE_WEIGHTS[j]}))};}),
    tools:Array.from({length:30},(_,k)=>{const L=k+1;return {level:L,currency:currency(Math.floor(k/10)),price:L===1?0:tool[L],power:toolPower(L),speed:toolSpeed(L),
      // enhancements cost a share of the next pickaxe; the last of a world (L10, L20) has its next one in another
      // currency, so its share is of this one's price grown like a level (×1.5)
      enhance:L<30?ENH.cost.map((cost,e)=>({price:nice((L%10?tool[L+1]:tool[L]*1.5)*cost),power:toolPower(L,e+1)})):[]};}),
    bags:BAG.map((capacity,t)=>({tier:t+1,currency:currency(Math.floor(t/10)),price:bag[t],capacity})),
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

// ---- simulate: a typical player through economy.json ----------------------------------------------------------
type Pet={w:number;b:number;m:number;id:string;gold?:boolean};
export function simulate(E:Economy,plan:Plan,seed:number,trace=false,keep:Pet[]=[],mult=1,slots0=E.start.petSlots){
  let s=seed*7919+13;const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
  const L=E.layers,gateOf=(i:number)=>L[i].gate,exitLevel=(i:number)=>local(i)<6?gateOf(i+1):E.worlds[world(i)+1]?.ticket?.toolLevel??E.rebirth.toolLevel;
  const eggLayer=E.eggs.map(e=>(e.world-1)*7+e.layer),slotLayer=E.petSlots.map(p=>(p.world-1)*7+p.layer);
  const target=(j:number)=>Math.max(1,Math.round(plan.pulls[j]*PM));
  let T=0,lv=1,enh=0,bag=0,layer=0,slots=slots0,lastImp=0,maxGap=0;const cur=[0,0,0],pets:Pet[]=[...keep],arrive=[0],ev:string[]=[],hatched=E.eggs.map(()=>0),gapAt:number[]=[];
  const w=()=>world(layer);
  // "equip best": this world's currency first, then mining for the slots left
  const equipped=()=>[...pets].sort((a,b)=>(b.w===w()?b.b:0)-(a.w===w()?a.b:0)||b.m-a.m).slice(0,slots);
  const team=()=>1+equipped().filter(p=>p.w===w()).reduce((a,p)=>a+p.b,0);
  const mining=()=>1+equipped().reduce((a,p)=>a+p.m,0);
  const power=()=>enh?E.tools[lv-1].enhance[enh-1].power:E.tools[lv-1].power;
  const CAP=4*E.tools[0].speed;
  const bt=(hp:number)=>{const base=E.tools[lv-1].speed,m=mining(),speed=Math.min(CAP,base*m);return Math.ceil(hp/(power()*base*m/speed))/speed+AIM;};
  const rate=(i:number)=>{const l=L[i],c=l.oreChance,wt=l.ores.reduce((a,o)=>a+o.weight,0);let v=0,t=0;
    for(const [x,q] of [[l.rock,1-c],...l.ores.map(o=>[o,c*o.weight/wt] as const)] as const){v+=q*x.price;t+=q*bt(x.hp);}return {v:v*team()*mult,t};};
  const imp=(what:string)=>{const g=T-lastImp;if(g>maxGap){maxGap=g;}gapAt.push(g);lastImp=T;if(trace)ev.push(`${(T/60).toFixed(1)}m ${what}`);};
  const pay=(c:number,cw=w())=>{cur[cw]-=c;};
  const wantEgg=(j:number)=>eggLayer[j]<=layer&&world(eggLayer[j])===w()&&hatched[j]<target(j)&&(eggLayer[j]===layer||E.eggs[j].premium);
  const enhPrice=()=>enh<3&&E.tools[lv-1].enhance.length?E.tools[lv-1].enhance[enh].price:Infinity;
  while(T<30*3600){
    for(let k=0;k<400;k++){const opts:[string,number,number][]=[];
      E.eggs.forEach((e,j)=>{if(wantEgg(j))opts.push(['egg',e.price,j]);});
      if(lv<exitLevel(layer))opts.push(['tool',E.tools[lv].price,0]);
      if(enhPrice()<Infinity)opts.push(['enh',enhPrice(),0]);
      const si=slotLayer.findIndex((l,q)=>l<=layer&&slots===3+q&&world(l)===w());if(si>=0)opts.push(['slot',E.petSlots[si].price,si]);
      const ok=opts.filter(o=>o[1]<=cur[w()]).sort((a,b)=>a[1]-b[1]);if(!ok.length)break;const [what,c,j]=ok[0];pay(c);
      if(what==='egg'){T+=HATCH;hatched[j]++;const pool=E.eggs[j].pets,total=pool.reduce((a,p)=>a+p.weight,0);let r=rnd()*total,q=0;for(;q<pool.length-1&&r>=pool[q].weight;q++)r-=pool[q].weight;
        const worth=()=>{const r=rate(layer);return r.v/r.t;},before=worth(),b=pool[q].bonusPct/100,m=pool[q].miningPct/100,id=`${j}:${q}`;pets.push({w:w(),b,m,id});const same=pets.filter(p=>p.id===id&&!p.gold);
        if(same.length>=E.golden.need){for(const p of same.slice(0,E.golden.need))pets.splice(pets.indexOf(p),1);pets.push({w:w(),b:b*E.golden.bonusMultiplier,m:m*E.golden.bonusMultiplier,id,gold:true});}
        if(worth()>before*1.05)imp(`egg${eggLayer[j]}${E.eggs[j].premium?'P':''} r${q}`);}
      else if(what==='tool'){lv++;enh=0;imp(`L${lv}`);} else if(what==='enh'){enh++;imp(`L${lv}+${enh}`);} else {slots++;imp(`slot${slots}`);}}
    const nb=bag+1,nbw=nb<E.bags.length?E.currencies.findIndex(c=>c.id===E.bags[nb].currency):9;
    if(nb<E.bags.length&&nbw<=w()&&E.bags[nb].price<=cur[nbw]*.3){pay(E.bags[nb].price,nbw);bag=nb;imp(`bag${E.bags[bag].capacity}`);}
    const done=E.eggs.every((e,j)=>eggLayer[j]!==layer||hatched[j]>=target(j));
    const slotDone=!slotLayer.includes(layer)||slots>3+slotLayer.indexOf(layer);
    if(done&&lv>=exitLevel(layer)&&slotDone){
      if(local(layer)===6){if(w()===2){arrive.push(T);break;}const price=E.worlds[w()+1].ticket!.price;if(cur[w()]>=price){pay(price);layer++;arrive.push(T);imp('portal');continue;}}
      else{const l=L[layer],n=(L[layer+1].from-l.from)/2,d=n-(l.deepAt??n*2)/2,cap=E.bags[bag].capacity;
        T+=(n-d)*bt(l.rock.hp)+d*bt(l.deep.hp)+Math.ceil(n/cap)*SELL;
        cur[w()]+=((n-d)*l.rock.price+d*l.deep.price)*team()*mult;layer++;arrive.push(T);imp('arrive');continue;}}
    let best=layer,br=-1;for(let i=w()*7;i<=layer;i++)if(gateOf(i)<=lv){const r=rate(i),cap=E.bags[bag].capacity,c=cap*r.v/(cap*r.t+SELL);if(c>br){br=c;best=i;}}
    // a player heads to sell once the next thing they want is paid for, or the bag is full
    const r=rate(best);const want=[...E.eggs.map((e,j)=>wantEgg(j)?e.price:Infinity),lv<exitLevel(layer)?E.tools[lv].price:Infinity,enhPrice(),
      local(layer)===6&&w()<2?E.worlds[w()+1].ticket!.price:Infinity];
    const need=Math.min(...want)-cur[w()],n=Math.min(E.bags[bag].capacity,Math.max(5,Math.ceil(need/r.v)));T+=n*r.t+SELL;cur[w()]+=n*r.v;
  }
  return {arrive,maxGap,ev,gapAt,T,pets,slots};
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
    for(let i=0;i<N;i++){const d=median(runs.map(r=>(r.arrive[i+1]??Infinity)-r.arrive[i]))/60;if(isFinite(d))K[i]*=Math.pow(TARGET[i]/Math.max(.3,d),.5);}}
  const {economy,plan}=build(K);
  if(command==='calibrate')writeFileSync(K_FILE,JSON.stringify(K));
  write(ECONOMY_FILE,economy);write(PLAN_FILE,plan);
}
if(command){
  const E=loadEconomy(),plan=loadPlan(),runs=seeds.map(s=>simulate(E,plan,s));const cum=(i:number)=>runs.map(r=>r.arrive[i]/60).sort((a,b)=>a-b);
  console.log(Array.from({length:22},(_,i)=>{const c=cum(i);return `${i}:${c[7]?.toFixed(0)}`;}).join(' '));
  for(const ww of [1,2,3]){const a=runs.map(r=>(r.arrive[ww*7]-r.arrive[(ww-1)*7])/60).sort((x,y)=>x-y);console.log('world',ww,'P10/P50/P90',a[1].toFixed(0),a[7].toFixed(0),a[13].toFixed(0));}
  console.log('longest no-improvement (min): median',(median(runs.map(r=>r.maxGap))/60).toFixed(1),'worst',(Math.max(...runs.map(r=>r.maxGap))/60).toFixed(1),'| P90 of all gaps',(median(runs.map(r=>{const g=[...r.gapAt].sort((a,b)=>a-b);return g[Math.floor(g.length*.9)];}))/60).toFixed(1));
}
