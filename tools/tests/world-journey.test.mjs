import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldProgress } from '../../src/game/logic/WorldProgress.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT, GAME_GENERATION } from '../../src/game/content/gameContent.ts';
import { JOURNEY_WORLDS } from '../../src/game/content/journeyWorlds.ts';
import { WORLD_REQUIREMENTS, worldRequirement, worldSpawn, worldGateZ, worldAtFeet, worldPortal } from '../../src/game/content/worldJourney.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';
import { resourceById } from '../../src/game/content/resources.ts';
import { SparseWorld, generationAtZ } from '../../src/game/terrain/SparseWorld.ts';
import { compatibleHead } from '../../src/game/persistence/saveMigrations.ts';
import { saveNamespace } from '../../src/game/persistence/SaveBootstrap.ts';
const content=GAME_CONTENT.session;
/** A player at the portal of world `id`'s predecessor, with the ticket's price, pickaxe and minerals (unless told otherwise). */
function prepared(id=2,{price=worldRequirement(id).ticket.price,level=worldRequirement(id).ticket.toolLevel,materials=true}={}) {
  const data=new GameSession(content).exportProgress(),ticket=worldRequirement(id).ticket;
  data.onboarding={...data.onboarding,status:'skipped'};data.wallet.balances[ticket.currency]=price;
  data.pickaxe={version:1,level};data.equipment={...data.equipment,toolLevel:level};
  data.worldProgress={version:2,openWorlds:id===3?[1,2]:[1]};
  if(materials)data.materials={version:1,items:Object.fromEntries(worldRequirement(id).materials.map(m=>[m.itemId,m.count]))};
  return GameSession.fromData(data,content);
}
const atPortal=(s,world=1)=>{const z=worldPortal(world).zone;s.updatePosition([z.x,z.y,z.z],true);};
function commands(s){const travels=[];s.attach({cell:()=>64,pending:()=>false,mine:()=>true,cancelMining(){},travelTo:p=>travels.push(p)});return travels;}

test('worlds unlock in order; a version 1 save keeps its paid mines as open worlds',()=>{
  const p=new WorldProgress();assert.equal(p.isOpen(1),true);assert.equal(p.unlockable(2),true);assert.equal(p.unlockable(3),false);
  assert.throws(()=>p.unlock(3));p.unlock(2);assert.equal(p.unlockable(3),true);
  assert.deepEqual(new WorldProgress(p.exportData()).exportData(),{version:2,openWorlds:[1,2]});
  assert.deepEqual(new WorldProgress({version:1,minedVolume:5,openMines:[1,2]}).exportData().openWorlds,[1,2]);
  assert.throws(()=>new WorldProgress({version:2,openWorlds:[1,3]}));
});
test('each world prices its ten tools and bags in its own currency, rising tier by tier; bags always hold more',()=>{
  for(const items of [ECONOMY.tools,ECONOMY.bags])for(let i=1;i<items.length;i++){
    assert.equal(items[i].currency,ECONOMY.worlds[Math.floor(i/10)].currency);
    if(i%10)assert.ok(items[i].price>items[i-1].price,`tier ${i+1} must cost more than tier ${i}`);
  }
  for(let i=1;i<ECONOMY.bags.length;i++)assert.ok(ECONOMY.bags[i].capacity>ECONOMY.bags[i-1].capacity);
});
test('the portal sheet knows only the next world: its name and price; the one after stays unknown',()=>{
  const s=new GameSession(content),worlds=()=>s.getSnapshot().worlds.map(w=>[w.open,w.known]);
  assert.deepEqual(worlds(),[[true,true],[false,true],[false,false]]);
  const opened=prepared(3);assert.deepEqual(opened.getSnapshot().worlds.map(w=>[w.open,w.known]),[[true,true],[true,true],[false,true]]);
});
test('world borders: walking into a world that is not open sends the player back to their own spawn',()=>{
  for(const id of [2,3]){
    const z=worldGateZ(id);assert.equal(worldAtFeet([0,0,z-1]),id-1);assert.equal(worldAtFeet([0,0,z+1]),id);assert.equal(worldAtFeet([0,-30,z+1]),id-1);
  }
  const s=new GameSession(content),travels=commands(s);
  s.updatePosition(worldSpawn(2),true);assert.deepEqual(travels.at(-1),worldSpawn(1));assert.equal(s.getSnapshot().currentWorld,1);
});
test('unlocking needs the portal, the price, the pickaxe and the world before; nothing is taken on a refusal',()=>{
  const ticket=worldRequirement(2).ticket;
  for(const variant of [{price:ticket.price-1},{materials:false},{level:ticket.toolLevel-1}]){
    const s=prepared(2,variant),before=s.exportProgress();atPortal(s);
    assert.notEqual(s.unlockWorld(2).status,'opened');assert.deepEqual(s.exportProgress().wallet,before.wallet);assert.deepEqual(s.exportProgress().materials,before.materials);
  }
  const away=prepared(),before=away.exportProgress();assert.equal(away.unlockWorld(2).status,'away');assert.deepEqual(away.exportProgress(),before);
  const early=new GameSession(content);atPortal(early);assert.equal(early.unlockWorld(3).status,'previous-locked');
});
test('World 2 costs exactly the listed minerals (from the material store) and gold, keeps the rest, is idempotent and survives a reload',()=>{
  const ore=worldRequirement(2).materials[0].itemId,base=prepared().exportProgress();base.wallet.balances.gold+=123;base.inventory.items[ore]=50;
  const s=GameSession.fromData(base,content);atPortal(s);
  assert.equal(s.unlockWorld(2).status,'opened');assert.equal(s.getSnapshot().coins,123);assert.equal(s.getSnapshot().inventory.items[ore],50,'the bag is not touched');
  assert.deepEqual(s.exportProgress().materials.items,{});
  const paid=s.exportProgress();assert.equal(s.unlockWorld(2).status,'already-open');assert.deepEqual(s.exportProgress(),paid);
  const restored=GameSession.fromData(paid,content);assert.equal(restored.getSnapshot().worlds[1].open,true);
});
test('travel between worlds only from a portal, only to open worlds, arriving at the spawn',()=>{
  const s=prepared(3),travels=commands(s);
  assert.equal(s.travelWorld(2),'away');
  atPortal(s);assert.equal(s.travelWorld(3),'locked');assert.equal(s.travelWorld(2),'travelling');assert.deepEqual(travels.at(-1),worldSpawn(2));
  s.updatePosition(worldSpawn(2),true);atPortal(s,2);assert.equal(s.getSnapshot().atPortal,true);
  assert.equal(s.unlockWorld(3).status,'opened');assert.equal(s.getSnapshot().coins,0);assert.equal(s.getSnapshot().inventory.totalCount,0);
  assert.deepEqual(GameSession.fromData(s.exportProgress(),content).exportProgress().worldProgress.openWorlds,[1,2,3]);
});
test('ticket ore goes to the material store until the tickets have it all; the rest fills the bag and sells',()=>{
  const s=new GameSession(content),need=worldRequirement(2).materials[0],ore=resourceById(need.itemId);
  // Before any ticket ore: the store lists the next world's minerals, empty.
  assert.deepEqual(s.getSnapshot().materials.map(m=>[m.itemId,m.stored,m.needed]),worldRequirement(2).materials.map(m=>[m.itemId,0,m.count]));
  s.collected(Array.from({length:need.count-1},()=>({kind:ore.kind})));
  assert.equal(s.getSnapshot().inventory.used,0,'stored ore takes no bag space');
  assert.match(s.getSnapshot().notice,new RegExp(`材料仓 \\+${need.count-1}：${ore.name} ${need.count-1}/${need.count}`));
  s.collected(Array.from({length:6},()=>({kind:ore.kind})));
  assert.equal(s.getSnapshot().materials.find(m=>m.itemId===ore.itemId).stored,need.count);assert.equal(s.getSnapshot().inventory.items[ore.itemId],5);
  // Selling empties the bag and never touches the store.
  const sale=content.sales[0];s.updatePosition([sale.x,sale.y,sale.z],true);
  assert.equal(s.getSnapshot().inventory.totalCount,0);assert.equal(s.getSnapshot().coins,5*ore.price);
  assert.equal(GameSession.fromData(s.exportProgress(),content).getSnapshot().materials.find(m=>m.itemId===ore.itemId).stored,need.count);
});
test('a later ticket\'s ore is stored too, and shows up in the store once some is in it',()=>{
  const s=new GameSession(content),later=worldRequirement(3).materials.find(m=>!worldRequirement(2).materials.some(n=>n.itemId===m.itemId)),ore=resourceById(later.itemId);
  assert.ok(!s.getSnapshot().materials.some(m=>m.itemId===ore.itemId),'world 3 stays unknown');
  s.collected([{kind:ore.kind}]);
  assert.equal(s.getSnapshot().inventory.used,0);assert.deepEqual(s.getSnapshot().materials.find(m=>m.itemId===ore.itemId),{itemId:ore.itemId,name:ore.name,stored:1,needed:later.count});
});
test('once its world is open a mineral is ore like any other; the store survives a reload and rejects other versions',()=>{
  const need=worldRequirement(2).materials[0],ore=resourceById(need.itemId),s=prepared();atPortal(s);assert.equal(s.unlockWorld(2).status,'opened');
  s.collected([{kind:ore.kind}]);assert.equal(s.getSnapshot().inventory.items[ore.itemId],1);
  const data=s.exportProgress();data.materials={version:1,items:{[worldRequirement(3).materials[0].itemId]:3}};
  assert.equal(GameSession.fromData(data,content).getSnapshot().materials.find(m=>m.itemId===worldRequirement(3).materials[0].itemId).stored,3);
  assert.throws(()=>GameSession.fromData({...data,materials:{version:2,items:{}}},content));
});
test('exploration and return destinations are scoped to the current world',()=>{
  const s=prepared(3),data=s.exportProgress();data.worldProgress.openWorlds=[1,2,3];const live=GameSession.fromData(data,content),travels=commands(live);
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
    for(const m of w.materials){const layer=JOURNEY_WORLDS[m.world-1].layers[m.layer],resource=resourceById(m.itemId);assert.ok(m.world<w.id);assert.ok(layer.ores.some(o=>o.kind===resource.kind));volume+=resource.volume*m.count;}
    assert.ok(volume<ECONOMY.bags[(w.id-1)*10-1].capacity);
  }
  // World 3 asks for minerals of both earlier worlds.
  assert.deepEqual([...new Set(worldRequirement(3).materials.map(m=>m.world))],[1,2]);
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
  assert.equal(saveNamespace({pathname:'/games/mining-surface-play/index.html',search:''}).name,'mining:test:economy-v2');
  assert.throws(()=>compatibleHead({formatVersion:1,revision:1,savedAt:0,world:{generationVersion:9,seed:0,regionEncoding:1},regionCount:0},GAME_GENERATION),/不兼容/);
});
test('the testing unlock page opens worlds and layers, and the result survives a reload', () => {
  const s=new GameSession(content);
  const deep=content.destinations.filter(d=>d.worldId===3).at(-1);
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
test('the testing page clears every unlock back to a fresh start, keeping the rest of the progress', () => {
  const s=new GameSession(content),travels=commands(s),fresh=new GameSession(content).devUnlocks();
  s.devGrantCoins(500);s.devUnlockLayer();
  s.devResetUnlocks();
  assert.deepEqual(s.devUnlocks(),fresh);
  assert.deepEqual(travels.at(-1),worldSpawn(1));
  assert.equal(s.getSnapshot().currentWorld,1);
  assert.equal(s.exportProgress().wallet.balances[worldRequirement(1).currency],500);
  assert.deepEqual(GameSession.fromData(s.exportProgress(),content).devUnlocks(),fresh);
});
