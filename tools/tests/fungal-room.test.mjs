import test from 'node:test';
import assert from 'node:assert/strict';
import {LAYERS} from '../../src/game/content/layers.ts';
import {createCampContent} from '../../src/game/content/campContent.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {createScenery,disposeScenery} from '../../src/game/presentation/SceneryMesh.ts';
import {sceneryGeometryMemory} from '../../src/game/presentation/sceneryGeometryMemory.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {withInitialAccess} from '../../src/game/content/initialAccess.ts';

test('fungal room uses its own complete kit, functional zones, and clear vertical shaft at another depth',()=>{
 const camp=createCampContent(LAYERS.map(l=>l.id==='fungal'?{...l,from:900}:l));
 const room=camp.rooms.find(r=>r.id==='fungal'),plan=roomPlan(room);
 assert.equal(plan.authored.kit.id,'fungal-v1');
 assert.deepEqual(room.spawn,[0,-899.9,12]);
 assert.equal(plan.signs[0].subtitle,'03 / 900 M');
 assert.equal(plan.shapes.length,2);
 for(const s of plan.solids)assert.ok(s.at[0]+s.half[0]<=-8||s.at[0]-s.half[0]>=8||s.at[2]+s.half[2]<=-8||s.at[2]-s.half[2]>=8);
 const view=createScenery({...plan,signs:[]});
 try{
  assert.ok(sceneryGeometryMemory(view).instanceTriangles<60000);
  assert.ok(sceneryGeometryMemory(view).geometryBytes<200000);
  assert.equal(plan.authored.kit.texture.size,64);
  assert.ok(view.children.filter(c=>c.isInstancedMesh).every(c=>!c.castShadow));
 }finally{disposeScenery(view);}
 const session=new GameSession(withInitialAccess(camp.session)),moves=[];
 session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining(){},returnToSurface(){},travelTo:p=>moves.push(p)});
 const zone=camp.session.portals.find(p=>p.id==='fungal').zone;
 session.updatePosition([zone.x,zone.y,zone.z],true);
 assert.deepEqual(moves,[room.spawn]);
 session.updatePosition([room.sell.x,room.sell.y,room.sell.z],true);
 assert.equal(session.getSnapshot().inSellZone,true);
 session.updatePosition([room.shop.x,room.shop.y,room.shop.z],true);
 assert.equal(session.getSnapshot().inSellZone,false);
 assert.equal(session.getSnapshot().shopId,'fungal');
});
