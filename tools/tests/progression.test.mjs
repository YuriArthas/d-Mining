import test from 'node:test';
import assert from 'node:assert/strict';
import { RESOURCES, resourceByKind } from '../../src/game/content/resources.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { SparseWorld, generationAtZ } from '../../src/game/terrain/SparseWorld.ts';
import { generatedMineral } from '../../src/game/terrain/strata.ts';
import { saveNamespace } from '../../src/game/persistence/SaveBootstrap.ts';
import { WORLD1_LAYERS as LAYERS, GENERATION } from './fixtures/world.mjs';
import { formatNumber } from '../../src/game/presentation/formatNumber.ts';
const SESSION_CONTENT = GAME_CONTENT.session;
function goToEgg(session,eggId) {
 const station=SESSION_CONTENT.eggStations.find(station=>station.eggId===eggId);
 session.updatePosition([station.zone.x,station.zone.y,station.zone.z],true);
}

test('new progression saves start empty and never share the legacy preview slot',()=>{
 const s=new GameSession(SESSION_CONTENT);
 assert.equal(s.getSnapshot().coins,0);
 assert.ok(s.getSnapshot().destinations.every(d=>!d.unlocked));
 goToEgg(s,'meadow-egg');
 assert.equal(s.pets.hatch('meadow-egg').status,'insufficient-coins');
 assert.notEqual(saveNamespace({pathname:'/games/mining-test/index.html',search:''}).name,'mining:test');
});
test('historical depth grants every reached layer and its eggs without coins or room discovery',()=>{
 const s=new GameSession(SESSION_CONTENT),room=SESSION_CONTENT.destinations[1];
 // Arrival is airborne until physics confirms contact with the room floor.
 s.updatePosition(room.spawn,false);
 assert.equal(s.getSnapshot().destinations.find(d=>d.id===room.id).unlocked,false);
 s.updatePosition([90,-200,90],false);
 const reached=SESSION_CONTENT.destinations.filter(d=>d.worldId===1&&d.depth<=200).map(d=>d.id);
 assert.equal(reached.length,2);
 assert.deepEqual(s.getSnapshot().destinations.filter(d=>d.unlocked).map(d=>d.id),reached);
 assert.equal(s.getSnapshot().coins,0);
 s.updatePosition([90,0,90],true);
 assert.deepEqual(s.getSnapshot().destinations.filter(d=>d.unlocked).map(d=>d.id),reached);
 const restored=GameSession.fromData(s.exportProgress(),SESSION_CONTENT);
 assert.equal(restored.pets.getSnapshot().eggs.find(e=>e.id==='mushroom-egg').unlocked,true);
 assert.equal(restored.pets.getSnapshot().eggs.find(e=>e.id==='pebble-egg').unlocked,true);
 assert.equal(restored.pets.getSnapshot().eggs.find(e=>e.id==='crystal-egg').unlocked,false);
});
test('locked eggs consume neither currency nor RNG; access changes refresh the same UI adapter',()=>{
 let rolls=0;
 const s=new GameSession({...SESSION_CONTENT,initialCoins:1e8},50,()=>0,{random:()=>{rolls++;return 0;},createPetId:()=>String(rolls)});
 goToEgg(s,'pebble-egg');
 const before=s.pets.getSnapshot(),coins=s.getSnapshot().coins;
 assert.equal(s.pets.hatch('pebble-egg').status,'locked');assert.equal(rolls,0);assert.equal(s.getSnapshot().coins,coins);
 s.updatePosition([90,-SESSION_CONTENT.destinations[0].depth,90],false);
 assert.notEqual(s.pets.getSnapshot(),before);
 assert.equal(s.pets.getSnapshot().eggs.find(e=>e.id==='pebble-egg').canAfford,true);
 goToEgg(s,'pebble-egg');
 assert.equal(s.pets.hatch('pebble-egg').status,'hatched');assert.equal(rolls,1);
 assert.equal(s.getSnapshot().coins,coins-SESSION_CONTENT.petContent.eggs.find(e=>e.id==='pebble-egg').price);
});
// 2026-10-31: the levels gate only what pays (the ores); a layer's rock and its cap need no pickaxe level.
test('every layer\'s ores have a pickaxe gate, its rock and cap none; pets cannot bypass it',()=>{
 const initial=new GameSession(SESSION_CONTENT).exportProgress();
 initial.pets.inventory.pets=[{id:'strong',speciesId:'core-guardian',level:1}];initial.pets.equipment.slots=['strong',null,null];
 let kind=94,now=0,queued=0;
 const s=new GameSession(SESSION_CONTENT,50,()=>now,{},initial);
 s.attach({cell:()=>kind,pending:()=>false,mine:()=>{queued++;return true;},cancelMining(){}});
 const cell=[0,-250,0];s.selectTarget(cell);
 assert.deepEqual(s.hit(cell),{status:'locked',requiredLevel:10});
 assert.equal(s.combatDebug().damagedCells,0);assert.equal(s.combatDebug().nextAttackAt,0);assert.equal(queued,0);
 assert.equal(s.getSnapshot().target.locked,true);
 for(const [i,layer] of LAYERS.entries()){
  const gate=ECONOMY.layers[i].gate;
  for(const k of layer.ores.map(o=>o.kind))assert.equal(resourceByKind(k).requiredLevel,gate);
  for(const k of [layer.base,layer.deepKind])assert.equal(resourceByKind(k).requiredLevel,0);
  if(gate===1)continue;
  const data=s.exportProgress();data.pickaxe.level=data.equipment.toolLevel=gate-1;
  const low=GameSession.fromData(data,SESSION_CONTENT);low.attach({cell:()=>layer.ores[0].kind,pending:()=>false,mine:()=>true,cancelMining(){}});
  assert.deepEqual(low.hit(cell),{status:'locked',requiredLevel:gate});
  const rock=GameSession.fromData(data,SESSION_CONTENT);rock.attach({cell:()=>layer.deepKind,pending:()=>false,mine:()=>true,cancelMining(){}});
  assert.notEqual(rock.hit(cell).status,'locked','its cap digs with the pickaxe before');
  data.pickaxe.level=data.equipment.toolLevel=gate;
  const ok=GameSession.fromData(data,SESSION_CONTENT);ok.attach({cell:()=>layer.ores[0].kind,pending:()=>false,mine:()=>true,cancelMining(){}});
  assert.notEqual(ok.hit(cell).status,'locked');
 }
});
test('shallow rock begins below each room; deep rock belongs to the room above',()=>{
 const world=new SparseWorld(generationAtZ(GENERATION,0));
 for(let i=0;i<LAYERS.length;i++){
  const layer=LAYERS[i],floor=-layer.from/2;
  const below=world.cell([0,floor-(i?1:5),0]);
  assert.ok([layer.base,...layer.ores.map(o=>o.kind)].includes(below));
  if(layer.deepAt!==null){
   assert.equal(generatedMineral(30,floor-1-layer.deepAt/2,30,0,LAYERS),layer.deepKind);
   assert.notEqual(generatedMineral(30,floor-layer.deepAt/2,30,0,LAYERS),layer.deepKind);
  }
  const deep=resourceByKind(layer.deepKind),shallow=resourceByKind(layer.base);
  assert.ok(deep.maxHp>shallow.maxHp);assert.ok(deep.price/deep.maxHp<shallow.price/shallow.maxHp);
  if(i){assert.equal(world.cell([30,floor,30]),LAYERS[i-1].deepKind);assert.equal(world.cell([0,floor,0]),0);}
 }
});
test('prices and HP remain safe integers; every layer has an egg, the long late layers a premium one too',()=>{
 for(const r of RESOURCES)for(const value of [r.maxHp,r.price,r.volume])assert.ok(Number.isSafeInteger(value)&&value>0);
 for(const l of ECONOMY.layers){
  const eggs=ECONOMY.eggs.filter(e=>e.world===l.world&&e.layer===l.layer);
  assert.equal(eggs.filter(e=>!e.premium).length,1);
  assert.equal(eggs.filter(e=>e.premium).length,(l.world===2&&l.layer>=4)||(l.world===3&&l.layer>=2)?1:0);
 }
 assert.equal(formatNumber(1234567),'123万');assert.equal(formatNumber(999),'999');
});
test('large numbers read in 万 / 亿 and depths always in full metres', async () => {
 const { formatDepth } = await import('../../src/game/presentation/formatNumber.ts');
 for (const [value, text] of [[0,'0'],[9999,'9999'],[10000,'1万'],[12345,'1.23万'],[123456,'12.3万'],[3_000_000,'300万'],[12_345_678,'1235万'],[200_000_000_000,'2000亿'],[3e12,'3万亿'],[-25000,'-2.5万']])
  assert.equal(formatNumber(value), text, String(value));
 assert.equal(formatDepth(2400), '2400 米'); assert.equal(formatDepth(12.9), '12 米');
});
