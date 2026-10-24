import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_CONTENT} from '../../src/game/content/gameContent.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {createScenery,disposeScenery} from '../../src/game/presentation/SceneryMesh.ts';
import {sceneryGeometryMemory} from '../../src/game/presentation/sceneryGeometryMemory.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';

test('crystal station keeps its floor and ceiling aperture, independent sale, and travel once reached',()=>{
 const room=GAME_CONTENT.rooms.find(r=>r.id==='crystal'),plan=roomPlan(room);
 assert.equal(plan.authored.kit.id,'crystal-v1');assert.equal(room.shop,null);
 assert.equal(plan.signs[0].subtitle,`04 / ${room.depth} 米`);
 const outside=p=>p.at[0]+p.half[0]<=-8||p.at[0]-p.half[0]>=8||p.at[2]+p.half[2]<=-8||p.at[2]-p.half[2]>=8;
 assert.ok(plan.solids.every(outside));
 const floorAndCeiling=plan.authored.instances.filter(p=>p.floor);
 assert.equal(floorAndCeiling.length,8);
 assert.ok(floorAndCeiling.every(p=>outside({at:p.at,half:p.scale.map(v=>v/2)})));
 const view=createScenery({...plan,signs:[]});
 try{assert.ok(sceneryGeometryMemory(view).instanceTriangles<40000);assert.equal(plan.authored.kit.texture.size,64);}finally{disposeScenery(view)}
 const session=new GameSession(GAME_CONTENT.session),moves=[];
 session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining(){},travelTo:p=>moves.push(p)});
 assert.equal(session.travelTo('crystal'),'locked');
 session.updatePosition([room.x,-room.depth+.027,room.z],true);
 assert.equal(session.travelTo('crystal'),'travelling');assert.deepEqual(moves,[room.spawn]);
 session.collected([{kind:5}]);session.updatePosition([room.sell.x,room.sell.y,room.sell.z],true);
 assert.equal(session.getSnapshot().inSellZone,true);assert.equal(session.getSnapshot().inventory.used,0);assert.ok(session.getSnapshot().coins>0);assert.equal(session.getSnapshot().shopId,null);
});
