import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMP_CONTENT,createCampContent} from '../../src/game/content/campContent.ts';
import {LAYERS} from '../../src/game/content/layers.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {Exploration} from '../../src/game/logic/Exploration.ts';
import {withInitialAccess} from '../../src/game/content/initialAccess.ts';
import {createScenery,disposeScenery} from '../../src/game/presentation/SceneryMesh.ts';
import {sceneryGeometryMemory} from '../../src/game/presentation/sceneryGeometryMemory.ts';

test('second layer uses only the new kit, stays portable across depths, and releases resources once',()=>{
 const camp=createCampContent(LAYERS.map(l=>l.id==='old_mine'?{...l,from:500}:l));
 const plan=roomPlan(camp.rooms[0]);
 assert.equal(plan.authored.kit.id,'old-mine-v2');assert.equal(plan.shapes.length,1); // only functional sale ring
 assert.equal(camp.rooms[0].spawn[1],-499.9);
 const view=createScenery({...plan,signs:[]});
 assert.ok(sceneryGeometryMemory(view).instanceTriangles<50000);
 assert.ok(sceneryGeometryMemory(view).geometryBytes<200000);
 const texture=view.children.find(m=>m.material.map)?.material.map;
 let released=0;texture.addEventListener('dispose',()=>released++);
 disposeScenery(view);assert.equal(released,1);
});
test('release access opens the second-layer portal without URL or discovery-depth changes',()=>{
 const raw=CAMP_CONTENT.session;
 const session=new GameSession(withInitialAccess(raw));
 assert.deepEqual(session.getSnapshot().destinations.filter(d=>d.unlocked).map(d=>d.id),LAYERS.filter(l=>l.scene).map(l=>l.id));
 assert.equal(session.getSnapshot().depth,0);
 assert.equal(raw.initiallyUnlocked,undefined);
 const e=new Exploration(raw.destinations,['old_mine']);assert.equal(e.maxDepth,0);assert.deepEqual(e.visit(1),[]);
 assert.throws(()=>new Exploration(raw.destinations,['missing']),/未知/);
 const portal=raw.portals.find(p=>p.id==='old_mine'),moves=[];
 session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining(){},returnToSurface(){},travelTo:p=>moves.push(p)});
 session.updatePosition([portal.zone.x,portal.zone.y,portal.zone.z],true);
 assert.deepEqual(moves,[CAMP_CONTENT.rooms[0].spawn]);
 session.updatePosition([portal.zone.x,portal.zone.y,portal.zone.z],true);
 assert.equal(moves.length,1,'standing on the portal must not trigger repeated travel');
});
test('release access preserves explicit initial unlocks and is idempotent',()=>{
 const content={...CAMP_CONTENT.session,initiallyUnlocked:['fungal']};
 const configured=withInitialAccess(content);
 assert.deepEqual(configured.initiallyUnlocked,['fungal',...LAYERS.filter(l=>l.scene&&l.id!=='fungal').map(l=>l.id)]);
 assert.deepEqual(withInitialAccess(configured),configured);
});
