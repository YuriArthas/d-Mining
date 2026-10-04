import { SURFACE_SHOP } from '../../src/game/world/surfaceLayout.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Exploration } from '../../src/game/logic/Exploration.ts';
import { ROOMS, HOME_ZONE } from '../../src/game/world/rooms.ts';
import { SparseWorld, CELL, baseXYZ } from '../../src/game/terrain/SparseWorld.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';

test('rooms are local 20 by 20 by 10 cavities with solid perimeter, ceiling and an aligned mineable entrance', () => {
 for (const r of ROOMS) {
  const x=r.x/CELL,z=r.z/CELL,y=-r.depth/CELL;
  for (let dx=-10;dx<10;dx++) for (let dz=-10;dz<10;dz++) for (let dy=0;dy<10;dy++) assert.equal(baseXYZ(x+dx,y+dy,z+dz),0);
  for (const c of [[x-11,y,z],[x+10,y,z],[x,y,z-11],[x,y,z+10],[x,y+10,z],[x+8,y-1,z+8]]) assert.ok(baseXYZ(...c),c.join(','));
  const world=new SparseWorld();assert.deepEqual(world.stats(),{editedRegions:0,editBytes:0,fullAirRegions:0});
  assert.equal(world.remove([[x+8,y-1,z+8]]).length,0);assert.equal(world.cell([x+8,y-1,z+8]),7);
  assert.ok(world.canMine([x,y-1,z])); // aligned entrance remains mineral
 }
});
test('room boundary has separately merged render and collision surfaces', () => {
 const coord=[1,-25,1]; // collision region touches first room floor/side
 const collision=buildRegion('collision',coord,8,[]).mesh;
 const visual=buildRegion('render',coord,8,[]).mesh;
 assert.ok(collision.indices.length>0);assert.ok(visual.indices.length>=collision.indices.length);
 assert.equal(collision.tiles.length,0);assert.equal(new SparseWorld().stats().editBytes,0);
});
test('depth milestones unlock independently of rooms and retain progress on ascent', () => {
 const p=new Exploration(ROOMS);
 assert.deepEqual(p.visit(399.999),[]);assert.deepEqual(p.visit(400),['old_mine']);
 assert.deepEqual(p.visit(0),[]);assert.equal(p.has('old_mine'),true);
 assert.deepEqual(p.visit(801),['fungal']);assert.equal(p.maxDepth,801);
 for(const d of [NaN,Infinity,-3])assert.deepEqual(p.visit(d),[]);
 assert.equal(p.maxDepth,801);assert.equal(new Exploration(ROOMS).has('old_mine'),false);
});
function setup() {
 const s=new GameSession(),calls=[];
 s.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining:()=>{},returnToSurface:()=>{},travelTo:p=>calls.push(p)});
 return {s,calls};
}
test('outside room at milestone depth unlocks travel; only home may initiate it', () => {
 const {s,calls}=setup();s.updatePosition([90,-400,90],false);
 assert.equal(s.getSnapshot().destinations[0].unlocked,true);assert.equal(s.getSnapshot().destinations[1].unlocked,false);
 assert.equal(s.travelTo('old_mine'),'away');s.updatePosition([HOME_ZONE.x,HOME_ZONE.y,HOME_ZONE.z],true);
 assert.equal(s.travelTo('fungal'),'locked');assert.equal(s.travelTo('unknown'),'locked');
 assert.equal(s.travelTo('old_mine'),'travelling');assert.deepEqual(calls,[ROOMS[0].spawn]);
 assert.equal(s.travelTo('old_mine'),'away');s.resetPosition();assert.equal(s.getSnapshot().destinations[0].unlocked,true);
});
test('standing at platform contact height reaches milestone without requiring room membership', () => {
 const {s}=setup();s.updatePosition([90,-399.973,90],false);assert.equal(s.getSnapshot().destinations[0].unlocked,false);
 s.updatePosition([90,-399.973,90],true);assert.equal(s.getSnapshot().destinations[0].unlocked,true);
});
test('each underground sale zone sells once per entry; shops exit independently', () => {
 const {s}=setup();
 for(const r of ROOMS){
  s.collected([{kind:5}]);s.updatePosition([r.sell.x,r.sell.y,r.sell.z],true);
  assert.equal(s.getSnapshot().inventory.used,0);const coins=s.getSnapshot().coins;
  s.updatePosition([r.sell.x,r.sell.y,r.sell.z],true);assert.equal(s.getSnapshot().coins,coins);
  s.updatePosition([r.x+15,-r.depth,r.z],true);assert.equal(s.getSnapshot().inSellZone,false);
 }
 const r=ROOMS[1];s.updatePosition([r.shop.x,r.shop.y,r.shop.z],true);assert.equal(s.getSnapshot().shopId,r.id);
 assert.equal(s.getSnapshot().inSellZone,false);s.updatePosition([r.x,-r.depth,r.z],true);assert.equal(s.getSnapshot().shopId,null);
 assert.equal(s.getSnapshot().coins,40*ROOMS.length);
});

test('surface upgrade kiosk reuses shop lifecycle and survives direct transfers between shops',()=>{
 const s=new GameSession(),u=SURFACE_SHOP,r=ROOMS.find(r=>r.shop);
 s.updatePosition([u.x,0,u.z],true);assert.equal(s.getSnapshot().shopId,'surface-upgrade');assert.equal(s.getSnapshot().inSellZone,false);
 s.updatePosition([r.shop.x,r.shop.y,r.shop.z],true);assert.equal(s.getSnapshot().shopId,r.id);
 s.updatePosition([u.x,0,u.z],true);assert.equal(s.getSnapshot().shopId,'surface-upgrade');
 s.updatePosition([0,0,26],true);assert.equal(s.getSnapshot().shopId,null);
});
