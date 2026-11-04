import { resolveText } from '../../src/game/i18n/i18n.ts';
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
// 2026-10-31: the store took every ticket mineral as it was dug, so early on they could not be sold. Nothing is kept now
// unless the player locks it.
test('ticket ore sells like any ore until the player locks it; locked, it goes to the store until the tickets have it all, then it unlocks and the rest sells',()=>{
  const s=new GameSession(content),need=worldRequirement(2).materials[0],ore=resourceById(need.itemId);
  // Before any ticket ore: the store lists the next world's minerals, empty and none locked.
  assert.deepEqual(s.getSnapshot().materials.map(m=>[m.itemId,m.stored,m.needed,m.locked]),worldRequirement(2).materials.map(m=>[m.itemId,0,m.count,false]));
  s.collected(Array.from({length:3},()=>({kind:ore.kind})));
  assert.equal(s.getSnapshot().inventory.items[ore.itemId],3,'not locked: into the bag');
  // Locking moves what the bag holds into the store, and every one dug after that goes there too.
  assert.deepEqual(s.lockItem(ore.itemId),{status:'locked',stored:3});
  assert.equal(s.getSnapshot().inventory.used,0,'stored ore takes no bag space');
  s.collected(Array.from({length:need.count-4},()=>({kind:ore.kind})));
  assert.match(s.getSnapshot().notice,new RegExp(`材料仓 \\+${need.count-4}：${resolveText(ore.name)} ${need.count-1}/${need.count}`));
  assert.equal(GameSession.fromData(s.exportProgress(),content).getSnapshot().materials.find(m=>m.itemId===ore.itemId).locked,true,'the lock survives a reload');
  // The block that fills the store unlocks it: the tickets have all of it, so the rest sells and the store is untouched.
  s.collected(Array.from({length:6},()=>({kind:ore.kind})));
  assert.deepEqual(s.getSnapshot().materials.find(m=>m.itemId===ore.itemId),{itemId:ore.itemId,name:resolveText(ore.name),stored:need.count,needed:need.count,locked:false});
  assert.equal(s.getSnapshot().inventory.items[ore.itemId],5);
  const sale=content.sales[0];s.updatePosition([sale.x,sale.y,sale.z],true);
  assert.equal(s.getSnapshot().inventory.totalCount,0);assert.equal(s.getSnapshot().coins,5*ore.price);
  assert.equal(GameSession.fromData(s.exportProgress(),content).getSnapshot().materials.find(m=>m.itemId===ore.itemId).stored,need.count,'a full store stays until the ticket is paid');
  // Locked again with the store full, more of it stays in the bag and does not sell.
  s.lockItem(ore.itemId);s.collected([{kind:ore.kind}]);s.updatePosition([0,0,46],true);s.updatePosition([sale.x,sale.y,sale.z],true);
  assert.equal(s.getSnapshot().inventory.items[ore.itemId],1);assert.equal(s.getSnapshot().materials.find(m=>m.itemId===ore.itemId).locked,true);
});
test('locking with enough in the bag fills the store at once and unlocks it',()=>{
  const s=new GameSession(content),need=worldRequirement(2).materials[2],ore=resourceById(need.itemId);
  s.collected(Array.from({length:need.count+3},()=>({kind:ore.kind})));
  assert.deepEqual(s.lockItem(ore.itemId),{status:'locked',stored:need.count});
  assert.equal(s.getSnapshot().inventory.items[ore.itemId],3);
  assert.equal(s.getSnapshot().materials.find(m=>m.itemId===ore.itemId).locked,false,'filled, so the three left over sell');
});
test('unlocking a ticket mineral puts what is stored back in the bag to be sold',()=>{
  const s=new GameSession(content),need=worldRequirement(2).materials[1],ore=resourceById(need.itemId),sale=content.sales[0];
  s.lockItem(ore.itemId);s.collected(Array.from({length:7},()=>({kind:ore.kind})));
  assert.equal(s.getSnapshot().inventory.used,0);
  assert.deepEqual(s.unlockItem(ore.itemId),{status:'unlocked',released:7});
  assert.equal(s.getSnapshot().inventory.items[ore.itemId],7);
  assert.deepEqual(s.getSnapshot().materials.find(m=>m.itemId===ore.itemId),{itemId:ore.itemId,name:resolveText(ore.name),stored:0,needed:need.count,locked:false});
  s.collected([{kind:ore.kind}]);assert.equal(s.getSnapshot().inventory.items[ore.itemId],8,'unlocked: dug ones go to the bag');
  s.updatePosition([sale.x,sale.y,sale.z],true);assert.equal(s.getSnapshot().coins,8*ore.price);
  assert.equal(s.unlockItem(ore.itemId).status,'unavailable','not locked');
  assert.equal(s.lockItem('not-an-ore').status,'unavailable');
  assert.equal(s.lockItem(ore.itemId).status,'locked');assert.equal(s.lockItem(ore.itemId).status,'locked','locking twice changes nothing');
  const saved=GameSession.fromData(s.exportProgress(),content).exportProgress();
  assert.deepEqual(saved.materials,{version:1,items:{}});assert.deepEqual(saved.inventory.locked,[ore.itemId]);
});
test('any ore locks, rock too: the sale leaves it in the bag and says so, unlocked it sells; the locks are saved',()=>{
  const s=new GameSession(content),sale=content.sales[0],rock=resourceById('journey.rock.0'),copper=resourceById('journey.copper');
  s.collected([...Array.from({length:4},()=>({kind:rock.kind})),...Array.from({length:3},()=>({kind:copper.kind}))]);
  assert.deepEqual(s.lockItem(copper.itemId),{status:'locked',stored:0});assert.equal(s.lockItem(rock.itemId).status,'locked');
  assert.deepEqual(s.getSnapshot().inventory.locked,[copper.itemId,rock.itemId]);
  assert.equal(s.getSnapshot().sale.count,0,'nothing to sell');
  s.updatePosition([sale.x,sale.y,sale.z],true);
  assert.deepEqual(s.getSnapshot().inventory.items,{[rock.itemId]:4,[copper.itemId]:3});assert.equal(s.getSnapshot().coins,0);
  assert.equal(s.getSnapshot().notice,'锁定的矿物不会卖掉');
  const restored=GameSession.fromData(s.exportProgress(),content);
  assert.deepEqual(restored.getSnapshot().inventory.locked,[copper.itemId,rock.itemId]);
  assert.equal(restored.unlockItem(copper.itemId).status,'unlocked');
  assert.deepEqual(restored.getSnapshot().sale,{status:'quoted',count:3,payouts:[{currency:'gold',coins:3*copper.price}]});
  restored.updatePosition([sale.x,sale.y,sale.z],true);
  assert.deepEqual(restored.getSnapshot().inventory.items,{[rock.itemId]:4});assert.equal(restored.getSnapshot().coins,3*copper.price);
  // A lock on a kind the bag does not hold yet holds too.
  assert.equal(restored.lockItem('journey.emerald').status,'locked');
  for(const locked of ['copper',[1],['']]) assert.throws(()=>GameSession.fromData({...s.exportProgress(),inventory:{...s.exportProgress().inventory,locked}},content));
});
test('a later ticket\'s ore shows in the store once some is kept; a store saved from before the locks keeps its minerals locked',()=>{
  const s=new GameSession(content),later=worldRequirement(3).materials.find(m=>!worldRequirement(2).materials.some(n=>n.itemId===m.itemId)),ore=resourceById(later.itemId);
  assert.ok(!s.getSnapshot().materials.some(m=>m.itemId===ore.itemId),'world 3 stays unknown');
  s.collected([{kind:ore.kind}]);assert.equal(s.getSnapshot().inventory.items[ore.itemId],1,'not locked: into the bag');
  s.lockItem(ore.itemId);
  assert.equal(s.getSnapshot().inventory.used,0);assert.deepEqual(s.getSnapshot().materials.find(m=>m.itemId===ore.itemId),{itemId:ore.itemId,name:resolveText(ore.name),stored:1,needed:later.count,locked:true});
  const data=new GameSession(content).exportProgress();data.materials={version:1,items:{[ore.itemId]:2}};
  assert.equal(GameSession.fromData(data,content).getSnapshot().materials.find(m=>m.itemId===ore.itemId).locked,true);
});
test('the ticket takes the store\'s minerals first, then the bag\'s, so ones never locked count too',()=>{
  const [first,...others]=worldRequirement(2).materials,data=prepared(2,{materials:false}).exportProgress();
  data.materials={version:1,items:{[first.itemId]:first.count-2}};
  data.inventory.items={[first.itemId]:5,...Object.fromEntries(others.map(m=>[m.itemId,m.count+1]))};
  const s=GameSession.fromData(data,content);
  assert.deepEqual(s.getSnapshot().worlds[1].materials.map(m=>m.owned),[first.count+3,...others.map(m=>m.count+1)]);
  atPortal(s);assert.equal(s.unlockWorld(2).status,'opened');
  assert.deepEqual(s.exportProgress().materials.items,{});
  assert.deepEqual(s.getSnapshot().inventory.items,{[first.itemId]:3,...Object.fromEntries(others.map(m=>[m.itemId,1]))});
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
