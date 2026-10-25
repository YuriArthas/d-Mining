import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { JOURNEY_CAPACITIES, JOURNEY_TOOL_PRICES } from '../../src/game/content/journeyResources.ts';
import { EquipmentCollection } from '../../src/game/logic/EquipmentCollection.ts';
import { MinerAvatar } from '../../src/game/presentation/MinerAvatar.ts';
import { shopBackpacks, shopTools } from '../../src/game/content/shopCatalog.ts';
const content=GAME_CONTENT.session;
function funded(coins=1000) { const data=new GameSession(content).exportProgress();data.wallet.coins=coins;return GameSession.fromData(data,content); }
function enter(s) { const {zone}=content.shops[0];s.updatePosition([zone.x,zone.y,zone.z],true);assert.ok(s.getSnapshot().shopId); }
test('shop opens anywhere: purchases need affordability and sequence, never the shop circle; repeated touch never double-debits',()=>{
 const away=funded();assert.equal(away.useShopItem('tools','tool-2').status,'upgraded','bought far from the shop');assert.equal(away.getSnapshot().coins,950);
 const s=funded();
 enter(s);assert.equal(s.useShopItem('tools','tool-3').status,'locked');assert.equal(s.useShopItem('backpacks','journey-bag-3').status,'locked');assert.equal(s.getSnapshot().coins,1000);
 let commits=0;s.onProgressCommitted(()=>commits++);
 assert.equal(s.useShopItem('tools','tool-2').status,'upgraded');assert.equal(s.getSnapshot().coins,950);assert.equal(commits,1);
 assert.equal(s.useShopItem('tools','tool-2').status,'equipped');assert.equal(s.getSnapshot().coins,950);assert.equal(commits,1);
 const poor=funded(49);enter(poor);assert.equal(poor.useShopItem('tools','tool-2').status,'insufficient');assert.equal(poor.useShopItem('backpacks','journey-bag-2').status,'insufficient');assert.equal(poor.getSnapshot().coins,49);
 s.setSuspended(true);assert.equal(s.useShopItem('tools','tool-3').status,'unavailable');
});
test('equipping old gear is free, persists, and preserves highest purchase and next price',()=>{
 const s=funded();enter(s);s.useShopItem('tools','tool-2');s.useShopItem('tools','tool-3');s.useShopItem('backpacks','journey-bag-2');
 assert.equal(s.useShopItem('tools','tool-1').status,'equipped');assert.equal(s.useShopItem('backpacks','starter-bag').status,'equipped');
 assert.equal(s.getSnapshot().coins,700);assert.equal(s.getSnapshot().pickaxe.level,1);assert.equal(s.getSnapshot().inventory.capacity,50);
 const r=GameSession.fromData(s.exportProgress(),content);enter(r);assert.equal(r.getSnapshot().equipment.toolLevel,3);assert.equal(r.getSnapshot().pickaxeUpgrade.price,800);assert.equal(r.getSnapshot().backpackUpgrade.next.capacity,600);
 r.useShopItem('tools','tool-3');r.useShopItem('backpacks','journey-bag-2');assert.equal(r.getSnapshot().coins,700);assert.equal(r.getSnapshot().pickaxe.level,3);assert.equal(r.getSnapshot().inventory.capacity,150);
});
test('smaller bag never deletes contents, including protected minerals',()=>{
 const s=funded();enter(s);s.useShopItem('backpacks','journey-bag-2');s.collected(Array.from({length:51},()=>({kind:64})));s.reserveMineral('journey.rock.0','all');
 const before=s.exportProgress();assert.equal(s.useShopItem('backpacks','starter-bag').status,'too-small');assert.deepEqual(s.exportProgress(),before);
});
test('old saves derive owned tiers; corrupt new collections fail instead of hiding damage',()=>{
 const data=funded().exportProgress();delete data.equipment;data.pickaxe.level=3;data.inventory.capacity=600;
 const s=GameSession.fromData(data,content);assert.deepEqual(s.getSnapshot().equipment,{version:1,toolLevel:3,backpackCapacity:600});enter(s);assert.equal(s.useShopItem('tools','tool-1').status,'equipped');assert.equal(s.getSnapshot().coins,1000);
 for(const bad of [null,{}, {version:2}, {version:1,toolLevel:2,backpackCapacity:600}, {version:1,toolLevel:3,backpackCapacity:50}])assert.throws(()=>new EquipmentCollection(3,600,bad));
});
const loader=new GLTFLoader().register(()=>({name:'cpu-test-textures',loadTexture:()=>Promise.resolve(new Texture())}));
async function asset(path) { const b=readFileSync(new URL('../../src/game/assets/'+path,import.meta.url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''); }
test('all 60 catalog models exist, real prices/capacities match game progression, and avatar equips the selected models',async()=>{
 const [library,character,stage]=await Promise.all([asset('shop/equipment.glb'),asset('character/miner-a.glb'),asset('shop/showroom.glb')]);
 const s=funded(),catalog=s.getSnapshot().shopCatalog;
 assert.equal(catalog.tools.length,30);assert.equal(catalog.backpacks.length,30);
 for(const [i,item] of catalog.tools.entries()){assert.ok(library.scene.getObjectByName(item.model));assert.equal(item.price,JOURNEY_TOOL_PRICES[i]);}
 for(const [i,item] of catalog.backpacks.entries()){assert.ok(library.scene.getObjectByName(item.model));assert.equal(item.capacity,JOURNEY_CAPACITIES[i]);}
 assert.ok(stage.scene.getObjectByName('ShowCart'));assert.ok(stage.scene.getObjectByName('ShowroomStage'));
 const a=Reflect.construct(MinerAvatar,[character,library]);try{a.setEquipment(12,23);const d=a.diagnostics();assert.equal(d.pickaxe.model,'Tool12');assert.equal(d.backpack.model,'Bag23');assert.equal(d.backpack.attachedTo,'UpperTorso');assert.equal(d.bones,16);assert.equal(d.triangles,11678);assert.ok(d.pickaxe.tip.every(Number.isFinite));}finally{a.dispose();}
});

test('世界 1 的十把工具和十个背包各有自己的名字和一句介绍；打蛋器是电钻类，其他是镐类',()=>{
  const tools=shopTools(),bags=shopBackpacks();
  for(const list of [tools,bags]){
    assert.equal(new Set(list.map(i=>i.name)).size,list.length,'every name is different');
    assert.equal(new Set(list.slice(0,10).map(i=>i.description)).size,10,'world 1 items each have their own line');
  }
  assert.equal(tools[0].name,'老木镐');assert.equal(bags[0].name,'麻布袋');
  assert.deepEqual(tools.filter(t=>t.motion==='drill').map(t=>t.level),[7]);
  assert.ok(tools.every(t=>t.motion==='drill'||t.motion==='swing'));
});
