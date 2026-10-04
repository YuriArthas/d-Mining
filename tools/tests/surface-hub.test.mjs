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

test('landmark stands inside its own activation area with clearance for the player capsule',async()=>{
 const {PORTAL_MODEL}=await import('../../src/game/world/SurfaceHub.ts');
 const corner=Math.hypot(PORTAL_MODEL.width/2,PORTAL_MODEL.depth/2);
 for(const p of SURFACE_PORTALS){assert.equal(p.x,p.zone.x);assert.equal(p.z,p.zone.z);assert.ok(p.zone.radius>corner+.4);}
});
test('eighteen eggs occupy three supported ascending tiers with separate browsing aisles',async()=>{
 const {PET_DISPLAYS,PET_AREA,HUB_PLACEMENTS}=await import('../../src/game/world/SurfaceHub.ts');
 const {PET_TIERS,PET_TERRACE_SOLIDS}=await import('../../src/game/world/PetTerraces.ts');
 assert.equal(PET_DISPLAYS.length,18);
 assert.deepEqual(PET_TIERS.map(t=>PET_DISPLAYS.filter(p=>p.tier===t.tier).length),[6,6,6]);
 const eggs=HUB_PLACEMENTS.filter(p=>p.asset.startsWith('egg-'));
 for(const [i,p] of eggs.entries()){
  assert.ok(p.x-p.width/2>PET_AREA.minX&&p.x+p.width/2<PET_AREA.maxX);
  assert.ok(PET_TERRACE_SOLIDS.some(s=>Math.abs(s.at[1]+s.half[1]-p.y)<.001&&Math.abs(p.x-s.at[0])+p.width/2<=s.half[0]&&Math.abs(p.z-s.at[2])+p.depth/2<=s.half[2]),'egg must stand on its platform');
  for(const q of eggs.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>=4);
 }
 for(let i=1;i<PET_TIERS.length;i++){
  assert.ok(PET_TIERS[i].x<PET_TIERS[i-1].x);assert.ok(PET_TIERS[i].y>PET_TIERS[i-1].y);
 }
});
test('decorations do not occupy the pet court, portal court or central approach',async()=>{
 const {CAMP_DECORATIONS}=await import('../../src/game/world/QuarryLayout.ts');
 const {HUB_CLEARANCES,footprint,intersects}=await import('../../src/game/world/CampLayout.ts');
 for(const p of CAMP_DECORATIONS){
  // Terrace planting is behind the enclosing bank, outside the playable floor.
  if((p.y??0)>3)continue;
  assert.ok(!HUB_CLEARANCES.some(r=>intersects(r,footprint(p))),p.asset+' blocks a reserved bay');
 }
});

test('courtyard circulation stays outside unlocked portal triggers, including hysteresis',()=>{
 const {s,calls}=setup();s.updatePosition([90,-4000,90],false);
 const points=[];
 for(let x=0;x<=35;x++)for(const z of [30,33,36])points.push([x,0,z]);
 for(const point of points){
  for(const p of SURFACE_PORTALS)assert.ok(Math.hypot(point[0]-p.x,point[2]-p.z)>p.zone.radius+p.zone.hysteresis+.4);
  s.updatePosition(point,true);
 }
 assert.equal(calls.length,0,'browsing must not teleport');
 const xs=SURFACE_PORTALS.map(p=>p.x),zs=SURFACE_PORTALS.map(p=>p.z);
 assert.ok(Math.max(...xs)-Math.min(...xs)<=27);assert.ok(Math.max(...zs)-Math.min(...zs)<=18);
});
