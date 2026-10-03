import assert from 'node:assert/strict';
import test from 'node:test';
import { BlockHealth } from '../../src/game/logic/BlockHealth.ts';
import { MiningCombat } from '../../src/game/application/MiningCombat.ts';
import { Pickaxe, pickaxeStats } from '../../src/game/logic/Pickaxe.ts';
import { pickaxeOffer, upgradePickaxe } from '../../src/game/application/PickaxeUpgrade.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { SELL_ZONE, ORE_ITEMS } from '../../src/game/application/items.ts';
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
test('power rises each level, speed increases every five levels and caps independently',()=>{
 for(const [level,power,speed] of [[1,10,2],[2,15,2],[5,30,2],[6,35,4],[10,55,4],[11,60,8],[15,80,8],[16,85,16],[61,310,16],[1000,5005,16]]){
  const s=pickaxeStats(level);assert.equal(s.power,power);assert.equal(s.speed,speed);
 }
 assert.equal(pickaxeStats(5).levelsUntilSpeed,1);assert.equal(pickaxeStats(6).levelsUntilSpeed,5);assert.equal(pickaxeStats(16).levelsUntilSpeed,null);
 assert.throws(()=>pickaxeStats(0));assert.throws(()=>pickaxeStats(Number.MAX_SAFE_INTEGER));
});
test('pickaxe upgrade validates funds and expected level, spends once, and continues after speed cap',()=>{
 const axe=new Pickaxe(),wallet=new Wallet(4);assert.equal(pickaxeOffer(1,4).canAfford,false);
 assert.equal(upgradePickaxe(1,axe,wallet).status,'insufficient');assert.equal(wallet.getBalance(),4);wallet.credit(1);
 assert.equal(upgradePickaxe(1,axe,wallet).status,'upgraded');assert.equal(axe.getSnapshot().level,2);assert.equal(wallet.getBalance(),0);
 assert.equal(upgradePickaxe(1,axe,wallet).status,'stale');axe.setLevel(61);wallet.credit(1000);
 assert.equal(upgradePickaxe(61,axe,wallet).status,'upgraded');assert.equal(axe.getSnapshot().power,315);assert.equal(axe.getSnapshot().speed,16);
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
 const f=setup(100),c=f.combat;f.axe.setLevel(5);assert.equal(c.hit('a',0).remaining,70);
 f.axe.setLevel(6);assert.equal(c.hit('a',.499).status,'cooldown');assert.equal(c.hit('a',.5).remaining,35);assert.equal(c.cooldown.nextAt,.5+1/4);
 assert.equal(c.hit('a',.749).status,'cooldown');
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
 const f=setup(30);f.axe.setLevel(1000);assert.equal(f.combat.hit('a',0).damage,30);
 assert.deepEqual(f.requests,['a']);assert.equal(f.combat.health.get('b',30),30);
});
test('all configured minerals take exactly ceil(HP / power) blows',()=>{
 for(const ore of ORE_ITEMS){const f=setup(ore.maxHp);const hits=Math.ceil(ore.maxHp/10);
 for(let i=0;i<hits;i++){assert.equal(f.combat.hit('a',i*.5).status,i===hits-1?'breaking':'hit')}
 assert.equal(f.requests.length,1);
 }
});
test('session publishes target changes only when needed; partial HP survives travel and targets',()=>{
 let now=0;const s=new GameSession(50,()=>now),changes=[];s.attach({cell:()=>4,pending:()=>false,mine:()=>true,cancelMining:()=>{},returnToSurface:()=>{}});
 const a=[8,-1,-25],b=[9,-1,-25];const unsub=s.subscribe(()=>changes.push(s.getSnapshot()));
 s.selectTarget(a);for(let i=0;i<100;i++)s.selectTarget([...a]);assert.equal(changes.length,1);
 assert.equal(s.hit(a).status,'hit');assert.equal(s.getSnapshot().target.hp,80);assert.equal(s.getSnapshot().inventory.used,0);
 s.selectTarget(b);s.resetPosition();s.selectTarget(a);assert.equal(s.getSnapshot().target.hp,80);assert.equal(s.hit(a).status,'cooldown');
 now=.5;assert.equal(s.hit(a).remaining,70);unsub();
});
test('session accepts only one target and credits destroyed results even when already full',()=>{
 let now=0,solid=true,pending=false;const s=new GameSession(1,()=>now);
 s.attach({cell:()=>solid?3:0,pending:()=>pending,mine:()=>{pending=true;return true},cancelMining:()=>{pending=false},returnToSurface:()=>{}});
 const a=[6,-1,-25];assert.equal(s.requestMine([a,[7,-1,-25]]),false);assert.equal(s.combatDebug().damagedCells,0);
 for(let i=0;i<4;i++){now=i*.5;assert.equal(s.hit(a).status,'hit')}now=2;assert.equal(s.hit(a).status,'breaking');assert.equal(s.getSnapshot().inventory.used,0);
 s.collected([{kind:1}]);solid=false;s.collected([{cell:a,kind:3}]);assert.equal(s.getSnapshot().inventory.used,4);assert.equal(s.combatDebug().damagedCells,0);
});
test('session pickaxe purchase publishes consistent level/coins without changing running cooldown',()=>{
 let now=0;const s=new GameSession(50,()=>now);s.attach({cell:()=>6,pending:()=>false,mine:()=>true,cancelMining:()=>{},returnToSurface:()=>{}});
 s.collected(Array.from({length:5},()=>({kind:1})));s.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);s.resetPosition();
 const a=[14,-1,-25];s.hit(a);const snapshots=[];s.subscribe(()=>snapshots.push(s.getSnapshot()));
 assert.equal(s.upgradePickaxe(1).status,'upgraded');assert.equal(snapshots.length,1);assert.equal(snapshots[0].coins,0);assert.equal(snapshots[0].pickaxe.power,15);
 now=.1;assert.equal(s.hit(a).status,'cooldown');now=.5;assert.equal(s.hit(a).remaining,325);
});
