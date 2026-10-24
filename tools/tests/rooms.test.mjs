import {resourceByKind} from '../../src/game/content/resources.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
const SESSION_CONTENT = GAME_CONTENT.session, HOME_ZONE = SESSION_CONTENT.homes[0].zone, SURFACE_SHOP = SESSION_CONTENT.shops[0].zone;
// Terrain checks use the layer templates on their own; the session uses the game's world 1 rooms.
const TEMPLATE_ROOMS = roomsFor(LAYERS), ROOMS = GAME_CONTENT.rooms;
import assert from 'node:assert/strict';
import test from 'node:test';
import { Exploration } from '../../src/game/logic/Exploration.ts';
import { roomsFor } from '../../src/game/world/rooms.ts';
import { LAYERS } from '../../src/game/content/layers.ts';
import { SparseWorld, CELL, baseXYZ } from '../../src/game/terrain/SparseWorld.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';

test('rooms are local 20 by 20 by 10 cavities with solid perimeter, ceiling and an aligned mineable entrance', () => {
 for (const r of TEMPLATE_ROOMS) {
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
 const p=new Exploration(TEMPLATE_ROOMS);
 assert.deepEqual(p.visit(399.999),[]);assert.deepEqual(p.visit(400),['old_mine']);
 assert.deepEqual(p.visit(0),[]);assert.equal(p.has('old_mine'),true);
 assert.deepEqual(p.visit(801),['fungal']);assert.equal(p.maxDepth,801);
 for(const d of [NaN,Infinity,-3])assert.deepEqual(p.visit(d),[]);
 assert.equal(p.maxDepth,801);assert.equal(new Exploration(TEMPLATE_ROOMS).has('old_mine'),false);
});
function setup() {
 const s=new GameSession(SESSION_CONTENT),calls=[];
 s.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining:()=>{},travelTo:p=>calls.push(p)});
 return {s,calls};
}
test('reaching depth outside a room unlocks travel, which works from anywhere, even right there in the mine', () => {
 const {s,calls}=setup();s.updatePosition([90,-399.999,90],false);
 assert.equal(s.getSnapshot().destinations[0].unlocked,false); s.updatePosition([90,-400,90],false);
 assert.equal(s.getSnapshot().destinations[0].unlocked,true);assert.equal(s.getSnapshot().destinations[1].unlocked,false);
 assert.equal(s.travelTo('fungal'),'locked');assert.equal(s.travelTo('unknown'),'locked');
 assert.equal(s.travelTo('old_mine'),'travelling');assert.deepEqual(calls,[ROOMS[0].spawn]);
 s.updatePosition([HOME_ZONE.x,HOME_ZONE.y,HOME_ZONE.z],true);
 assert.equal(s.travelTo('old_mine'),'travelling');assert.equal(calls.length,2);
 s.resetPosition();assert.equal(s.getSnapshot().destinations[0].unlocked,true);
});
test('standing at milestone contact height unlocks without requiring room entry or exact floor depth', () => {
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
 assert.equal(s.getSnapshot().coins,SESSION_CONTENT.initialCoins+resourceByKind(5).price*ROOMS.length);
});

test('surface upgrade kiosk reuses shop lifecycle and survives direct transfers between shops',()=>{
 const s=new GameSession(SESSION_CONTENT),u=SURFACE_SHOP,r=ROOMS.find(r=>r.shop);
 s.updatePosition([u.x,0,u.z],true);assert.equal(s.getSnapshot().shopId,'surface-upgrade');assert.equal(s.getSnapshot().inSellZone,false);
 s.updatePosition([r.shop.x,r.shop.y,r.shop.z],true);assert.equal(s.getSnapshot().shopId,r.id);
 s.updatePosition([u.x,0,u.z],true);assert.equal(s.getSnapshot().shopId,'surface-upgrade');
 s.updatePosition([0,0,26],true);assert.equal(s.getSnapshot().shopId,null);
});
