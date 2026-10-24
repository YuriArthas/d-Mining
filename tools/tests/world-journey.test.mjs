import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldProgress } from '../../src/game/logic/WorldProgress.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT, GAME_GENERATION } from '../../src/game/content/gameContent.ts';
import { JOURNEY_WORLDS } from '../../src/game/content/journeyWorlds.ts';
import { WORLD_REQUIREMENTS, worldRequirement, worldSpawn, worldGateZ, worldAtFeet } from '../../src/game/content/worldJourney.ts';
import { JOURNEY_CAPACITIES, JOURNEY_TOOL_PRICES, JOURNEY_BACKPACKS } from '../../src/game/content/journeyResources.ts';
import { resourceById, resourceByKind } from '../../src/game/content/resources.ts';
import { SparseWorld, generationAtZ } from '../../src/game/terrain/SparseWorld.ts';
import { compatibleHead } from '../../src/game/persistence/saveMigrations.ts';
import { saveNamespace } from '../../src/game/persistence/SaveBootstrap.ts';
const content=GAME_CONTENT.session;
function prepared(id=2,{volume=worldRequirement(id).mined,coins=worldRequirement(id).coins,materials=true}={}) {
  const data=new GameSession(content).exportProgress();
  data.onboarding={...data.onboarding,status:'skipped'};data.worldProgress.minedVolume=volume;data.wallet.coins=coins;
  data.worldProgress.openMines=id===3?[1,2]:[1];
  if(materials)for(const m of worldRequirement(id).materials)data.inventory.items[m.itemId]=m.count;
  return GameSession.fromData(data,content);
}
const enterMine=(s,id)=>s.updatePosition([0,0,worldRequirement(id).z-12],true);
function commands(s){const travels=[];s.attach({cell:()=>64,pending:()=>false,mine:()=>true,cancelMining(){},returnToSurface(){},travelTo:p=>travels.push(p)});return travels;}

test('outer gates check lifetime weighted volume exactly at 1m and 100m; opening a mine never spends that volume',()=>{
  const p=new WorldProgress();p.collect(999_999);assert.equal(p.areaOpen(2),false);p.collect(1);assert.equal(p.areaOpen(2),true);assert.equal(p.mineOpen(2),false);
  p.openMine(2);assert.equal(p.minedVolume,1_000_000);p.collect(99_000_000);assert.equal(p.areaOpen(3),true);assert.equal(p.mineOpen(3),false);
  assert.deepEqual(new WorldProgress(p.exportData()).exportData(),p.exportData());
});
test('equipment costs and backpack capacities continue increasing through both world boundaries',()=>{
  for(const values of [JOURNEY_TOOL_PRICES,JOURNEY_CAPACITIES,JOURNEY_BACKPACKS.map(b=>b.price)]){
    for(let i=1;i<values.length;i++)assert.ok(values[i]>values[i-1],`tier ${i+1} must cost or hold more than tier ${i}`);
  }
});
test('world gates sit behind each spawn and the mine remains in front',()=>{
  for(const id of [2,3]){
    const z=worldGateZ(id);assert.equal(z,worldSpawn(id-1)[2]+23);assert.ok(worldRequirement(id-1).z<worldSpawn(id-1)[2]);
    assert.equal(worldAtFeet([0,0,z-1]),id-1);assert.equal(worldAtFeet([0,0,z+1]),id);
    assert.equal(worldAtFeet([0,-30,z+1]),id-1);
    const s=prepared(id);s.updatePosition([0,0,z+1],true);
    assert.equal(s.getSnapshot().currentWorld,id);assert.equal(s.getSnapshot().worlds[id-1].mineOpen,false);
  }
});
test('mining counts each collected item by volume once, independent of coin value and selling',()=>{
  const s=new GameSession(content),soil=64,deep=65,late=88;
  s.collected([{kind:soil},{kind:deep},{kind:late}]);
  assert.equal(s.getSnapshot().minedVolume,1+1+5000);
  assert.equal(s.getSnapshot().inventory.totalCount,3);
  const sell=content.sales[0];s.updatePosition([sell.x,sell.y,sell.z],true);
  assert.equal(s.getSnapshot().inventory.used,0);assert.equal(s.getSnapshot().minedVolume,5002);
  assert.equal(GameSession.fromData(s.exportProgress(),content).getSnapshot().minedVolume,5002);
});
test('invalid collection and unsafe lifetime sums change neither inventory nor history',()=>{
  const s=new GameSession(content),before=s.exportProgress();
  assert.throws(()=>s.collected([{kind:64},{kind:999}]));assert.deepEqual(s.exportProgress(),before);
  const data=s.exportProgress();data.worldProgress.minedVolume=Number.MAX_SAFE_INTEGER;
  const full=GameSession.fromData(data,content),snapshot=full.exportProgress();
  assert.throws(()=>full.collected([{kind:64}]));assert.deepEqual(full.exportProgress(),snapshot);
});
test('World 2 opens its area without taking minerals or coins; mine stays locked and cannot be mined',()=>{
  const s=prepared(),travels=commands(s),before=s.exportProgress();
  enterMine(s,2);assert.equal(s.getSnapshot().currentWorld,2);assert.equal(s.getSnapshot().worlds[1].areaOpen,true);assert.equal(s.getSnapshot().worlds[1].mineOpen,false);
  assert.deepEqual(s.exportProgress().inventory,before.inventory);assert.deepEqual(s.exportProgress().wallet,before.wallet);
  s.selectTarget([0,-1,112]);assert.equal(s.getSnapshot().target,null);
  s.updatePosition([0,-10,224],false);assert.deepEqual(travels.at(-1),worldSpawn(2));
});
test('unmet outer gate rejects walking or travel into the next world and preserves finances',()=>{
  const s=prepared(2,{volume:999_999}),travels=commands(s),before=s.exportProgress();
  s.updatePosition(worldSpawn(2),true);assert.deepEqual(travels.at(-1),worldSpawn(1));assert.equal(s.getSnapshot().currentWorld,1);
  s.updatePosition(worldSpawn(1),true);assert.equal(s.travelWorld(2),'locked');assert.deepEqual(s.exportProgress().wallet,before.wallet);
});
test('mine payment requires being at its entrance; insufficient requirements and cancellation do not deduct anything',()=>{
  for(const variant of [{volume:999_999},{coins:9_999_999},{materials:false}]){
    const s=prepared(2,variant),before=s.exportProgress();enterMine(s,2);
    assert.notEqual(s.unlockWorldMine(2).status,'opened');assert.deepEqual(s.exportProgress().wallet,before.wallet);assert.deepEqual(s.exportProgress().inventory,before.inventory);
  }
  const s=prepared(),before=s.exportProgress();assert.equal(s.unlockWorldMine(2).status,'away');assert.deepEqual(s.exportProgress(),before);
});
test('World 2 payment consumes exactly the listed units and coins, preserves surplus and is idempotent',()=>{
  const base=prepared().exportProgress();base.wallet.coins+=123;base.inventory.items['journey.diamond']+=50;
  const s=GameSession.fromData(base,content);s.reserveWorldMaterials(2);enterMine(s,2);
  assert.equal(s.unlockWorldMine(2).status,'opened');assert.equal(s.getSnapshot().coins,123);assert.equal(s.getSnapshot().inventory.items['journey.diamond'],50);
  assert.equal(s.getSnapshot().minedVolume,1_000_000);assert.equal(s.getSnapshot().mineralReservations['journey.diamond'].reserved,0);
  const paid=s.exportProgress();assert.equal(s.unlockWorldMine(2).status,'already-open');assert.deepEqual(s.exportProgress(),paid);
  const restored=GameSession.fromData(paid,content);assert.equal(restored.getSnapshot().worlds[1].mineOpen,true);assert.equal(restored.unlockWorldMine(2).status,'already-open');
});
test('World 3 uses its own 100m outer gate, World 2 minerals and 10b payment',()=>{
  const s=prepared(3);enterMine(s,3);assert.equal(s.getSnapshot().currentWorld,3);
  assert.equal(s.unlockWorldMine(3).status,'opened');assert.equal(s.getSnapshot().coins,0);assert.equal(s.getSnapshot().inventory.totalCount,0);assert.equal(s.getSnapshot().minedVolume,100_000_000);
  assert.deepEqual(GameSession.fromData(s.exportProgress(),content).exportProgress().worldProgress.openMines,[1,2,3]);
});
test('world reservation protects required quantities, fills later shortfall, and surplus alone is sold',()=>{
  const s=new GameSession(content);s.reserveWorldMaterials(2);
  const diamond=resourceById('journey.diamond');s.collected(Array.from({length:10},()=>({kind:diamond.kind})));assert.equal(s.getSnapshot().mineralReservations[diamond.itemId].reserved,10);
  s.collected(Array.from({length:70},()=>({kind:diamond.kind})));assert.equal(s.getSnapshot().mineralReservations[diamond.itemId].sellable,50);
  const sale=content.sales[0],volume=s.getSnapshot().minedVolume;s.updatePosition([sale.x,sale.y,sale.z],true);
  assert.equal(s.getSnapshot().inventory.items[diamond.itemId],30);assert.equal(s.getSnapshot().coins,50*diamond.price);assert.equal(s.getSnapshot().minedVolume,volume);
  s.reserveMineral(diamond.itemId,'none');assert.equal(s.getSnapshot().inventory.items[diamond.itemId],30);
  s.updatePosition([sale.x,sale.y,sale.z],true);assert.equal(s.getSnapshot().inventory.items[diamond.itemId],30);
  assert.equal(s.sellAvailable().status,'sold');assert.equal(s.getSnapshot().inventory.totalCount,0);assert.equal(s.getSnapshot().minedVolume,volume);
});
test('manual protect-all survives world preparation, payment, and save restoration',()=>{
  const data=prepared().exportProgress();data.inventory.items['journey.diamond']=80;
  const s=GameSession.fromData(data,content);s.reserveMineral('journey.diamond','all');s.reserveWorldMaterials(2);assert.equal(s.getSnapshot().mineralReservations['journey.diamond'].reserved,80);
  enterMine(s,2);s.unlockWorldMine(2);const restored=GameSession.fromData(s.exportProgress(),content);assert.equal(restored.getSnapshot().mineralReservations['journey.diamond'].reserved,50);
});
test('reserving one mineral does not change other minerals and persists until its mine payment',()=>{
  const data=prepared().exportProgress();data.inventory.items['journey.diamond']=80;
  const s=GameSession.fromData(data,content);s.reserveMineral('journey.diamond','needed');
  const restored=GameSession.fromData(s.exportProgress(),content);
  assert.equal(restored.getSnapshot().mineralReservations['journey.diamond'].reserved,30);
  assert.equal(restored.getSnapshot().mineralReservations['journey.emerald'].reserved,0);
  enterMine(restored,2);restored.unlockWorldMine(2);
  assert.equal(restored.getSnapshot().mineralReservations['journey.diamond'].reserved,0);
});
test('exploration and return destinations are scoped to the current world',()=>{
  const s=prepared(3),data=s.exportProgress();data.worldProgress.openMines=[1,2,3];const live=GameSession.fromData(data,content),travels=commands(live);
  live.updatePosition([30,-850,224],false);assert.equal(live.getSnapshot().destinations.length,6);assert.equal(live.getSnapshot().destinations.filter(d=>d.unlocked).length,2);
  live.returnToSurface();assert.deepEqual(travels.at(-1),worldSpawn(2));
  live.updatePosition(worldSpawn(3),true);assert.equal(live.getSnapshot().maxDepth,0);assert.ok(live.getSnapshot().destinations.every(d=>!d.unlocked));
  live.updatePosition(worldSpawn(1),true);assert.equal(live.getSnapshot().maxDepth,0);
  const restored=GameSession.fromData(live.exportProgress(),content);restored.updatePosition(worldSpawn(2),true);assert.equal(restored.getSnapshot().destinations.filter(d=>d.unlocked).length,2);
});
test('three separate mines have 6 layers each, distinct resources and stable independent excavation saves',()=>{
  const world=new SparseWorld(GAME_GENERATION),cells=[[0,-10,0],[0,-10,112],[0,-10,224]],before=cells.map(c=>world.cell(c));
  assert.equal(new Set(before).size,3);
  world.remove([cells[1]]);assert.equal(world.cell(cells[1]),0);assert.equal(world.cell(cells[0]),before[0]);assert.equal(world.cell(cells[2]),before[2]);
  const restored=new SparseWorld(GAME_GENERATION);for(const region of world.captureChanges().regions)restored.restoreRegion(region);assert.equal(restored.cell(cells[1]),0);assert.equal(restored.cell(cells[2]),before[2]);
  for(const w of JOURNEY_WORLDS){assert.equal(w.layers.length,7);assert.equal(w.rooms.length,6);assert.equal(generationAtZ(GAME_GENERATION,w.z/2).layers,w.layers);assert.equal(world.cell([0,-1401,w.z/2]),7);}
});
test('each entry material really occurs in its listed source layer and complete payment fits that world’s best bag',()=>{
  for(const w of WORLD_REQUIREMENTS.slice(1)){
    let volume=0;
    for(const m of w.materials){const layer=JOURNEY_WORLDS[w.id-2].layers[m.layer],resource=resourceById(m.itemId);assert.ok(layer.ores.some(o=>o.kind===resource.kind));volume+=resource.volume*m.count;}
    assert.ok(volume<JOURNEY_CAPACITIES[(w.id-1)*10-1]);
  }
});
test('v11 mine holes keep their original saved coordinates after moving the later worlds behind spawn',()=>{
  const oldRegions=[
    {region:[0,-1,-7],removed:new Uint16Array([96,96])},
    {region:[0,-1,-14],removed:new Uint16Array([96,96])},
  ];
  const world=new SparseWorld(GAME_GENERATION);
  assert.ok(world.canMine([0,-10,112]));assert.ok(world.canMine([0,-10,224]));
  for(const r of oldRegions)world.restoreRegion(r);
  assert.equal(world.cell([0,-10,112]),0);assert.equal(world.cell([0,-10,224]),0);
  assert.notEqual(world.cell([0,-10,0]),0);
  assert.equal(world.hasUnsavedChanges(),false);
  world.remove([[1,-10,112],[1,-10,224]]);
  assert.deepEqual(world.captureChanges().regions,[
    {region:[0,-1,-7],removed:new Uint16Array([96,97])},
    {region:[0,-1,-14],removed:new Uint16Array([96,97])},
  ]);
  const restored=new SparseWorld(GAME_GENERATION);
  for(const r of world.captureChanges().regions)restored.restoreRegion(r);
  for(const z of [112,224])for(const x of [0,1])assert.equal(restored.cell([x,-10,z]),0);
});
test('the new map uses an explicit separate test save; legacy terrain is never silently reinterpreted',()=>{
  const location={pathname:'/games/mining-test/index.html',search:''};assert.notEqual(saveNamespace(location,'journey-v1').name,saveNamespace(location).name);
  assert.throws(()=>compatibleHead({formatVersion:1,revision:1,savedAt:0,world:{generationVersion:9,seed:0,regionEncoding:1},regionCount:0},GAME_GENERATION),/不兼容/);
});
test('the testing unlock page opens worlds and layers, and the result survives a reload', () => {
  const s=new GameSession(content);
  const deep=content.destinations.filter(d=>(d.worldId??1)===3).at(-1);
  s.devUnlockLayer(deep.id);
  const after=s.devUnlocks();
  assert.deepEqual(after.map(w=>w.open),[true,true,true]);
  assert.equal(after[2].layers.find(l=>l.id===deep.id).unlocked,true);
  assert.equal(after[2].layers.filter(l=>l.unlocked).length,1);
  s.devUnlockLayer();
  assert.ok(s.devUnlocks().every(w=>w.layers.every(l=>l.unlocked)));
  const reloaded=GameSession.fromData(s.exportProgress(),content);
  assert.ok(reloaded.devUnlocks().every(w=>w.open&&w.layers.every(l=>l.unlocked)));
  assert.equal(reloaded.getSnapshot().maxDepth,0);
});
