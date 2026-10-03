import assert from 'node:assert/strict';
import test from 'node:test';
import { Inventory } from '../../src/game/logic/Inventory.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
import { Mining } from '../../src/game/application/Mining.ts';
import { quoteSale, sellAll } from '../../src/game/application/Sale.ts';
import { upgradeBackpack } from '../../src/game/application/BackpackUpgrade.ts';
import { ORE_ITEMS, itemVolume, itemPrice, itemDefinition, SELL_ZONE } from '../../src/game/application/items.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
const batch=(count,itemId='stone')=>[{itemId,count}];
const volume=id=>{const n={stone:1,gold:10,gem:15,large:80}[id];if(n===undefined)throw Error('unknown item');return n};
const price=id=>({stone:1,gold:40,gem:80,large:100}[id]);

test('weighted inventory separates units from pieces; full never restricts valid add',()=>{
 const bag=new Inventory(50,volume);bag.add(batch(47));bag.add(batch(1,'gold'));
 assert.equal(bag.getSnapshot().used,57);assert.equal(bag.getSnapshot().totalCount,48);assert.equal(bag.getSnapshot().items.gold,1);assert.ok(bag.isFull());
 bag.add(batch(2,'gem'));assert.equal(bag.getSnapshot().used,87);assert.equal(bag.getSnapshot().totalCount,50);
 assert.ok(bag.remove(batch(1,'gold')));assert.equal(bag.getSnapshot().used,77);assert.equal(bag.getSnapshot().totalCount,49);
 assert.ok(bag.remove(batch(2,'gem')));assert.equal(bag.getSnapshot().used,47);assert.equal(bag.isFull(),false);
});
test('one item larger than the whole bag is accepted, including multi-kind duplicate batches',()=>{
 const bag=new Inventory(50,volume);bag.add([...batch(1,'large'),...batch(2,'gold'),...batch(3,'gold')]);
 assert.equal(bag.getSnapshot().used,130);assert.equal(bag.getSnapshot().totalCount,6);assert.equal(bag.getSnapshot().items.gold,5);
 const zero=new Inventory(0,volume);zero.add(batch(1,'large'));assert.equal(zero.getSnapshot().used,80);
});
test('unknown metadata, invalid volumes, weighted multiplication and sum overflow leave whole batch untouched',()=>{
 for(const bad of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER]){
  const bag=new Inventory(50,id=>id==='bad'?bad:1);bag.add(batch(1));const before=bag.getSnapshot();
  assert.throws(()=>bag.add([...batch(3,'gift'),...batch(2,'bad')]));assert.equal(bag.getSnapshot(),before);
 }
 const unknown=new Inventory(50,volume);unknown.add(batch(1));const before=unknown.exportData();
 assert.throws(()=>unknown.add([...batch(3,'gold'),...batch(1,'missing')]));assert.deepEqual(unknown.exportData(),before);
 const sum=new Inventory(50,()=>1);sum.add(batch(Number.MAX_SAFE_INTEGER));const old=sum.getSnapshot();assert.throws(()=>sum.add(batch(1,'other')));assert.equal(sum.getSnapshot(),old);
});
test('weighted DTO remains quantity based; restore recalculates fullness using injected definitions',()=>{
 const bag=new Inventory(50,volume);bag.add([...batch(2,'large'),...batch(3,'gold')]);
 const data=JSON.parse(JSON.stringify(bag.exportData()));assert.deepEqual(data,{version:1,capacity:50,items:{large:2,gold:3}});
 const restored=Inventory.fromData(data,volume);assert.deepEqual(restored.getSnapshot(),bag.getSnapshot());data.items.large=0;assert.equal(restored.getSnapshot().used,190);
 restored.setCapacity(200);assert.equal(restored.isFull(),false);restored.setCapacity(1);assert.equal(restored.getSnapshot().totalCount,5);assert.equal(restored.getSnapshot().used,190);
});
test('independent sale quote uses quantity times price, never volume or capacity; quote is read only',()=>{
 const bag=new Inventory(1,volume),wallet=new Wallet(7);bag.add([...batch(2,'gold'),...batch(3,'gem')]);const before=bag.getSnapshot();
 assert.deepEqual(quoteSale(before.items,price),{status:'quoted',count:5,coins:320});assert.equal(bag.getSnapshot(),before);assert.equal(before.used,65);
 assert.deepEqual(sellAll(bag,wallet,price),{status:'sold',count:5,coins:320});assert.equal(wallet.getBalance(),327);assert.equal(bag.getSnapshot().used,0);
 assert.deepEqual(sellAll(bag,wallet,price),{status:'empty'});assert.equal(wallet.getBalance(),327);
});
test('pricing failure and unsafe proceeds preserve inventory and wallet',()=>{
 for(const pricing of [()=>{throw Error('missing price')},()=>-1,()=>NaN]){
  const bag=new Inventory(50,volume),wallet=new Wallet(5);bag.add(batch(1,'gold'));const before=bag.getSnapshot();
  assert.throws(()=>sellAll(bag,wallet,pricing));assert.equal(bag.getSnapshot(),before);assert.equal(wallet.getBalance(),5);
 }
 for(const [count,balance] of [[2,0],[1,1]]){
  const bag=new Inventory(50),wallet=new Wallet(balance);bag.add(batch(count));const before=bag.getSnapshot();
  assert.deepEqual(sellAll(bag,wallet,()=>Number.MAX_SAFE_INTEGER),{status:'overflow'});assert.equal(bag.getSnapshot(),before);assert.equal(wallet.getBalance(),balance);
 }
});
test('mining checks existing occupied volume, accepts oversize yield and never truncates completed batches',()=>{
 const bag=new Inventory(50,volume),requests=[];bag.add(batch(47));
 const mine=new Mining(bag,targets=>{requests.push(targets);return true},items=>items);
 assert.equal(mine.request(['gold']),'accepted');mine.collected(batch(1,'gold'));assert.equal(bag.getSnapshot().used,57);assert.equal(mine.request(['next']),'full');
 mine.collected([...batch(2,'gem'),...batch(1,'large')]);assert.equal(bag.getSnapshot().used,167);assert.equal(requests.length,1);
});
test('weighted capacity upgrades preserve pieces and occupied volume and reopen mining',()=>{
 const bag=new Inventory(50,volume),wallet=new Wallet(20);bag.add([...batch(47),...batch(1,'gold')]);
 assert.equal(upgradeBackpack('bag-100',bag,wallet).status,'upgraded');assert.equal(bag.getSnapshot().used,57);assert.equal(bag.getSnapshot().totalCount,48);assert.equal(bag.isFull(),false);assert.equal(wallet.getBalance(),0);
});
test('temporary mineral table has increasing price/HP/volume growth and immutable definitions',()=>{
 for(let i=1;i<ORE_ITEMS.length;i++){
  const a=ORE_ITEMS[i-1],b=ORE_ITEMS[i];assert.ok(b.volume>a.volume);
  assert.ok(b.maxHp/a.maxHp>b.volume/a.volume);assert.ok(b.price/a.price>b.maxHp/a.maxHp);
  assert.equal(itemVolume(b.itemId),b.volume);assert.equal(itemPrice(b.itemId),b.price);
 }
 assert.throws(()=>{ORE_ITEMS[0].volume=99});assert.throws(()=>itemDefinition('unknown'));
});
test('session shows mixed-unit snapshots and sells completed overflow at independent prices once',()=>{
 let now=0,solid=true;const session=new GameSession(50,()=>now);
 session.attach({cell:()=>solid?5:0,pending:()=>false,mine:()=>true,cancelMining:()=>{},returnToSurface:()=>{}});
 session.collected(Array.from({length:47},()=>({kind:1})));const cell=[11,-1,-25];session.selectTarget(cell);
 assert.equal(session.getSnapshot().target.volume,10);assert.equal(session.getSnapshot().target.price,40);
 for(let i=0;i<20;i++){now=i*.5;assert.equal(session.hit(cell).status,i===19?'breaking':'hit')}
 solid=false;session.collected([{cell,kind:5}]);let s=session.getSnapshot();assert.equal(s.inventory.used,57);assert.equal(s.inventory.totalCount,48);assert.deepEqual(s.sale,{status:'quoted',count:48,coins:87});
 solid=true;now+=.5;assert.equal(session.hit([12,-1,-25]).status,'full');assert.equal(session.blockHealth([12,-1,-25]),200);
 session.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);s=session.getSnapshot();assert.equal(s.coins,87);assert.equal(s.inventory.totalCount,0);assert.match(s.notice,/48 件.*87 金币/);
 session.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);assert.equal(session.getSnapshot().coins,87);
});
