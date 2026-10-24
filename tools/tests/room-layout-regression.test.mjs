import test from 'node:test';
import assert from 'node:assert/strict';
import {roomsFor} from '../../src/game/world/rooms.ts';
import { WORLD1_LAYERS as LAYERS } from './fixtures/world.mjs';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {Matrix4} from 'three';
import {createScenery,disposeScenery,sceneryShapeGeometry} from '../../src/game/presentation/SceneryMesh.ts';
import {ZoneDetector} from '../../src/game/logic/ZoneDetector.ts';
// The kit machinery (worlds 2 and 3) on the first rest layer, with the crystal kit.
const kitLayers=room=>LAYERS.map(l=>l.id==='old_mine'?{...l,scene:'crystal-station-v1',...(room?{room}:{})}:l);
const oldMineWith=room=>roomsFor(kitLayers(room))[0];
const bounds=s=>{const g=sceneryShapeGeometry(s);g.computeBoundingBox();const b=g.boundingBox.clone();g.dispose();return b;};

test('authored room scales rotated instances and colliders together while preserving the global shaft',()=>{
 const room=oldMineWith({centerX:0,centerZ:0,widthCells:40,depthCells:24,heightCells:12});
 const plan=roomPlan(room),before=roomPlan(roomsFor(kitLayers())[0]);
 const a=createScenery({...before,signs:[]}),b=createScenery({...plan,signs:[]});
 try{
  const base=a.children.find(m=>m.name==='crystal-v1:crystal:amethyst');
  const scaled=b.children.find(m=>m.name===base.name);
  const scale=new Matrix4().makeScale(2,1.2,1.2),m=new Matrix4(),n=new Matrix4();
  for(let i=0;i<base.count;i++){
   base.getMatrixAt(i,m);scaled.getMatrixAt(i,n);m.premultiply(scale);
   m.elements.forEach((v,j)=>assert.ok(Math.abs(v-n.elements[j])<1e-5));
  }
  const solid=before.solids.find(s=>!s.hull&&s.at[0]<-10);
  const moved=plan.solids[before.solids.indexOf(solid)];
  assert.ok(Math.abs(moved.at[0]-solid.at[0]*2)<1e-9&&Math.abs(moved.at[1]-solid.at[1]*1.2)<1e-9);
  assert.deepEqual(moved.half,solid.half.map((v,i)=>v*[2,1.2,1.2][i]));
  assert.deepEqual(plan.authored.instances.filter(p=>p.fixed&&!p.floor),before.authored.instances.filter(p=>p.fixed&&!p.floor));
  for(const p of plan.authored.instances.filter(p=>p.floor)){
   assert.ok(p.at[0]+p.scale[0]/2<=-8||p.at[0]-p.scale[0]/2>=8||p.at[2]+p.scale[2]/2<=-8||p.at[2]-p.scale[2]/2>=8);
  }
 }finally{disposeScenery(a);disposeScenery(b)}
});

test('scaled rooms keep the sale ring and actual trigger radius aligned',()=>{
 const room=oldMineWith({centerX:0,centerZ:0,widthCells:40,depthCells:24,heightCells:12});
 const ring=roomPlan(room).shapes.find(s=>s.interaction&&s.size[1]===.12);
 assert.equal(ring.size[0],room.sell.radius);
 assert.equal(ring.worldScale,undefined);
 assert.deepEqual([ring.at[0],ring.at[2]],[room.sell.x,room.sell.z]);
 const zone=new ZoneDetector(room.sell);
 assert.equal(zone.update([room.sell.x+room.sell.radius-.01,room.sell.y,room.sell.z],true),'enter');
});

test('configuration rejects translated facilities that occupy the fixed shaft',()=>{
 assert.throws(()=>roomPlan(oldMineWith({centerX:6,centerZ:-6,widthCells:20,depthCells:20,heightCells:10})),/占用垂直入口/);
 assert.doesNotThrow(()=>roomPlan(oldMineWith({centerX:0,centerZ:1,widthCells:20,depthCells:20,heightCells:10})));
});
