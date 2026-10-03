import assert from 'node:assert/strict';
import test from 'node:test';
import { Inventory } from '../../src/game/logic/Inventory.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
import { ZoneDetector } from '../../src/game/logic/ZoneDetector.ts';
import { Mining } from '../../src/game/application/Mining.ts';
import { sellAll } from '../../src/game/application/Sale.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { SELL_ZONE, oreDrops } from '../../src/game/application/items.ts';
const item = (count, itemId='stone') => [{itemId, count}];
test('inventory accepts batches before, at and beyond capacity; zero capacity is only information',()=>{
 const bag=new Inventory(50);bag.add(item(49));assert.equal(bag.isFull(),false);
 bag.add([{itemId:'coal',count:3},{itemId:'copper',count:5}]);assert.equal(bag.getSnapshot().used,57);assert.equal(bag.isFull(),true);
 bag.add(item(8));assert.equal(bag.getSnapshot().used,65);
 const zero=new Inventory(0);assert.ok(zero.isFull());zero.add(item(80,'gift'));assert.equal(zero.getSnapshot().used,80);
});
test('batch addition equals sequential additions, including duplicate IDs and overflow of capacity',()=>{
 const a=new Inventory(1),b=new Inventory(1),items=[...item(4,'coal'),...item(7,'copper'),...item(3,'coal')];
 a.add(items);for(const i of items)b.add([i]);assert.deepEqual(a.getSnapshot(),b.getSnapshot());assert.equal(a.getSnapshot().items.coal,7);
 const snapshot=a.getSnapshot();a.add([]);assert.equal(a.getSnapshot(),snapshot);
});
test('invalid batches never partially change inventory; numeric overflow is not capacity overflow',()=>{
 const bag=new Inventory(1);bag.add(item(2));const snapshot=bag.getSnapshot();
 for(const bad of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER]) {
  assert.throws(()=>bag.add([...item(3,'gift'),...item(bad)]));assert.equal(bag.getSnapshot(),snapshot);
 }
 assert.throws(()=>bag.add(item(1,'')));assert.equal(bag.getSnapshot(),snapshot);
});
test('removal validates whole batch and restores queried fullness without external policy',()=>{
 const bag=new Inventory(5);bag.add([...item(4),...item(3,'gift')]);
 assert.equal(bag.remove([...item(2),...item(4,'gift')]),false);assert.equal(bag.getSnapshot().used,7);
 assert.equal(bag.remove(item(3,'gift')),true);assert.equal(bag.isFull(),false);assert.equal('gift' in bag.getSnapshot().items,false);
});
test('DTO accepts over-capacity and non-mineral IDs, independent copies, safe prototype keys',()=>{
 const bag=new Inventory(1);bag.add([...item(8,'gift'),...item(2,'__proto__')]);
 const dto=JSON.parse(JSON.stringify(bag.exportData())),restored=Inventory.fromData(dto);
 assert.deepEqual(restored.getSnapshot(),bag.getSnapshot());dto.items.gift=0;assert.equal(restored.getSnapshot().items.gift,8);
 assert.throws(()=>{restored.getSnapshot().items.gift=100});
 for(const data of [{version:2,capacity:1,items:{}},{version:1,capacity:-1,items:{}},{version:1,capacity:1,items:{gift:0}},{version:1,capacity:1,items:[]}]) assert.throws(()=>Inventory.fromData(data));
});
test('wallet is independent and rejects invalid amounts without losing its balance',()=>{
 const wallet=new Wallet(3);assert.equal(wallet.debit(4),false);assert.equal(wallet.getBalance(),3);
 assert.throws(()=>wallet.credit(-1));assert.equal(wallet.debit(3),true);wallet.credit(9);assert.equal(wallet.getBalance(),9);
 assert.equal(wallet.canCredit(Number.MAX_SAFE_INTEGER),false);
});
test('mining checks full at request, collected items never check it again',()=>{
 const bag=new Inventory(5),requests=[];bag.add(item(4));
 const mining=new Mining(bag,targets=>{requests.push(targets);return true},resources=>resources);
 assert.equal(mining.request(['a','b']), 'accepted');bag.add(item(10,'gift')); // Another source fills it while terrain is working.
 mining.collected(item(8,'ore'));assert.equal(bag.getSnapshot().used,22);
 assert.equal(mining.request(['c']), 'full');assert.equal(requests.length,1);
 bag.remove(Object.entries(bag.getSnapshot().items).map(([itemId,count])=>({itemId,count})));
 assert.equal(mining.request(['c']), 'accepted');
});
test('already accepted multiple requests all reward even if an earlier completion fills the bag',()=>{
 const bag=new Inventory(1),mining=new Mining(bag,()=>true,resources=>resources);
 assert.equal(mining.request(['a']), 'accepted');assert.equal(mining.request(['b']), 'accepted');
 mining.collected(item(2));mining.collected(item(3));assert.equal(bag.getSnapshot().used,5);
 assert.equal(mining.request(['c']), 'full');
});
test('one resource can yield several kinds and quantities without changing inventory or mining',()=>{
 const bag=new Inventory(1),mining=new Mining(bag,()=>true,resources=>resources.flatMap(()=>[...item(5,'gem'),...item(2,'dust')]));
 assert.equal(mining.request(['one']), 'accepted');mining.collected(['one']);assert.deepEqual(bag.getSnapshot().items,{gem:5,dust:2});
});
test('failed world request and empty completion grant nothing',()=>{
 const bag=new Inventory(5),mining=new Mining(bag,()=>false,resources=>resources);
 assert.equal(mining.request(['a']), 'unavailable');mining.collected([]);assert.equal(bag.getSnapshot().used,0);
});
test('sale is independent of mining/scene and sells all quantities including overflow at one coin',()=>{
 const bag=new Inventory(1),wallet=new Wallet(7);bag.add([...item(3,'gift'),...item(8,'gem')]);
 assert.deepEqual(sellAll(bag,wallet,()=>1),{status:'sold',count:11,coins:11});assert.equal(wallet.getBalance(),18);assert.equal(bag.getSnapshot().used,0);
 assert.deepEqual(sellAll(bag,wallet,()=>1),{status:'empty'});assert.equal(wallet.getBalance(),18);
});
test('wallet overflow is checked before sale removes inventory',()=>{
 const bag=new Inventory(1),wallet=new Wallet(Number.MAX_SAFE_INTEGER);bag.add(item(2));
 assert.equal(sellAll(bag,wallet,()=>1).status,'overflow');assert.equal(bag.getSnapshot().used,2);assert.equal(wallet.getBalance(),Number.MAX_SAFE_INTEGER);
});
test('zone reports only edges, uses grounded/height and radial hysteresis',()=>{
 const zone=new ZoneDetector(SELL_ZONE),c=SELL_ZONE,p=[c.x,c.y,c.z];
 assert.equal(zone.update(p,false),null);assert.equal(zone.update([c.x,c.y-10,c.z],true),null);
 assert.equal(zone.update(p,true),'enter');assert.equal(zone.update(p,true),null);
 assert.equal(zone.update([c.x+c.radius+0.1,c.y,c.z],true),null);
 assert.equal(zone.update([c.x+c.radius+0.3,c.y,c.z],true),'exit');
 assert.equal(zone.update([c.x+c.radius+0.1,c.y,c.z],true),null);assert.equal(zone.update(p,true),'enter');
});
test('session wires cancel-before-sale; snapshots publish only consistent inventory/wallet state',()=>{
 const session=new GameSession(1),events=[],observed=[];
 const detach=session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining:()=>events.push('cancel'),returnToSurface:()=>events.push('return')});
 const unsub=session.subscribe(()=>observed.push(session.getSnapshot()));
 session.collected([{kind:3},{kind:4}]);assert.equal(session.requestMine([[0,-1,0]]),false);
 session.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);
 assert.deepEqual(events,['cancel']);assert.equal(observed.at(-1).coins,24);assert.equal(observed.at(-1).inventory.used,0);
 const count=observed.length;session.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);assert.equal(observed.length,count);
 assert.equal(session.requestMine([[0,-1,0]]),false);
 session.returnToSurface();assert.deepEqual(events,['cancel','cancel','return']);assert.equal(session.getSnapshot().coins,24);
 assert.equal(session.requestMine([[0,-1,0]]),true);unsub();detach();assert.equal(session.requestMine([[0,-1,0]]),false);
});
test('session completed yield is credited even if bag is already full; return preserves it',()=>{
 const session=new GameSession(1);session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining:()=>{},returnToSurface:()=>{}});
 assert.equal(session.requestMine([[0,-1,0]]),true);session.collected([{kind:1}]);session.collected([{kind:2},{kind:6}]);
 assert.equal(session.getSnapshot().inventory.used,18);session.returnToSurface();assert.equal(session.getSnapshot().inventory.used,18);
 assert.equal(oreDrops([{kind:1},{kind:2},{kind:3},{kind:4},{kind:5},{kind:6}]).length,6);
});
