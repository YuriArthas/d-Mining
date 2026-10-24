import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_CONTENT} from '../../src/game/content/gameContent.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';

// Every kit room of every world: art, colliders and signs fit the room and keep the shaft open.
for(const world of GAME_CONTENT.worlds)for(const room of world.localRooms.filter(r=>!r.sceneDefinition?.hall))test(`${room.id} (world ${world.id}) keeps its kit inside the room and the shaft open`,()=>{
 const plan=roomPlan(room);
 assert.ok(plan.signs[0].subtitle.endsWith(`${room.depth} 米`));
 const outside=s=>s.at[0]+s.half[0]<=-8||s.at[0]-s.half[0]>=8||s.at[2]+s.half[2]<=-8||s.at[2]-s.half[2]>=8;
 assert.ok(plan.solids.every(outside));assert.ok(plan.authored.instances.some(p=>p.floor));
 assert.ok(plan.authored.instances.filter(p=>p.floor).every(p=>outside({at:p.at,half:p.scale.map(v=>v/2)})));
 const triangles=plan.authored.instances.reduce((sum,p)=>sum+plan.authored.kit.meshes[p.mesh].indices.length/3,0);
 assert.ok(triangles<60000);assert.equal(plan.authored.kit.texture.size,64);
});
// World 1's rooms: reaching one admits travel to it; its counters work.
for(const room of GAME_CONTENT.rooms)test(`${room.id}: reaching it admits travel; its counters work`,()=>{
 const session=new GameSession(GAME_CONTENT.session),moves=[];
 session.attach({cell:()=>64,pending:()=>false,mine:()=>true,cancelMining(){},travelTo:p=>moves.push(p)});
 assert.equal(session.travelTo(room.id),'locked');
 session.updatePosition([room.x,-room.depth+.027,room.z],true);
 assert.equal(session.travelTo(room.id),'travelling');assert.deepEqual(moves,[room.spawn]);
 session.collected([{kind:71}]);session.updatePosition([room.sell.x,room.sell.y,room.sell.z],true);
 assert.equal(session.getSnapshot().inventory.used,0);assert.equal(session.getSnapshot().inSellZone,true);
 if(room.shop){session.updatePosition([room.shop.x,room.shop.y,room.shop.z],true);assert.equal(session.getSnapshot().shopId,room.id)}else assert.equal(session.getSnapshot().shopId,null);
});
