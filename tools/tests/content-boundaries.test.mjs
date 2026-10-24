import {resourceByKind} from '../../src/game/content/resources.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveFacility} from '../../src/game/world/deriveFacility.ts';
import {PINEWIND_FACILITIES} from '../../src/game/content/pinewind/hubLayout.ts';
import {GAME_CONTENT} from '../../src/game/content/gameContent.ts';
import {roomsFor} from '../../src/game/world/rooms.ts';
import { WORLD1_LAYERS as LAYERS } from './fixtures/world.mjs';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {SparseWorld,generationAtZ} from '../../src/game/terrain/SparseWorld.ts';
import {GENERATION} from './fixtures/world.mjs';
import {roomPlan} from '../../src/game/world/scenery.ts';

test('one translated and rotated facility descriptor aligns placement, collider, label and business trigger',()=>{
 const moved=deriveFacility({...PINEWIND_FACILITIES.sale,anchor:{x:20,z:30,yaw:Math.PI/2}});
 assert.equal(moved.placement.x,20);assert.equal(moved.placement.yaw,Math.PI/2);
 assert.deepEqual(moved.solid.at,[20,3,30]);assert.equal(moved.solid.yaw,Math.PI/2);
 assert.equal(moved.trigger.x,26.7);assert.equal(moved.trigger.z,30);
 assert.equal(moved.sign.at[0],moved.trigger.x);assert.equal(moved.ring.at[2],moved.trigger.z);
 const session=new GameSession({...GAME_CONTENT.session,sales:[moved.trigger]});
 session.collected([{kind:71}]);session.updatePosition([26.7,0,30],true);
 assert.equal(session.getSnapshot().inventory.used,0);assert.equal(session.getSnapshot().coins,resourceByKind(71).price);
 session.collected([{kind:71}]);session.updatePosition([26.7,0,30],true);
 assert.equal(session.getSnapshot().coins,resourceByKind(71).price); // no second entry
});
// A kit room (the crystal cave) follows changed dimensions; authored halls keep their own fixed size.
test('changed depth, theme and room dimensions agree across physics generation, view and destination',()=>{
 const layers=LAYERS.map(l=>l.id==='crystal'?{...l,scene:'crystal-station-v1',from:1300,theme:'frozen_cave',room:{centerX:0,centerZ:0,widthCells:24,depthCells:22,heightCells:12}}:l);
 const room=roomsFor(layers).find(r=>r.id==='crystal');
 const generation={...generationAtZ(GENERATION,0),layers},world=new SparseWorld(generation),workerWorld=new SparseWorld(structuredClone(generation));
 for(const cell of [[11,-650,0],[11,-639,0],[12,-650,0],[11,-638,0],[11,-651,0]])assert.equal(world.cell(cell),workerWorld.cell(cell));
 assert.equal(world.cell([11,-650,0]),0);assert.equal(world.cell([11,-651,0]),7);assert.notEqual(world.cell([12,-650,0]),0);
 assert.equal(room.spawn[1],-1299.9);assert.ok(Math.abs(room.sell.x+14.4)<1e-9);
 const plan=roomPlan(room);
 assert.ok(plan.authored.instances.some(p=>!p.fixed&&p.at[0]*plan.authored.scale[0]+plan.authored.origin[0]>20));
 assert.deepEqual(plan.authored.scale,[1.2,1.2,1.1]);
});
