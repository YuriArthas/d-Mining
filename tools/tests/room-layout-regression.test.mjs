import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampContent} from '../../src/game/content/campContent.ts';
import {LAYERS} from '../../src/game/content/layers.ts';
import {PORTAL_SLOTS} from '../../src/game/content/portalSlots.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {sceneryShapeGeometry} from '../../src/game/presentation/SceneryMesh.ts';
import {ZoneDetector} from '../../src/game/logic/ZoneDetector.ts';
const campWithRoom=room=>createCampContent(LAYERS.map(l=>l.id==='old_mine'?{...l,room}:l));
const bounds=s=>{const g=sceneryShapeGeometry(s);g.computeBoundingBox();const b=g.boundingBox.clone();g.dispose();return b;};

test('room nonuniform scaling acts after rotation, preserving primitive parameters and matching colliders',()=>{
 const room=campWithRoom({centerX:0,centerZ:0,widthCells:40,depthCells:24,heightCells:12}).rooms[0];
 const plan=roomPlan(room),before=roomPlan(createCampContent().rooms[0]);
 const drumIndex=before.shapes.findIndex(s=>s.type==='cylinder'&&s.at[0]===0&&s.at[1]===2.3&&s.at[2]===-17);
 const a=bounds(before.shapes[drumIndex]),b=bounds(plan.shapes[drumIndex]);
 for(const [axis,k] of [['x',2],['y',1.2],['z',1.2]]){
  assert.ok(Math.abs(b.min[axis]-a.min[axis]*k)<1e-5);
  assert.ok(Math.abs(b.max[axis]-a.max[axis]*k)<1e-5);
 }
 assert.ok(Math.abs(b.max.x-b.min.x-11)<1e-5);
 const collider=plan.solids.find(s=>s.at[0]===0&&Math.abs(s.at[1]-2.76)<1e-6&&Math.abs(s.at[2]+20.4)<1e-6);
 assert.equal(collider.half[0]*2,10.8); // Existing intentional approximation scales with the visible drum.
 const torus=before.shapes.findIndex(s=>s.type==='torus');
 assert.deepEqual(plan.shapes[torus].size,before.shapes[torus].size); // Arc is an angle, not a Z dimension.
 const beam=before.shapes.findIndex(s=>s.type==='box'&&s.rotation.some(r=>r!==0));
 const beamA=bounds(before.shapes[beam]),beamB=bounds(plan.shapes[beam]);
 assert.ok(Math.abs(beamB.max.x-beamA.max.x*2)<1e-5);
});

test('scaled rooms keep the sale ring and actual trigger radius aligned',()=>{
 const room=campWithRoom({centerX:0,centerZ:0,widthCells:40,depthCells:24,heightCells:12}).rooms[0];
 const ring=roomPlan(room).shapes.find(s=>s.interaction&&s.size[1]===.12);
 assert.equal(ring.size[0],room.sell.radius);
 assert.equal(ring.worldScale,undefined);
 assert.deepEqual([ring.at[0],ring.at[2]],[room.sell.x,room.sell.z]);
 const zone=new ZoneDetector(room.sell);
 assert.equal(zone.update([room.sell.x+room.sell.radius-.01,room.sell.y,room.sell.z],true),'enter');
});

test('configuration rejects translated facilities that occupy the fixed shaft',()=>{
 assert.throws(()=>campWithRoom({centerX:6,centerZ:-6,widthCells:20,depthCells:20,heightCells:10}),/占用垂直入口/);
 assert.doesNotThrow(()=>campWithRoom({centerX:0,centerZ:1,widthCells:20,depthCells:20,heightCells:10}));
});

test('portal validation rejects overlapping entries and hysteresis, with both destination IDs',()=>{
 for(const offset of [0,.1,3.5]){
  assert.throws(()=>createCampContent(LAYERS,{...PORTAL_SLOTS,fungal:{...PORTAL_SLOTS.fungal,x:PORTAL_SLOTS.old_mine.x,z:PORTAL_SLOTS.old_mine.z-offset}}),/重叠: old_mine \/ fungal/);
 }
 assert.doesNotThrow(()=>createCampContent());
});
