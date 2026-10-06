import test from 'node:test';
import assert from 'node:assert/strict';
import {LAYERS} from '../../src/game/content/layers.ts';
import {createCampContent} from '../../src/game/content/campContent.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {createScenery,disposeScenery} from '../../src/game/presentation/SceneryMesh.ts';
import {sceneryGeometryMemory} from '../../src/game/presentation/sceneryGeometryMemory.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {withInitialAccess} from '../../src/game/content/initialAccess.ts';

test('crystal station keeps its floor and ceiling aperture, independent sale, and portable depth',()=>{
 const camp=createCampContent(LAYERS.map(l=>l.id==='crystal'?{...l,from:1300}:l));
 const room=camp.rooms.find(r=>r.id==='crystal'),plan=roomPlan(room);
 assert.equal(plan.authored.kit.id,'crystal-v1');assert.equal(room.shop,null);
 assert.equal(plan.signs[0].subtitle,'04 / 1300 M');
 const outside=p=>p.at[0]+p.half[0]<=-8||p.at[0]-p.half[0]>=8||p.at[2]+p.half[2]<=-8||p.at[2]-p.half[2]>=8;
 assert.ok(plan.solids.every(outside));
 const floorAndCeiling=plan.authored.instances.filter(p=>p.floor);
 assert.equal(floorAndCeiling.length,8);
 assert.ok(floorAndCeiling.every(p=>outside({at:p.at,half:p.scale.map(v=>v/2)})));
 const view=createScenery({...plan,signs:[]});
 try{assert.ok(sceneryGeometryMemory(view).instanceTriangles<40000);assert.equal(plan.authored.kit.texture.size,64);}finally{disposeScenery(view)}
 const session=new GameSession(withInitialAccess(camp.session)),moves=[];
 session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining(){},returnToSurface(){},travelTo:p=>moves.push(p)});
 const zone=camp.session.portals.find(p=>p.id==='crystal').zone;
 session.updatePosition([zone.x,zone.y,zone.z],true);assert.deepEqual(moves,[room.spawn]);
 session.collected([{kind:5}]);session.updatePosition([room.sell.x,room.sell.y,room.sell.z],true);
 assert.equal(session.getSnapshot().inSellZone,true);assert.equal(session.getSnapshot().inventory.used,0);assert.ok(session.getSnapshot().coins>0);assert.equal(session.getSnapshot().shopId,null);
});
