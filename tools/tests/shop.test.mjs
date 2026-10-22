import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { JOURNEY_CAMP } from '../../src/game/content/journeyCamp.ts';
import { JOURNEY_CAPACITIES, JOURNEY_TOOL_PRICES } from '../../src/game/content/journeyResources.ts';
import { EquipmentCollection } from '../../src/game/logic/EquipmentCollection.ts';
import { MinerAvatar } from '../../src/game/presentation/MinerAvatar.ts';
const content=JOURNEY_CAMP.session;
function funded(coins=1000) { const data=new GameSession(content).exportProgress();data.wallet.coins=coins;return GameSession.fromData(data,content); }
function enter(s) { const {zone}=content.shops[0];s.updatePosition([zone.x,zone.y,zone.z],true);assert.ok(s.getSnapshot().shopId); }
test('shop gates commands by proximity, affordability and sequential purchase; repeated touch never double-debits',()=>{
 const s=funded();const before=s.exportProgress();assert.equal(s.useShopItem('tools','tool-2').status,'unavailable');assert.deepEqual(s.exportProgress(),before);
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
test('manual shop navigation works after skipping tutorial and stays in current world',()=>{
 const s=funded();s.skipOnboarding();s.updatePosition([0,.1,46],true);s.guideToShop();assert.equal(s.getSnapshot().guide.marker,'shop');assert.ok(s.getSnapshot().guideAnchor);enter(s);assert.equal(s.getSnapshot().requestedShop,false);
 s.updatePosition([0,-20,0],true);s.guideToShop();assert.equal(s.getSnapshot().guide.id,'return');assert.equal(s.getSnapshot().guideAnchor,null);s.cancelEggGuide();assert.equal(s.getSnapshot().guide,null);
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
