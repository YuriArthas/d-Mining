import {resourceByKind} from '../../src/game/content/resources.ts';
import {pickaxeStats} from '../../src/game/logic/Pickaxe.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Inventory } from '../../src/game/logic/Inventory.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
import { Mining } from '../../src/game/application/Mining.ts';
import { quoteSale, sellItems } from '../../src/game/application/Sale.ts';
import { ORE_ITEMS, itemVolume, itemPrice, itemDefinition } from '../../src/game/application/items.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';

const SESSION_CONTENT = GAME_CONTENT.session, SELL_ZONE = SESSION_CONTENT.sales[0];
const batch=(count,itemId='stone')=>[{itemId,count}];
const volume=id=>{const n={stone:1,gold:10,gem:15,large:80}[id];if(n===undefined)throw Error('unknown item');return n};
const price=id=>({stone:1,gold:40,gem:80,large:100}[id]);
const gold=wallet=>({canCredit:n=>wallet.canCredit('gold',n),credit:n=>wallet.credit('gold',n)});

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
 const bag=new Inventory(1,volume),wallet=new Wallet({gold:7}),till=gold(wallet);bag.add([...batch(2,'gold'),...batch(3,'gem')]);const before=bag.getSnapshot();
 assert.deepEqual(quoteSale(before.items,price),{status:'quoted',count:5,coins:320});assert.equal(bag.getSnapshot(),before);assert.equal(before.used,65);
 assert.deepEqual(sellItems(bag,till,price),{status:'sold',count:5,coins:320});assert.equal(wallet.getBalance('gold'),327);assert.equal(bag.getSnapshot().used,0);
 assert.deepEqual(sellItems(bag,till,price),{status:'empty'});assert.equal(wallet.getBalance('gold'),327);
});
test('pricing failure and unsafe proceeds preserve inventory and wallet',()=>{
 for(const pricing of [()=>{throw Error('missing price')},()=>-1,()=>NaN]){
  const bag=new Inventory(50,volume),wallet=new Wallet({gold:5});bag.add(batch(1,'gold'));const before=bag.getSnapshot();
  assert.throws(()=>sellItems(bag,gold(wallet),pricing));assert.equal(bag.getSnapshot(),before);assert.equal(wallet.getBalance('gold'),5);
 }
 for(const [count,balance] of [[2,0],[1,1]]){
  const bag=new Inventory(50),wallet=new Wallet({gold:balance});bag.add(batch(count));const before=bag.getSnapshot();
  assert.deepEqual(sellItems(bag,gold(wallet),()=>Number.MAX_SAFE_INTEGER),{status:'overflow'});assert.equal(bag.getSnapshot(),before);assert.equal(wallet.getBalance('gold'),balance);
 }
});
test('mining checks existing occupied volume, accepts oversize yield and never truncates completed batches',()=>{
 const bag=new Inventory(50,volume),requests=[];bag.add(batch(47));
 const mine=new Mining(bag,targets=>{requests.push(targets);return true},items=>items);
 assert.equal(mine.request(['gold']),'accepted');mine.collected(batch(1,'gold'));assert.equal(bag.getSnapshot().used,57);assert.equal(mine.request(['next']),'full');
 mine.collected([...batch(2,'gem'),...batch(1,'large')]);assert.equal(bag.getSnapshot().used,167);assert.equal(requests.length,1);
});
test('resource quantities remain stable and definitions are immutable',()=>{
 for(const r of ORE_ITEMS){assert.ok(r.volume>0&&r.maxHp>0&&r.price>0);assert.ok(Object.isFrozen(r));assert.equal(itemVolume(r.itemId),r.volume);assert.equal(itemPrice(r.itemId),r.price);}
 assert.throws(()=>{ORE_ITEMS[0].volume=99});assert.throws(()=>itemDefinition('unknown'));
});

test('base rock occupies many units; quantities, prices and saves still count whole blocks',()=>{
 const s=new GameSession(SESSION_CONTENT),rock=resourceByKind(64),deep=resourceByKind(65);
 assert.equal(rock.volume,1);assert.equal(deep.volume,12);
 assert.ok(ORE_ITEMS.filter(r=>r.base).every(r=>r.volume>=1));assert.ok(ORE_ITEMS.filter(r=>!r.base).every(r=>r.volume===1));
 s.collected([{kind:64},{kind:65}]);assert.equal(s.getSnapshot().inventory.used,13);assert.equal(s.getSnapshot().inventory.totalCount,2);
 assert.equal(s.getSnapshot().sale.coins,rock.price+deep.price);
 const saved=s.exportProgress(),r=GameSession.fromData(saved,SESSION_CONTENT);assert.equal(r.getSnapshot().inventory.used,13);
 r.collected([{kind:65}]);assert.equal(r.getSnapshot().inventory.isFull,true);
 const quote=r.getSnapshot().sale;r.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);
 assert.equal(r.getSnapshot().coins,SESSION_CONTENT.initialCoins+quote.coins);assert.equal(r.getSnapshot().inventory.used,0);
 r.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);assert.equal(r.getSnapshot().coins,SESSION_CONTENT.initialCoins+quote.coins);
 // Old save quantities survive the new volume even if the bag is now over capacity.
 saved.inventory.items[rock.itemId]=30;
 const legacy=GameSession.fromData(saved,SESSION_CONTENT);assert.equal(legacy.getSnapshot().inventory.totalCount,31);assert.equal(legacy.getSnapshot().inventory.used,42);
});
test('pending base blocks reserve their volume; final oversize yield is delivered once, subsequent mining refuses',()=>{
 let now=0,pending=0;
 const initial=new GameSession(SESSION_CONTENT).exportProgress();initial.pickaxe.level=28;initial.equipment.toolLevel=28;
 const s=new GameSession(SESSION_CONTENT,25,()=>now,{},initial);
 s.attach({cell:()=>64,pending:()=>false,mine:()=>{pending++;return true;},pendingVolume:volume=>pending*volume(64),cancelMining(){}});
 s.collected(Array.from({length:24},()=>({kind:64})));
 const a=[11,-1,-25],b=[12,-1,-25];assert.equal(s.hit(a).status,'breaking');assert.equal(pending,1);
 now+=1;assert.equal(s.hit(b).status,'full');assert.equal(s.getSnapshot().inventory.used,24);
 pending=0;s.collected([{cell:a,kind:64}]);assert.equal(s.getSnapshot().inventory.used,25);assert.equal(s.getSnapshot().inventory.totalCount,25);
});
