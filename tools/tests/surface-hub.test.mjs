import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {SURFACE_PORTALS,portalsFor} from '../../src/game/world/SurfaceHub.ts';
import {LAYERS} from '../../src/game/content/layers.ts';
import {ROOMS} from '../../src/game/world/rooms.ts';
function setup(){const s=new GameSession(),calls=[];s.attach({cell:()=>1,pending:()=>false,mine:()=>true,cancelMining:()=>{},returnToSurface:()=>{},travelTo:p=>calls.push(p)});return {s,calls};}
const feet=p=>[p.zone.x,p.zone.y,p.zone.z];
test('every layer has its own disjoint pad and follows configured unlock depth',()=>{
 assert.equal(SURFACE_PORTALS.length,ROOMS.length);
 for(const [i,p] of SURFACE_PORTALS.entries()){
  assert.equal(p.id,ROOMS[i].id);assert.equal(p.depth,ROOMS[i].depth);
  for(const q of SURFACE_PORTALS.slice(i+1))assert.ok(Math.hypot(p.zone.x-q.zone.x,p.zone.z-q.zone.z)>p.zone.radius+q.zone.radius+.6);
 }
 const layers=LAYERS.map((l,i)=>({...l,from:l.from+i*100}));assert.equal(portalsFor(layers)[0].depth,layers[1].from);
});
test('locked pad gives one entry notice, never transports, and does not unlock itself',()=>{
 const {s,calls}=setup(),p=SURFACE_PORTALS[0];let events=0;s.subscribe(()=>events++);
 s.updatePosition(feet(p),true);assert.equal(calls.length,0);assert.equal(s.getSnapshot().destinations[0].unlocked,false);assert.match(s.getSnapshot().notice,/400/);
 const before=events;for(let i=0;i<10;i++)s.updatePosition(feet(p),true);assert.equal(events,before);
});
test('unlocked pad travels without the home menu, only on grounded entry, once until leaving',()=>{
 const {s,calls}=setup(),p=SURFACE_PORTALS[0];s.updatePosition([90,-400,90],false);
 s.updatePosition(feet(p),false);assert.equal(calls.length,0);
 s.updatePosition([p.zone.x,2,p.zone.z],true);assert.equal(calls.length,0);
 s.updatePosition(feet(p),true);assert.deepEqual(calls,[ROOMS[0].spawn]);
 s.updatePosition(feet(p),true);assert.equal(calls.length,1);
 s.updatePosition([0,0,26],true);s.updatePosition(feet(p),true);assert.equal(calls.length,2);
 assert.equal(s.travelTo(SURFACE_PORTALS[1].id),'locked');
});
test('each pad uses its own destination rather than a shared fixed spawn',()=>{
 const {s,calls}=setup();s.updatePosition([90,-4000,90],false);
 for(const [i,p] of SURFACE_PORTALS.entries()){
  s.updatePosition(feet(p),true);assert.deepEqual(calls[i],ROOMS[i].spawn);
  s.updatePosition(ROOMS[i].spawn,true);
 }
 assert.equal(calls.length,ROOMS.length);
});
