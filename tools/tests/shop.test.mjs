import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';
import { EquipmentCollection } from '../../src/game/logic/EquipmentCollection.ts';
import { MinerAvatar } from '../../src/game/presentation/MinerAvatar.ts';
import { shopBackpacks, shopTools } from '../../src/game/content/shopCatalog.ts';
const content=GAME_CONTENT.session;
const T2=ECONOMY.tools[1].price,T3=ECONOMY.tools[2].price,T4=ECONOMY.tools[3].price,B2=ECONOMY.bags[1].price,[C1,C2,C3]=ECONOMY.bags.map(b=>b.capacity);
function funded(coins=10000) { const data=new GameSession(content).exportProgress();data.wallet.balances.gold=coins;return GameSession.fromData(data,content); }
function enter(s) { const {zone}=content.shops[0];s.updatePosition([zone.x,zone.y,zone.z],true);assert.ok(s.getSnapshot().shopId); }
test('shop opens anywhere: purchases need affordability and sequence, never the shop circle; repeated touch never double-debits',()=>{
 const away=funded();assert.equal(away.useShopItem('tools','tool-2').status,'upgraded','bought far from the shop');assert.equal(away.getSnapshot().coins,10000-T2);
 const s=funded();
 enter(s);assert.equal(s.useShopItem('tools','tool-3').status,'locked');assert.equal(s.useShopItem('backpacks','journey-bag-3').status,'locked');assert.equal(s.getSnapshot().coins,10000);
 let commits=0;s.onProgressCommitted(()=>commits++);
 assert.equal(s.useShopItem('tools','tool-2').status,'upgraded');assert.equal(s.getSnapshot().coins,10000-T2);assert.equal(commits,1);
 assert.equal(s.useShopItem('tools','tool-2').status,'equipped');assert.equal(s.getSnapshot().coins,10000-T2);assert.equal(commits,1);
 const short=Math.min(T2,B2)-1,poor=funded(short);enter(poor);assert.equal(poor.useShopItem('tools','tool-2').status,'insufficient');assert.equal(poor.useShopItem('backpacks','journey-bag-2').status,'insufficient');assert.equal(poor.getSnapshot().coins,short);
 // Later worlds' gear is priced in their own currency: gold never buys it.
 const tech=funded(1e12),data=tech.exportProgress();data.pickaxe.level=data.equipment.toolLevel=10;
 const at10=GameSession.fromData(data,content);assert.equal(at10.getSnapshot().pickaxeUpgrade.currency,'tech');assert.equal(at10.useShopItem('tools','tool-11').status,'insufficient');
 s.setSuspended(true);assert.equal(s.useShopItem('tools','tool-3').status,'unavailable');
});
test('equipping old gear is free, persists, and preserves highest purchase and next price',()=>{
 const s=funded();enter(s);s.useShopItem('tools','tool-2');s.useShopItem('tools','tool-3');s.useShopItem('backpacks','journey-bag-2');
 assert.equal(s.useShopItem('tools','tool-1').status,'equipped');assert.equal(s.useShopItem('backpacks','starter-bag').status,'equipped');
 const left=10000-T2-T3-B2;assert.equal(s.getSnapshot().coins,left);assert.equal(s.getSnapshot().pickaxe.level,1);assert.equal(s.getSnapshot().inventory.capacity,C1);
 const r=GameSession.fromData(s.exportProgress(),content);enter(r);assert.equal(r.getSnapshot().equipment.toolLevel,3);assert.equal(r.getSnapshot().pickaxeUpgrade.price,T4);assert.equal(r.getSnapshot().backpackUpgrade.next.capacity,C3);
 r.useShopItem('tools','tool-3');r.useShopItem('backpacks','journey-bag-2');assert.equal(r.getSnapshot().coins,left);assert.equal(r.getSnapshot().pickaxe.level,3);assert.equal(r.getSnapshot().inventory.capacity,C2);
});
test('smaller bag never deletes contents',()=>{
 const s=funded();enter(s);s.useShopItem('backpacks','journey-bag-2');s.collected(Array.from({length:C1+1},()=>({kind:64})));
 const before=s.exportProgress();assert.equal(s.useShopItem('backpacks','starter-bag').status,'too-small');assert.deepEqual(s.exportProgress(),before);
});
test('old saves derive owned tiers; corrupt new collections fail instead of hiding damage',()=>{
 const data=funded().exportProgress();delete data.equipment;data.pickaxe.level=3;data.inventory.capacity=C3;
 const s=GameSession.fromData(data,content);assert.deepEqual(s.getSnapshot().equipment,{version:1,toolLevel:3,backpackCapacity:C3,enhance:0});enter(s);assert.equal(s.useShopItem('tools','tool-1').status,'equipped');assert.equal(s.getSnapshot().coins,10000);
 for(const bad of [null,{}, {version:2}, {version:1,toolLevel:2,backpackCapacity:C3}, {version:1,toolLevel:3,backpackCapacity:C1}])assert.throws(()=>new EquipmentCollection(3,C3,bad));
});
const loader=new GLTFLoader().register(()=>({name:'cpu-test-textures',loadTexture:()=>Promise.resolve(new Texture())}));
async function asset(path) { const b=readFileSync(new URL('../../src/game/assets/'+path,import.meta.url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''); }
test('all 60 catalog models exist, real prices/capacities match game progression, and avatar equips the selected models',async()=>{
 const [library,character,stage]=await Promise.all([asset('shop/equipment.glb'),asset('character/miner-d.glb'),asset('shop/showroom.glb')]);
 const s=funded(),catalog=s.getSnapshot().shopCatalog;
 assert.equal(catalog.tools.length,30);assert.equal(catalog.backpacks.length,30);
 for(const [i,item] of catalog.tools.entries()){assert.ok(library.scene.getObjectByName(item.model));assert.equal(item.price,ECONOMY.tools[i].price);assert.equal(item.currency,ECONOMY.tools[i].currency);}
 for(const [i,item] of catalog.backpacks.entries()){assert.ok(library.scene.getObjectByName(item.model));assert.equal(item.capacity,ECONOMY.bags[i].capacity);assert.equal(item.price,ECONOMY.bags[i].price);}
 assert.ok(stage.scene.getObjectByName('ShowCart'));assert.ok(stage.scene.getObjectByName('ShowroomStage'));
 const a=Reflect.construct(MinerAvatar,[character,library]);try{a.setEquipment(12,23);const d=a.diagnostics();assert.equal(d.pickaxe.model,'Tool12');assert.equal(d.backpack.model,'Bag23');assert.equal(d.backpack.attachedTo,'UpperTorso');assert.equal(d.bones,16);assert.equal(d.triangles,11912);assert.ok(d.pickaxe.tip.every(Number.isFinite));}finally{a.dispose();}
});

test('三十把工具和三十个背包各有自己的名字和一句介绍；电钻类是打蛋器、冲击电钻、链锯、等离子钻和独角兽角钻',()=>{
  const tools=shopTools(),bags=shopBackpacks();
  for(const list of [tools,bags]){
    assert.equal(new Set(list.map(i=>i.name)).size,list.length,'every name is different');
    assert.equal(new Set(list.map(i=>i.description)).size,list.length,'every item has its own line');
  }
  assert.equal(tools[0].name,'老木镐');assert.equal(bags[0].name,'麻布袋');
  assert.deepEqual(tools.filter(t=>t.motion==='drill').map(t=>t.level),[7,12,13,20,27]);
  assert.ok(tools.every(t=>t.motion==='drill'||t.motion==='swing'));
});
test('the newest pickaxe enhances three times in its own currency: more damage, same gate; the next pickaxe starts at +0',()=>{
 const s=funded(1e9),tool2=ECONOMY.tools[1];
 assert.equal(s.getSnapshot().pickaxeEnhance.next.price,ECONOMY.tools[0].enhance[0].price,'even the first pickaxe can be enhanced');
 s.useShopItem('tools','tool-2');let gold=s.getSnapshot().coins,commits=0;s.onProgressCommitted(()=>commits++);
 for(const [k,step] of tool2.enhance.entries()){
  assert.deepEqual(s.enhancePickaxe(2,k),{status:'enhanced',level:2,enhance:k+1,spent:step.price});
  gold-=step.price;assert.equal(s.getSnapshot().coins,gold);assert.equal(s.getSnapshot().pickaxe.basePower,step.power);assert.equal(s.getSnapshot().miningStats.power,step.power);
 }
 assert.equal(commits,3);assert.equal(s.enhancePickaxe(2,2).status,'stale');assert.equal(s.enhancePickaxe(2,3).status,'max');assert.equal(s.getSnapshot().pickaxeEnhance.next,null);
 // Older pickaxes were never enhanced; wearing the newest again brings its enhancements back; all of it survives a reload.
 assert.equal(s.useShopItem('tools','tool-1').status,'equipped');assert.equal(s.getSnapshot().pickaxe.basePower,ECONOMY.tools[0].power);
 s.useShopItem('tools','tool-2');assert.equal(s.getSnapshot().pickaxe.enhance,3);
 const r=GameSession.fromData(s.exportProgress(),content);assert.equal(r.getSnapshot().pickaxe.basePower,tool2.enhance[2].power);assert.equal(r.getSnapshot().equipment.enhance,3);
 r.useShopItem('tools','tool-3');assert.equal(r.getSnapshot().pickaxe.enhance,0);assert.equal(r.getSnapshot().pickaxeEnhance.enhance,0);
 const poor=funded(0);assert.equal(poor.enhancePickaxe(1,0).status,'insufficient');assert.equal(poor.getSnapshot().pickaxe.enhance,0);
 const bad=s.exportProgress();bad.pickaxe={version:1,level:1,enhance:2};assert.throws(()=>GameSession.fromData(bad,content));
});
test('the 4th and 5th pet slots are bought in worlds 2 and 3 once their layer is reached; rebirth keeps them',()=>{
 const [fourth,fifth]=ECONOMY.petSlots,data=new GameSession(content).exportProgress();
 data.wallet.balances={gold:0,tech:fourth.price,star:fifth.price};data.worldProgress={version:2,openWorlds:[1,2,3]};
 const s=GameSession.fromData(data,content);
 assert.deepEqual([s.getSnapshot().petSlot.slot,s.getSnapshot().petSlot.unlocked],[4,false]);assert.equal(s.buyPetSlot(3).status,'locked');
 const room=w=>content.destinations.filter(d=>d.worldId===w)[fourth.layer-1];
 s.devUnlockLayer(room(2).id);assert.equal(s.getSnapshot().petSlot.canAfford,true);
 assert.equal(s.buyPetSlot(4).status,'stale');assert.deepEqual(s.buyPetSlot(3),{status:'bought',slots:4});
 assert.equal(s.getSnapshot().balances.tech,0);assert.equal(s.pets.getSnapshot().slots.length,4);
 assert.equal(s.getSnapshot().petSlot.slot,5);assert.equal(s.getSnapshot().petSlot.currency,'star');
 s.devUnlockLayer(room(3).id);assert.equal(s.buyPetSlot(4).status,'bought');assert.equal(s.getSnapshot().petSlot,null);assert.equal(s.buyPetSlot(5).status,'max');
 assert.equal(GameSession.fromData(s.exportProgress(),content).pets.getSnapshot().slots.length,5);
});
