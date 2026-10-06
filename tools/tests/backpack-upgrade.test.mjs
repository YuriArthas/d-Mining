import {SURFACE_SELL as SELL_ZONE} from '../../src/game/world/rooms.ts';
import {SESSION_CONTENT} from '../../src/game/world/sessionContent.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Inventory } from '../../src/game/logic/Inventory.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
import { BACKPACK_TIERS, backpackOffer, upgradeBackpack } from '../../src/game/application/BackpackUpgrade.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';

const seed=(bag,count)=>bag.add([{itemId:'ore',count}]);
test('capacity API is independent of upgrades: increasing/decreasing preserves contents and unrestricted add',()=>{
 const bag=new Inventory(50);seed(bag,80);assert.ok(bag.isFull());bag.setCapacity(100);
 assert.equal(bag.isFull(),false);assert.equal(bag.getSnapshot().used,80);bag.setCapacity(0);seed(bag,10);
 assert.equal(bag.getSnapshot().used,90);assert.ok(bag.isFull());assert.equal(bag.exportData().capacity,0);
 assert.deepEqual(Inventory.fromData(bag.exportData()).getSnapshot(),bag.getSnapshot());
 const state=bag.getSnapshot();assert.throws(()=>bag.setCapacity(-1));assert.equal(bag.getSnapshot(),state);
 bag.setCapacity(0);assert.equal(bag.getSnapshot(),state);
});
test('upgrade refuses insufficient funds without changing capacity or coins',()=>{
 const bag=new Inventory(50),wallet=new Wallet(19);seed(bag,57);
 assert.equal(backpackOffer(50,19).canAfford,false);
 assert.deepEqual(upgradeBackpack('bag-100',bag,wallet),{status:'insufficient'});
 assert.equal(bag.capacity,50);assert.equal(bag.getSnapshot().used,57);assert.equal(wallet.getBalance(),19);
});
test('upgrade spends exact price, preserves over-capacity contents, and updates full query',()=>{
 const bag=new Inventory(50),wallet=new Wallet(20);seed(bag,57);
 assert.deepEqual(upgradeBackpack('bag-100',bag,wallet),{status:'upgraded',capacity:100,spent:20});
 assert.equal(wallet.getBalance(),0);assert.equal(bag.getSnapshot().used,57);assert.equal(bag.isFull(),false);
 seed(bag,100);assert.equal(bag.getSnapshot().used,157);
});
test('stale, repeated and skipped-tier purchases cannot debit or silently buy the next tier',()=>{
 const bag=new Inventory(50),wallet=new Wallet(200);
 assert.equal(upgradeBackpack('bag-400',bag,wallet).status,'stale');assert.equal(wallet.getBalance(),200);
 assert.equal(upgradeBackpack('bag-100',bag,wallet).status,'upgraded');
 assert.equal(upgradeBackpack('bag-100',bag,wallet).status,'stale');assert.equal(wallet.getBalance(),180);assert.equal(bag.capacity,100);
});
test('tier progression and maximum derive from capacity; configuration is immutable',()=>{
 const bag=new Inventory(50),wallet=new Wallet(170);
 for(const tier of BACKPACK_TIERS){assert.equal(backpackOffer(bag.capacity,wallet.getBalance()).next.id,tier.id);assert.equal(upgradeBackpack(tier.id,bag,wallet).status,'upgraded')}
 assert.equal(bag.capacity,400);assert.equal(wallet.getBalance(),0);assert.deepEqual(backpackOffer(400,1000),{next:null,canAfford:false});
 assert.equal(upgradeBackpack('bag-400',bag,wallet).status,'max');assert.throws(()=>{BACKPACK_TIERS[0].price=0});
 assert.equal(backpackOffer(150,100).next.id,'bag-200');
});
test('session publishes one coherent purchase snapshot and mining immediately uses updated capacity',()=>{
 const session=new GameSession(SESSION_CONTENT),observed=[];session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining:()=>{},returnToSurface:()=>{}});
 session.collected(Array.from({length:20},()=>({kind:1})));session.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);session.resetPosition();
 session.collected(Array.from({length:57},()=>({kind:1})));assert.equal(session.requestMine([[0,-1,0]]),false);
 const unsub=session.subscribe(()=>observed.push(session.getSnapshot()));
 assert.equal(session.upgradeBackpack('bag-100').status,'upgraded');assert.equal(observed.length,1);
 assert.equal(observed[0].inventory.capacity,100);assert.equal(observed[0].inventory.used,57);assert.equal(observed[0].coins,0);
 assert.equal(session.upgradeBackpack('bag-100').status,'stale');assert.equal(observed.length,1);assert.equal(session.requestMine([[0,-1,0]]),true);
 unsub();
});
