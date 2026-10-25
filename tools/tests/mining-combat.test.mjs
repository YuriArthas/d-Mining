import { resourceByKind } from '../../src/game/content/resources.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BlockHealth } from '../../src/game/logic/BlockHealth.ts';
import { MiningCombat } from '../../src/game/application/MiningCombat.ts';
import { Pickaxe, pickaxeStats } from '../../src/game/logic/Pickaxe.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';

import { GameSession } from '../../src/game/application/GameSession.ts';
import { ORE_ITEMS } from '../../src/game/application/items.ts';

const SESSION_CONTENT = GAME_CONTENT.session, SELL_ZONE = SESSION_CONTENT.sales[0];
function setup(maximum=30){
 const pending=new Set(),removed=new Set(),requests=[],axe=new Pickaxe();let full=false,accept=true;
 const combat=new MiningCombat({isFull:()=>full,stats:axe.getSnapshot,read:key=>removed.has(key)?null:{key,maximum},pending:key=>pending.has(key),destroy:key=>{if(!accept)return false;pending.add(key);requests.push(key);return true}});
 return {combat,axe,pending,removed,requests,full:v=>full=v,accept:v=>accept=v};
}
test('health queries allocate nothing; only touched cells retain their own damage',()=>{
 const h=new BlockHealth();for(let i=0;i<20000;i++)assert.equal(h.get(String(i),100),100);assert.equal(h.size,0);
 h.damage('a',100,10);h.damage('b',20,7);assert.equal(h.size,2);assert.equal(h.get('a',100),90);assert.equal(h.get('b',20),13);
 assert.equal(h.damage('a',100,1000),0);h.forget('a');assert.equal(h.size,1);assert.equal(h.get('b',20),13);
 assert.throws(()=>h.damage('bad',0,10));assert.throws(()=>h.damage('bad',10,-1));assert.equal(h.size,1);
});
test('damage and swing speed come from the table: speed climbs to 4× the first pickaxe and stops, damage keeps rising',()=>{
 for(const tool of ECONOMY.tools){const s=pickaxeStats(tool.level);assert.equal(s.power,tool.power);assert.equal(s.speed,tool.speed);assert.equal(s.overflowPower,0);}
 assert.deepEqual([1,2,9,10,30].map(l=>pickaxeStats(l).speed),[2,2.5,8,8,8]);
 for(let l=2;l<=30;l++){const ratio=pickaxeStats(l).power/pickaxeStats(l-1).power;assert.ok(ratio>1.35&&ratio<1.65,`L${l} damage ×${ratio}`);}
 assert.equal(pickaxeStats(8).levelsUntilSpeed,1);assert.equal(pickaxeStats(9).levelsUntilSpeed,null);
 // The capsule's speed boost: faster below the cap, the rest as damage, damage per second kept within rounding.
 assert.deepEqual([pickaxeStats(1,1.5).speed,pickaxeStats(1,1.5).power],[3,10]);
 assert.equal(pickaxeStats(9,1.5).speed,8);assert.equal(pickaxeStats(9,1.5).overflowPower,Math.round(pickaxeStats(9).power*.5));
 for(let level=1;level<=30;level++){
  const s=pickaxeStats(level,1.5),difference=s.basePower*s.uncappedSpeed-s.power*s.speed;
  assert.ok(Math.abs(difference)<=s.speed/2+1e-9);
 }
 assert.throws(()=>pickaxeStats(0));assert.throws(()=>pickaxeStats(31));assert.throws(()=>pickaxeStats(2,.5));assert.throws(()=>pickaxeStats(2,NaN));
 assert.equal(Pickaxe.fromData({version:1,level:26}).getSnapshot().power,ECONOMY.tools[25].power);
});
test('first strike immediate; switching targets, tapping again and waiting do not grant burst hits',()=>{
 const f=setup(),c=f.combat;assert.equal(c.hit('a',0).remaining,20);
 for(const t of [.01,.1,.49])assert.equal(c.hit('b',t).status,'cooldown');
 assert.equal(c.health.get('b',30),30);assert.equal(c.hit('b',.5).remaining,20);assert.equal(c.health.get('a',30),20);
 assert.equal(c.hit('b',100).remaining,10);assert.equal(c.hit('a',100).status,'cooldown');assert.equal(c.cooldown.nextAt,100.5);
});
test('full bag prevents damage or destruction and consumes no attack cooldown',()=>{
 const f=setup(),c=f.combat;c.hit('a',0);f.full(true);assert.equal(c.hit('a',1).status,'full');assert.equal(c.health.get('a',30),20);assert.equal(c.cooldown.nextAt,.5);
 f.full(false);assert.equal(c.hit('a',1).remaining,10);f.full(true);assert.equal(c.hit('a',2).status,'full');assert.equal(f.requests.length,0);
});
test('upgrade keeps previous cooldown; next hit uses new power then new interval',()=>{
 const f=setup(1000),c=f.combat,[five,six]=[5,6].map(l=>pickaxeStats(l));f.axe.setLevel(5);assert.equal(c.hit('a',0).remaining,1000-five.power);
 f.axe.setLevel(6);assert.equal(c.hit('a',1/five.speed-.001).status,'cooldown');assert.equal(c.hit('a',1/five.speed).remaining,1000-five.power-six.power);assert.equal(c.cooldown.nextAt,1/five.speed+1/six.speed);
 assert.equal(c.hit('a',1/five.speed+1/six.speed-.001).status,'cooldown');
});
test('real damage follows configured attack rate at 30, 60 and 120 FPS without cumulative rounding loss',()=>{
 for(const fps of [30,60,120])for(const level of [1,2,5,7,9,21,30]){
  const f=setup(1e9);f.axe.setLevel(level);
  const stats=f.axe.getSnapshot();let hits=0;
  for(let frame=0;frame<fps*10;frame++){
   const now=frame/fps,result=f.combat.hit('a',now);
   if(result.status==='hit'){
    hits++;
    // Repeating a command in the same frame never produces another attack.
    assert.equal(f.combat.hit('b',now).status,'cooldown');
   }
  }
  assert.equal(hits,stats.speed*10,`level ${level} at ${fps} FPS`);
  assert.equal(f.combat.health.get('a',1e9),1e9-hits*stats.power);
 }
});
test('long stalls discard missed attacks and begin a fresh cooldown',()=>{
 const f=setup(1000000);f.axe.setLevel(16);const {speed,power}=pickaxeStats(16);
 assert.equal(f.combat.hit('a',.01).status,'hit');assert.equal(f.combat.cooldown.nextAt,.01+1/speed);
 assert.equal(f.combat.hit('a',30).status,'hit');assert.equal(f.combat.cooldown.nextAt,30+1/speed);
 for(let i=0;i<100;i++)assert.equal(f.combat.hit('b',30).status,'cooldown');
 assert.equal(f.combat.health.get('a',1000000),1000000-2*power);
});
test('lethal hit queues destruction once; pending cells cannot take more damage',()=>{
 const f=setup(20),c=f.combat;assert.equal(c.hit('a',0).status,'hit');assert.equal(f.requests.length,0);
 assert.equal(c.hit('a',.5).status,'breaking');assert.equal(c.health.get('a',20),0);
 for(const now of [1,2,3])assert.equal(c.hit('a',now).status,'pending');assert.deepEqual(f.requests,['a']);
 f.removed.add('a');f.pending.delete('a');c.destroyed('a');assert.equal(c.health.size,0);assert.equal(c.hit('a',4).status,'unavailable');
});
test('failed destruction queue preserves last positive HP and does not consume the final hit',()=>{
 const f=setup(20),c=f.combat;c.hit('a',0);f.accept(false);
 assert.equal(c.hit('a',.5).status,'unavailable');assert.equal(c.health.get('a',20),10);assert.equal(c.cooldown.nextAt,.5);
 f.accept(true);assert.equal(c.hit('a',.5).status,'breaking');assert.equal(c.cooldown.nextAt,1);
});
test('cancelled zero-HP block retains damage and can retry without generating another hit',()=>{
 const f=setup(10),c=f.combat;c.hit('a',0);f.pending.clear();
 assert.equal(c.hit('a',.2).status,'cooldown');const retried=c.hit('a',1);assert.deepEqual(retried,{status:'breaking',remaining:0,damage:0});assert.equal(c.cooldown.nextAt,.5);
 assert.equal(c.hit('a',2).status,'pending');assert.equal(c.health.size,1);
});
test('damage never spreads to another cell; huge power still queues a single target',()=>{
 const f=setup(30);f.axe.setLevel(30);assert.equal(f.combat.hit('a',0).damage,30);
 assert.deepEqual(f.requests,['a']);assert.equal(f.combat.health.get('b',30),30);
});
test('all configured minerals take exactly ceil(HP / power) blows',()=>{
 for(const ore of ORE_ITEMS){const f=setup(ore.maxHp); let level=1; while(level<30&&pickaxeStats(level).power < ore.maxHp/40) level++; f.axe.setLevel(level); const stats=pickaxeStats(level), hits=Math.ceil(ore.maxHp/stats.power);
 for(let i=0;i<hits;i++){assert.equal(f.combat.hit('a',i/stats.speed).status,i===hits-1?'breaking':'hit')}
 assert.equal(f.requests.length,1);
 }
});
test('session publishes target changes only when needed; partial HP survives travel and targets',()=>{
 let now=0;const s=new GameSession(SESSION_CONTENT, 50,()=>now),changes=[];s.attach({cell:()=>67,pending:()=>false,mine:()=>true,cancelMining:()=>{}});
 const a=[8,-1,-25],b=[9,-1,-25];const unsub=s.subscribe(()=>changes.push(s.getSnapshot()));
 s.selectTarget(a);for(let i=0;i<100;i++)s.selectTarget([...a]);assert.equal(changes.length,1);
 assert.equal(s.hit(a).status,'hit');assert.equal(s.getSnapshot().target.hp,resourceByKind(67).maxHp-10);assert.equal(s.getSnapshot().inventory.used,0);
 s.selectTarget(b);s.resetPosition();s.selectTarget(a);assert.equal(s.getSnapshot().target.hp,resourceByKind(67).maxHp-10);assert.equal(s.hit(a).status,'cooldown');
 now=.5;assert.equal(s.hit(a).remaining,resourceByKind(67).maxHp-20);unsub();
});
test('session accepts only one target and credits destroyed results even when already full',()=>{
 let now=0,solid=true,pending=false;const s=new GameSession(SESSION_CONTENT, 1,()=>now);
 s.attach({cell:()=>solid?66:0,pending:()=>pending,mine:()=>{pending=true;return true},cancelMining:()=>{pending=false}});
 const a=[6,-1,-25];assert.equal(s.requestMine([a,[7,-1,-25]]),false);assert.equal(s.combatDebug().damagedCells,0);
 const hits=Math.ceil(resourceByKind(66).maxHp/10);for(let i=0;i<hits-1;i++){now=i*.5;assert.equal(s.hit(a).status,'hit')}now=(hits-1)*.5;assert.equal(s.hit(a).status,'breaking');assert.equal(s.getSnapshot().inventory.used,0);
 s.collected([{kind:64}]);solid=false;s.collected([{cell:a,kind:66}]);assert.equal(s.getSnapshot().inventory.used,1+resourceByKind(66).volume);assert.equal(s.combatDebug().damagedCells,0);
});
test('session pickaxe purchase publishes consistent level/coins without changing running cooldown',()=>{
 let now=0;const s=new GameSession({...SESSION_CONTENT,initialCoins:ECONOMY.tools[1].price}, 50,()=>now);s.attach({cell:()=>67,pending:()=>false,mine:()=>true,cancelMining:()=>{}});
 s.collected(Array.from({length:5},()=>({kind:64})));s.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);s.resetPosition();
 const a=[14,-1,-25];s.hit(a);const snapshots=[];s.subscribe(()=>snapshots.push(s.getSnapshot()));
 assert.equal(s.upgradePickaxe(1).status,'upgraded');assert.equal(snapshots.length,1);assert.equal(snapshots[0].coins,5*resourceByKind(64).price);assert.equal(snapshots[0].pickaxe.power,15);
 now=.1;assert.equal(s.hit(a).status,'cooldown');now=.5;assert.equal(s.hit(a).remaining,resourceByKind(67).maxHp-25);
});
