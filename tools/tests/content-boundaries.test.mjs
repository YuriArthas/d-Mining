import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveFacility} from '../../src/game/world/deriveFacility.ts';
import {SURFACE_FACILITIES} from '../../src/game/content/surfaceFacilities.ts';
import {createCampContent} from '../../src/game/content/campContent.ts';
import {LAYERS} from '../../src/game/content/layers.ts';
import {PORTAL_SLOTS} from '../../src/game/content/portalSlots.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {SparseWorld,WORLD_GENERATION} from '../../src/game/terrain/SparseWorld.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';

test('one translated and rotated facility descriptor aligns model, collider, label and business trigger',()=>{
 const moved=deriveFacility({...SURFACE_FACILITIES.sale,anchor:{x:20,z:30,yaw:Math.PI/2}});
 assert.equal(moved.placement.x,20);assert.equal(moved.placement.yaw,Math.PI/2);
 assert.deepEqual(moved.solid.at,[20,3,30]);assert.equal(moved.solid.yaw,Math.PI/2);
 assert.equal(moved.trigger.x,26.7);assert.equal(moved.trigger.z,30);
 assert.equal(moved.sign.at[0],moved.trigger.x);assert.equal(moved.ring.at[2],moved.trigger.z);
 const camp=createCampContent(),session=new GameSession({...camp.session,sales:[moved.trigger]});
 session.collected([{kind:5}]);session.updatePosition([26.7,0,30],true);
 assert.equal(session.getSnapshot().inventory.used,0);assert.equal(session.getSnapshot().coins,40);
 session.collected([{kind:5}]);session.updatePosition([26.7,0,30],true);
 assert.equal(session.getSnapshot().coins,40); // no second entry
 const swapped=deriveFacility({...SURFACE_FACILITIES.sale,model:{...SURFACE_FACILITIES.sale.model,asset:'simulator-upgrade'}});
 assert.deepEqual(swapped.trigger,deriveFacility(SURFACE_FACILITIES.sale).trigger);
});
test('changed depth, theme and room dimensions agree across physics generation, view, unlock and destination',()=>{
 const layers=LAYERS.map(l=>l.id==='fungal'?{...l,from:900,theme:'frozen_cave',room:{centerX:0,centerZ:0,widthCells:24,depthCells:22,heightCells:12}}:l);
 const camp=createCampContent(layers),room=camp.rooms.find(r=>r.id==='fungal');
 const generation={...WORLD_GENERATION,layers},world=new SparseWorld(generation),workerWorld=new SparseWorld(structuredClone(generation));
 for(const cell of [[11,-450,0],[11,-439,0],[12,-450,0],[11,-438,0],[11,-451,0]])assert.equal(world.cell(cell),workerWorld.cell(cell));
 assert.equal(world.cell([11,-450,0]),0);assert.equal(world.cell([11,-451,0]),7);assert.notEqual(world.cell([12,-450,0]),0);
 assert.equal(room.spawn[1],-899.9);assert.ok(Math.abs(room.sell.x+14.4)<1e-9);
 const plan=roomPlan(room);
 assert.ok(plan.authored.instances.some(p=>!p.fixed&&p.at[0]*plan.authored.scale[0]+plan.authored.origin[0]>20));
 assert.deepEqual(plan.authored.scale,[1.2,1.2,1.1]);
 assert.equal(camp.hub.portals.find(p=>p.id==='fungal').depth,900);
 const session=new GameSession(camp.session),travel=[];
 session.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining(){},returnToSurface(){},travelTo:p=>travel.push(p)});
 session.updatePosition([80,-900,80],false);session.updatePosition([camp.session.home.x,0,camp.session.home.z],true);
 assert.equal(session.travelTo('fungal'),'travelling');assert.deepEqual(travel,[room.spawn]);
});
test('adding a layer requires an explicit station, never a layer-name branch or index-based appearance',()=>{
 const layers=[...LAYERS,{...LAYERS.at(-1),id:'extra',name:'测试层',from:3900}];
 assert.throws(()=>createCampContent(layers),/extra/);
 const camp=createCampContent(layers,{...PORTAL_SLOTS,extra:{x:-23,z:18,yaw:Math.PI/2,model:'portal-crystal'}});
 assert.equal(camp.rooms.length,10);assert.equal(camp.session.destinations.at(-1).id,'extra');
 assert.equal(camp.surface.placements.filter(p=>p.portalId==='extra').length,2);
 assert.equal(camp.hub.portals.at(-1).model,'portal-crystal');
 assert.equal(camp.surface.plan.solids.filter(s=>s.at[0]===-23&&s.at[2]===18).length,2);
});

test('moving an injected station replaces its old colliders as well as its visual and trigger',()=>{
 const camp=createCampContent(LAYERS,{...PORTAL_SLOTS,core:{...PORTAL_SLOTS.core,x:-23,z:18}});
 assert.equal(camp.hub.portals.find(p=>p.id==='core').zone.x,-23);
 assert.equal(camp.surface.placements.filter(p=>p.portalId==='core'&&p.x===-23).length,2);
 assert.equal(camp.surface.plan.solids.filter(s=>s.at[0]===-27&&s.at[2]===16).length,0);
 assert.equal(camp.surface.plan.solids.filter(s=>s.at[0]===-23&&s.at[2]===18).length,2);
});
