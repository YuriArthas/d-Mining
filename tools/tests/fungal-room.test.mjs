import test from 'node:test';
import assert from 'node:assert/strict';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import {FUNGAL_HALL} from '../../src/game/content/underground/fungalHall.ts';
import {undergroundHall} from '../../src/game/content/underground/halls.ts';

test('蘑菇洞穴 is an authored hall: no kit, its colliders keep the shaft open, its rings and board sit at the stalls and the north wall',()=>{
 const room=GAME_CONTENT.rooms.find(r=>r.id==='fungal'),plan=roomPlan(room);
 assert.equal(plan.authored,undefined,'the kit is gone');
 assert.equal(room.sceneDefinition.hall,'fungal-hall');
 assert.deepEqual(room.spawn,[0,-799.9,12]);
 assert.equal(plan.signs[0].subtitle,'03 / 800 米');
 assert.ok(Math.abs(plan.signs[0].at[2]-FUNGAL_HALL.board[2])<.5,'the name floats in front of the board');
 assert.equal(plan.shapes.length,2);
 assert.deepEqual([room.sell.x,room.sell.z],[FUNGAL_HALL.stalls.sell.ring[0],FUNGAL_HALL.stalls.sell.ring[2]]);
 // Nothing solid stands in the 16 m pit, except the floor ring's stones which stop at its edge.
 for(const s of plan.solids)assert.ok(s.at[0]+s.half[0]<=-8+1e-6||s.at[0]-s.half[0]>=8-1e-6||s.at[2]+s.half[2]<=-8+1e-6||s.at[2]-s.half[2]>=8-1e-6,`solid in the pit at ${s.at}`);
 // The rings stand clear of every collider.
 for(const zone of [room.sell,room.shop])for(const s of plan.solids.filter(s=>s.half[1]>.1))
  assert.ok(Math.abs(zone.x-s.at[0])>s.half[0]+.3||Math.abs(zone.z-s.at[2])>s.half[2]+.3||s.hull,`ring at ${zone.x},${zone.z} blocked by ${s.at}`);
 const session=new GameSession(GAME_CONTENT.session);
 session.attach({cell:()=>64,pending:()=>false,mine:()=>true,cancelMining(){},travelTo(){}});
 session.updatePosition([room.sell.x,room.sell.y,room.sell.z],true);assert.equal(session.getSnapshot().inSellZone,true);
 session.updatePosition([room.shop.x,room.shop.y,room.shop.z],true);assert.equal(session.getSnapshot().shopId,'fungal');
});

test('the hall loads with the authored scene at its room, and its light sources stay inside the hall',()=>{
 const room=GAME_CONTENT.rooms.find(r=>r.id==='fungal'),instance=GAME_CONTENT.surface.authored.instances.find(i=>i.asset==='fungal-hall');
 assert.deepEqual(instance.at,[room.x,-room.depth,room.z]);
 const {hall,solids}=undergroundHall('fungal-hall');
 assert.ok(solids.length>40);
 for(const l of hall.lights)assert.ok(Math.abs(l.at[0])<20&&Math.abs(l.at[2])<20&&l.at[1]>0&&l.at[1]<20);
 assert.ok(hall.lights.length<=6,'fits the fixed light pool');
});
