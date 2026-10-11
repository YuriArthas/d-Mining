import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, EGG_STAGES, upgradePrice } from '../../src/game/content/progression.ts';
import { RESOURCES, resourceByKind } from '../../src/game/content/resources.ts';
import { PET_CONTENT } from '../../src/game/content/pets.ts';
import { SESSION_CONTENT } from '../../src/game/world/sessionContent.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { SparseWorld, WORLD_GENERATION } from '../../src/game/terrain/SparseWorld.ts';
import { generatedMineral } from '../../src/game/terrain/strata.ts';
import { saveNamespace } from '../../src/game/persistence/SaveBootstrap.ts';
import { LAYERS } from '../../src/game/content/layers.ts';
import { formatNumber } from '../../src/game/presentation/formatNumber.ts';
import { simulate } from '../balance/simulate.mjs';

test('new progression saves start empty and never share the legacy preview slot',()=>{
 const s=new GameSession(SESSION_CONTENT);
 assert.equal(s.getSnapshot().coins,0);
 assert.ok(s.getSnapshot().destinations.every(d=>!d.unlocked));
 assert.equal(s.pets.hatch('meadow-egg').status,'insufficient-coins');
 assert.notEqual(saveNamespace({pathname:'/games/mining-test/index.html',search:''}).name,'mining:test');
 assert.equal(WORLD_GENERATION.version,9);
});
test('room entry, not depth alone, grants only that room access and no coins',()=>{
 const s=new GameSession(SESSION_CONTENT),room=SESSION_CONTENT.destinations[1];
 s.updatePosition([90,-900,90],false);
 assert.ok(s.getSnapshot().destinations.every(d=>!d.unlocked));
 s.updatePosition(room.spawn,true);
 assert.deepEqual(s.getSnapshot().destinations.filter(d=>d.unlocked).map(d=>d.id),[room.id]);
 assert.equal(s.getSnapshot().coins,0);
 const restored=GameSession.fromData(s.exportProgress(),SESSION_CONTENT);
 assert.equal(restored.pets.getSnapshot().eggs.find(e=>e.id==='mushroom-egg').unlocked,true);
 assert.equal(restored.pets.getSnapshot().eggs.find(e=>e.id==='pebble-egg').unlocked,false);
});
test('locked eggs consume neither currency nor RNG; access changes refresh the same UI adapter',()=>{
 let rolls=0;
 const s=new GameSession({...SESSION_CONTENT,initialCoins:1e8},50,()=>0,{random:()=>{rolls++;return 0;},createPetId:()=>String(rolls)});
 const before=s.pets.getSnapshot(),coins=s.getSnapshot().coins;
 assert.equal(s.pets.hatch('pebble-egg').status,'locked');assert.equal(rolls,0);assert.equal(s.getSnapshot().coins,coins);
 s.updatePosition(SESSION_CONTENT.destinations[0].spawn,true);
 assert.notEqual(s.pets.getSnapshot(),before);
 assert.equal(s.pets.getSnapshot().eggs.find(e=>e.id==='pebble-egg').canAfford,true);
 assert.equal(s.pets.hatch('pebble-egg').status,'hatched');assert.equal(rolls,1);
 assert.equal(s.getSnapshot().coins,coins-PET_CONTENT.eggs.find(e=>e.id==='pebble-egg').price);
});
test('pet power cannot bypass advanced ore level; common and deep rock have no hard lock',()=>{
 const initial=new GameSession(SESSION_CONTENT).exportProgress();
 initial.pets.inventory.pets=[{id:'strong',speciesId:'core-guardian',level:1}];initial.pets.equipment.slots=['strong',null,null];
 let kind=17,now=0,queued=0;
 const s=new GameSession(SESSION_CONTENT,50,()=>now,{},initial);
 s.attach({cell:()=>kind,pending:()=>false,mine:()=>{queued++;return true;},cancelMining(){},returnToSurface(){}});
 const cell=[0,-250,0];s.selectTarget(cell);
 assert.deepEqual(s.hit(cell),{status:'locked',requiredLevel:8});
 assert.equal(s.combatDebug().damagedCells,0);assert.equal(s.combatDebug().nextAttackAt,0);assert.equal(queued,0);
 assert.equal(s.getSnapshot().target.locked,true);
 for(kind of [3,4,...STAGES.map(stage=>stage.deepKind)]){
  now++;assert.notEqual(s.hit([kind,-250,0]).status,'locked');
 }
 const earned=s.exportProgress();earned.pickaxe.level=8;
 const ready=GameSession.fromData(earned,SESSION_CONTENT);kind=17;
 ready.attach({cell:()=>17,pending:()=>false,mine:()=>true,cancelMining(){},returnToSurface(){}});
 assert.equal(ready.hit(cell).status,'breaking');
});
test('shallow rock begins below each room; deep rock belongs to the room above',()=>{
 const world=new SparseWorld();
 for(let i=0;i<LAYERS.length;i++){
  const layer=LAYERS[i],stage=STAGES[i],floor=-layer.from/2;
  const below=world.cell([0,floor-(i?1:5),0]);
  assert.ok([layer.base,...layer.ores.map(o=>o.kind)].includes(below));
  assert.equal(generatedMineral(30,floor-1-stage.deepAt/2,30,0),stage.deepKind);
  const deep=resourceByKind(stage.deepKind),shallow=resourceByKind(layer.base);
  assert.ok(deep.maxHp>shallow.maxHp);assert.ok(deep.price/deep.maxHp<shallow.price/shallow.maxHp);
  assert.equal(deep.requiredLevel,0);
  if(i){assert.equal(world.cell([30,floor,30]),STAGES[i-1].deepKind);assert.equal(world.cell([0,floor,0]),0);}
 }
});
test('prices and HP remain safe integers, front four have one egg and later stages have two',()=>{
 for(const r of RESOURCES)for(const value of [r.maxHp,r.price,r.volume])assert.ok(Number.isSafeInteger(value)&&value>0);
 for(const stage of STAGES){
  const eggs=PET_CONTENT.eggs.filter(e=>EGG_STAGES[e.id][0]===stage.index);
  assert.equal(eggs.length,stage.index<4?1:2);
  for(let level=stage.entryLevel;level<stage.exitLevel;level++)assert.ok(Number.isSafeInteger(upgradePrice(level))&&upgradePrice(level)>0);
 }
 assert.equal(formatNumber(1234567),'1.23M');assert.equal(formatNumber(999),'999');
});
test('calculator repeats decisions and RNG, accounts all elapsed time, and separates strategies',()=>{
 const a=simulate({seed:23,stages:2}),b=simulate({seed:23,stages:2});
 assert.deepEqual(a,b);assert.equal(a.completed,true);
 assert.ok(Math.abs(Object.values(a.breakdown).reduce((x,y)=>x+y,0)-a.elapsedMinutes*60)<1e-6);
 assert.ok(a.purchases.some(p=>p.action==='pickaxe'));assert.ok(a.purchases.some(p=>p.action==='meadow-egg'));
 assert.ok(a.milestones.every(m=>m.coins>=0));
 const fast=simulate({seed:23,stages:2,policy:'efficient'});
 assert.notDeepEqual(a.purchases,fast.purchases);
});
