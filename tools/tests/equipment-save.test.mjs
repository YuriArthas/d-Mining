import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {GAME_CONTENT} from '../../src/game/content/gameContent.ts';
import {ECONOMY} from '../../src/game/content/economy.ts';
const content=GAME_CONTENT.session;
const seed=()=>new GameSession(content).exportProgress();
const read=d=>GameSession.fromData(d,content);
const cap=t=>ECONOMY.bags[t-1].capacity;

test('legacy capacity migrates by purchased tier, keeping skipped ownership and a lower equipped bag',()=>{
 const d=seed();d.inventory={version:1,capacity:30,items:{'journey.stone':3}};
 // Use the actual starting rock id, including every locked item and quantity.
 const id=ECONOMY.layers[0].rock.itemId;d.inventory.items={[id]:300};d.inventory.locked=[id];
 d.equipment={version:1,toolLevel:1,enhance:0,backpackCapacity:500,backpacks:[25,30,500]};
 const s=read(d),v=s.getSnapshot();assert.equal(v.inventory.capacity,cap(2));assert.equal(v.inventory.used,300);assert.ok(v.inventory.isFull);
 assert.deepEqual(v.equipment.backpacks,[cap(1),cap(2),cap(30)]);assert.equal(v.equipment.backpackCapacity,cap(30));
 assert.deepEqual(v.inventory.items,{[id]:300});assert.deepEqual(v.inventory.locked,[id]);
 const save=s.exportProgress();assert.deepEqual(save.equipment,{version:2,toolLevel:1,enhance:0,backpackTier:30,equippedBackpackTier:2,backpackTiers:[1,2,30]});
 assert.deepEqual(read(save).exportProgress(),save,'migration runs once');
});
test('all thirty old sequential capacities preserve their tier; version two uses stable identity',()=>{
 const old=[25,30,35,40,50,60,70,80,90,100,110,120,140,160,180,200,220,240,260,280,300,320,340,360,380,400,420,450,480,500];
 old.forEach((capacity,i)=>{const d=seed();delete d.equipment;d.inventory.capacity=capacity;const s=read(d);assert.equal(s.getSnapshot().inventory.capacity,cap(i+1));assert.equal(s.exportProgress().equipment.backpackTier,i+1);});
 const d=seed();d.equipment.backpackTier=d.equipment.equippedBackpackTier=4;d.inventory.capacity=999;assert.equal(read(d).getSnapshot().inventory.capacity,cap(4),'cached capacity is not identity');
});
test('unknown old capacities, unsupported versions, invalid or unowned equipped tiers fail loudly',()=>{
 for(const change of [d=>{delete d.equipment;d.inventory.capacity=777},d=>{d.equipment.version=3},d=>{d.equipment.backpackTier=31},d=>{d.equipment.equippedBackpackTier=1.5},d=>{d.equipment.backpackTiers=[2]},d=>{d.equipment.backpackTier=3;d.equipment.equippedBackpackTier=2;d.equipment.backpackTiers=[1,3]}]){
  const d=seed();change(d);assert.throws(()=>read(d));
 }
});
