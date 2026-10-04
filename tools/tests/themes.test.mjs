import assert from 'node:assert/strict';
import test from 'node:test';
import { RESOURCES, resourceByKind } from '../../src/game/content/resources.ts';
import { THEMES } from '../../src/game/content/themes.ts';
import { LAYERS, layerAtDepth, validateLayers } from '../../src/game/content/layers.ts';
import { ROOMS, roomsFor, roomAir, onRoomFloor } from '../../src/game/world/rooms.ts';
import { SparseWorld, WORLD_GENERATION, sampleXYZ, regionOf } from '../../src/game/terrain/SparseWorld.ts';
import { appearanceKey } from '../../src/game/terrain/minerals.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';
import { roomPlan, surfacePlan } from '../../src/game/world/scenery.ts';
import { Exploration } from '../../src/game/logic/Exploration.ts';
import { Inventory } from '../../src/game/logic/Inventory.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
import { oreDrops, itemVolume, itemPrice } from '../../src/game/application/items.ts';
import { sellAll } from '../../src/game/application/Sale.ts';

test('ten reusable themes and thirty unique resources are all used; fixed floor is not an item',()=>{
 assert.equal(THEMES.length,10);assert.equal(RESOURCES.length,30);assert.equal(RESOURCES.filter(r=>r.base).length,10);
 assert.equal(new Set(RESOURCES.map(r=>r.itemId)).size,30);assert.equal(new Set(RESOURCES.map(r=>r.kind)).size,30);
 const used=new Set(LAYERS.flatMap(l=>[l.base,...l.ores.map(o=>o.kind)]));assert.deepEqual(used,new Set(RESOURCES.map(r=>r.kind)));
 assert.throws(()=>resourceByKind(7));assert.throws(()=>validateLayers([]));
 assert.throws(()=>validateLayers(LAYERS.map((l,i)=>i===2?{...l,from:401}:l)));
 assert.throws(()=>validateLayers(LAYERS.map((l,i)=>i===2?{...l,theme:'missing'}:l)));
});
test('moving a layer in one configuration moves its floor, unlock and landing while keeping identity and theme',()=>{
 const layers=LAYERS.map(l=>l.id==='fungal'?{...l,from:900}:l);validateLayers(layers);
 const room=roomsFor(layers).find(r=>r.id==='fungal'),world=new SparseWorld({...WORLD_GENERATION,layers});
 assert.equal(room.depth,900);assert.equal(room.theme,ROOMS[1].theme);assert.equal(room.spawn[1],-899.9);
 assert.equal(layerAtDepth(899,layers).id,'old_mine');assert.equal(layerAtDepth(900,layers).id,'fungal');
 assert.equal(roomAir(0,-400,0,layers),false);assert.equal(roomAir(0,-450,0,layers),true);
 assert.equal(onRoomFloor(5,-401,5,layers),false);assert.equal(onRoomFloor(5,-451,5,layers),true);
 assert.equal(world.cell([5,-451,5]),7);assert.equal(world.cell([0,-450,0]),0);assert.ok(world.canMine([0,-451,0]));
 const progress=new Exploration(roomsFor(layers));progress.visit(899);assert.equal(progress.has(room.id),false);progress.visit(900);assert.equal(progress.has(room.id),true);
 const c=[5,-451,5];for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(world.snapshot(regionOf(c,size),size)),world.generation),7);
 const original=new SparseWorld();assert.equal(original.cell([5,-401,5]),7); // No mutation of the active layout.
});
test('visual floor themes split independently while collision remains identical',()=>{
 const a=buildRegion('collision',[0,-26,0],8,[],WORLD_GENERATION).mesh;
 const layers=LAYERS.map(l=>l.id==='old_mine'?{...l,theme:'frozen_cave'}:l),g={...WORLD_GENERATION,layers};
 const b=buildRegion('collision',[0,-26,0],8,[],g).mesh;assert.deepEqual(a,b);
 assert.notEqual(appearanceKey(7,-201),appearanceKey(7,-201,layers));
 const r1=buildRegion('render',[0,-26,0],8,[],WORLD_GENERATION).mesh,r2=buildRegion('render',[0,-26,0],8,[],g).mesh;
 assert.deepEqual(r1.positions,r2.positions);assert.notDeepEqual(r1.tiles,r2.tiles);
 assert.equal(appearanceKey(5,-201),appearanceKey(5,-401));
});
test('every resource flows through the same unrestricted inventory and sale APIs',()=>{
 const bag=new Inventory(1,itemVolume),wallet=new Wallet();
 bag.add(oreDrops(RESOURCES));assert.equal(bag.getSnapshot().totalCount,30);assert.ok(bag.isFull());
 const expected=RESOURCES.reduce((n,r)=>n+r.price,0);assert.equal(sellAll(bag,wallet,itemPrice).coins,expected);assert.equal(wallet.getBalance(),expected);assert.equal(bag.getSnapshot().used,0);
});
test('scene plans have finite geometry and keep landing and service centers out of ordinary solids',()=>{
 const plans=[surfacePlan(),...ROOMS.map(roomPlan)];
 for(const plan of plans){assert.ok(plan.shapes.length>0);for(const s of plan.shapes){assert.ok([...s.at,...s.size,...(s.rotation??[])].every(Number.isFinite));assert.ok(s.size.every(v=>v>0));}}
 for(const room of ROOMS){const plan=roomPlan(room);
  for(const p of [[room.spawn[0],0,room.spawn[2]],[room.sell.x,0,room.sell.z],...(room.shop?[[room.shop.x,0,room.shop.z]]:[])]){
   for(const s of plan.solids)assert.ok(Math.abs(p[0]-s.at[0])>s.half[0]+.4||Math.abs(p[2]-s.at[2])>s.half[2]+.4||s.at[1]-s.half[1]>1.8,'facility/landing blocked');
  }
  for(const s of plan.solids)if(s.at[1]-s.half[1]<2)assert.ok(Math.abs(s.at[0])-s.half[0]>=8||Math.abs(s.at[2])-s.half[2]>=8,'entrance obstructed');
 }
});
