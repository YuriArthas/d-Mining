import test from 'node:test';
import assert from 'node:assert/strict';
import {LAYERS} from '../../src/game/content/layers.ts';
import {createCampContent} from '../../src/game/content/campContent.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {withInitialAccess} from '../../src/game/content/initialAccess.ts';

for(const layer of LAYERS.filter(l=>l.from>=1600&&l.scene))test(`${layer.id} independently moves its authored art, zones and travel destination when depth changes`,()=>{
 const camp=createCampContent(LAYERS.map(l=>l.id===layer.id?{...l,from:l.from+100}:l));
 const room=camp.rooms.find(r=>r.id===layer.id),plan=roomPlan(room);
 assert.equal(plan.authored.kit.id,layer.id+'-v1');assert.equal(room.spawn[1],-layer.from-99.9);
 assert.ok(plan.signs[0].subtitle.endsWith(`${layer.from+100} M`));
 const outside=s=>s.at[0]+s.half[0]<=-8||s.at[0]-s.half[0]>=8||s.at[2]+s.half[2]<=-8||s.at[2]-s.half[2]>=8;
 assert.ok(plan.solids.every(outside));assert.equal(plan.authored.instances.filter(p=>p.floor).length,8);
 assert.ok(plan.authored.instances.filter(p=>p.floor).every(p=>outside({at:p.at,half:p.scale.map(v=>v/2)})));
 const triangles=plan.authored.instances.reduce((sum,p)=>sum+plan.authored.kit.meshes[p.mesh].indices.length/3,0);
 assert.ok(triangles<60000);assert.equal(plan.authored.kit.texture.size,64);
 const session=new GameSession(withInitialAccess(camp.session)),moves=[];
 session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining(){},returnToSurface(){},travelTo:p=>moves.push(p)});
 const zone=camp.session.portals.find(p=>p.id===layer.id).zone;
 session.updatePosition([zone.x,zone.y,zone.z],true);assert.deepEqual(moves,[room.spawn]);
 session.collected([{kind:5}]);session.updatePosition([room.sell.x,room.sell.y,room.sell.z],true);
 assert.equal(session.getSnapshot().inventory.used,0);assert.equal(session.getSnapshot().inSellZone,true);
 if(room.shop){session.updatePosition([room.shop.x,room.shop.y,room.shop.z],true);assert.equal(session.getSnapshot().shopId,layer.id)}else assert.equal(session.getSnapshot().shopId,null);
});
