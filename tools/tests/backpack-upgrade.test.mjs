import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
const SESSION_CONTENT = GAME_CONTENT.session, SELL_ZONE = SESSION_CONTENT.sales[0];
import assert from 'node:assert/strict';
import test from 'node:test';
import { Inventory } from '../../src/game/logic/Inventory.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
import { JOURNEY_BACKPACKS } from '../../src/game/content/journeyResources.ts';
import { resourceByKind } from '../../src/game/content/resources.ts';
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
test('session publishes one coherent purchase snapshot and mining immediately uses updated capacity',()=>{
 const session=new GameSession(SESSION_CONTENT),observed=[];session.attach({cell:()=>64,pending:()=>false,mine:()=>true,cancelMining:()=>{}});
 const first=JOURNEY_BACKPACKS[0],ore=resourceByKind(64+3),rock=resourceByKind(64),count=Math.ceil(first.price/ore.price);
 session.collected(Array.from({length:count},()=>({kind:ore.kind})));session.updatePosition([SELL_ZONE.x,SELL_ZONE.y,SELL_ZONE.z],true);session.resetPosition();
 session.collected(Array.from({length:50/rock.volume+7},()=>({kind:rock.kind})));assert.equal(session.requestMine([[0,-1,0]]),false);
 const unsub=session.subscribe(()=>observed.push(session.getSnapshot()));
 assert.equal(session.upgradeBackpack(first.id).status,'upgraded');assert.equal(observed.length,1);
 assert.equal(observed[0].inventory.capacity,first.capacity);assert.equal(observed[0].inventory.used,50+7*rock.volume);assert.equal(observed[0].coins,count*ore.price-first.price);
 assert.equal(session.upgradeBackpack(first.id).status,'stale');assert.equal(observed.length,1);assert.equal(session.requestMine([[0,-1,0]]),true);
 unsub();
});
