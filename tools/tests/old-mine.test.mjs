import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_CONTENT} from '../../src/game/content/gameContent.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {createScenery,disposeScenery} from '../../src/game/presentation/SceneryMesh.ts';
import {sceneryGeometryMemory} from '../../src/game/presentation/sceneryGeometryMemory.ts';

const room=GAME_CONTENT.rooms.find(r=>r.id==='old_mine');
test('second layer uses only its kit and releases resources once',()=>{
 const plan=roomPlan(room);
 assert.equal(plan.authored.kit.id,'old-mine-v2');assert.equal(plan.shapes.length,1); // only functional sale ring
 assert.equal(room.spawn[1],-room.depth+.1);
 const view=createScenery({...plan,signs:[]});
 assert.ok(sceneryGeometryMemory(view).instanceTriangles<50000);
 assert.ok(sceneryGeometryMemory(view).geometryBytes<200000);
 const texture=view.children.find(m=>m.material.map)?.material.map;
 let released=0;texture.addEventListener('dispose',()=>released++);
 disposeScenery(view);assert.equal(released,1);
});
test('a new save starts with every layer locked; reaching a layer\'s depth admits travel to it',()=>{
 const session=new GameSession(GAME_CONTENT.session),moves=[];
 assert.deepEqual(session.getSnapshot().destinations.filter(d=>d.unlocked).map(d=>d.id),[]);
 assert.equal(session.getSnapshot().depth,0);
 session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining(){},travelTo:p=>moves.push(p)});
 assert.equal(session.travelTo('old_mine'),'locked');
 session.updatePosition([room.x,-room.depth+.027,room.z],true);
 assert.deepEqual(session.getSnapshot().destinations.filter(d=>d.unlocked).map(d=>d.id),['old_mine']);
 assert.equal(session.travelTo('old_mine'),'travelling');assert.deepEqual(moves,[room.spawn]);
});
