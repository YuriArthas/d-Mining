import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {LAYERS} from '../../src/game/content/layers.ts';
import {ROOM_SCENES} from '../../src/game/content/rooms/sceneDefinitions.ts';
import {roomSceneAsset} from '../../src/game/content/rooms/sceneAssets.ts';
import {roomsFor,ROOMS} from '../../src/game/world/rooms.ts';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {authoredRoomPlan} from '../../src/game/world/authoredRoomPlan.ts';
import {createScenery,disposeScenery} from '../../src/game/presentation/SceneryMesh.ts';
import {roomIllumination} from '../../src/game/presentation/roomIllumination.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';
import {sessionContentFor} from '../../src/game/world/sessionContent.ts';
import {CAMP_CONTENT} from '../../src/game/content/campContent.ts';

const scene=()=>structuredClone(ROOM_SCENES['timber-station-v2']);
const customRoom=(definition,layers=LAYERS)=>roomsFor(layers,{...ROOM_SCENES,'timber-station-v2':definition})[0];
function compileMaterial(view){
 const material=view.children.find(m=>m.isInstancedMesh&&m.material.isMeshStandardMaterial).material;
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <map_fragment>\n#include <opaque_fragment>'};
 material.onBeforeCompile(shader);return {material,shader};
}
test('moving the sale anchor moves its models, independent colliders, light markers, label and actual sale zone together',()=>{
 const before=roomPlan(ROOMS[0]),definition=scene();definition.facilities.sell.at[2]+=2;
 const room=customRoom(definition),after=roomPlan(room);
 const cabinet=p=>p.authored.instances.find(i=>i.name==='counter-cabinet');
 assert.equal(cabinet(after).at[2]-cabinet(before).at[2],2);
 const solid=p=>p.solids.find(s=>Math.abs(s.half[0]-3.15)<1e-5);
 assert.equal(solid(after).at[2]-solid(before).at[2],2);
 assert.equal(after.signs[1].at[2]-before.signs[1].at[2],2);
 assert.equal(after.shapes[0].at[2],room.sell.z);
 assert.equal(after.shapes[0].size[0],before.shapes[0].size[0]);
 const movedLamps=after.authored.lamps.map((l,i)=>l.map((v,j)=>v-before.authored.lamps[i][j])).filter(delta=>delta.some(v=>v!==0));
 assert.equal(movedLamps.length,roomSceneAsset('old-mine-v2').layout.groups.find(g=>g.id==='sale').lamps.length);
 for(const delta of movedLamps)assert.deepEqual(delta,[0,0,2]);
 assert.deepEqual(after.authored.instances.filter(i=>i.name==='shaft-fence-post'),before.authored.instances.filter(i=>i.name==='shaft-fence-post'));
 const raw=CAMP_CONTENT.session;
 const content=sessionContentFor([room],raw.portals.filter(p=>p.id===room.id),{sale:raw.sales[0],shop:raw.shops[0].zone,home:raw.home});
 const session=new GameSession(content);session.updatePosition([room.sell.x,room.sell.y,room.sell.z],true);
 assert.equal(session.getSnapshot().inSellZone,true);
 session.updatePosition([ROOMS[0].sell.x,ROOMS[0].sell.y,ROOMS[0].sell.z],true);
 assert.equal(session.getSnapshot().inSellZone,false);
});
test('another layer can bind the authored kit, custom spawn and shop without hardcoded layer numbers or positions',()=>{
 const definition=scene();definition.facilities.spawn.at=[2,0,12];
 definition.facilities.shop={...definition.facilities.sell,at:[13,0,13]};
 definition.signs.push({...definition.signs[1],anchor:'shop',title:'UPGRADE'});
 definition.rings.push({...definition.rings[0],anchor:'shop'});
 const layers=LAYERS.map(l=>l.id==='old_mine'?{...l,scene:undefined}:l.id==='fungal'?{...l,scene:'timber-station-v2'}:l);
 const room=roomsFor(layers,{...ROOM_SCENES,'timber-station-v2':definition})[1],plan=roomPlan(room);
 assert.deepEqual(room.spawn,[2,-799.9,12]);assert.equal(plan.signs[0].subtitle,'03 / 800 M');
 assert.equal(plan.signs.at(-1).title,'UPGRADE');assert.equal(plan.shapes.at(-1).at[0],13);
 assert.equal(room.shop.radius,1.7);
});
test('scene-specific light and atlas uniforms stay independent while sharing one shader program',()=>{
 const a=roomPlan(ROOMS[0]),definition=scene();
 definition.render.lighting.color=[.05,.3,.9];definition.render.lighting.lampStrength=.2;
 definition.render.lighting.resolution=32;definition.render.atlas={columns:4,rows:1,gutter:2,repeat:.7};
 const b=roomPlan(customRoom(definition));
 const av=createScenery({...a,signs:[]}),bv=createScenery({...b,signs:[]});
 try{
  const x=compileMaterial(av),y=compileMaterial(bv);
  assert.deepEqual(x.shader.uniforms.roomLampColor.value.toArray(),[.68,.4,.18]);
  assert.deepEqual(y.shader.uniforms.roomLampColor.value.toArray(),[.05,.3,.9]);
  assert.equal(y.shader.uniforms.roomRepeat.value,.7);
  assert.deepEqual(y.shader.uniforms.roomTileSize.value.toArray(),[12/64,60/64]);
  assert.equal(y.shader.uniforms.roomIllumination.value.image.width,32);
  assert.equal(x.material.customProgramCacheKey(),y.material.customProgramCacheKey());
  assert.equal(x.shader.fragmentShader,y.shader.fragmentShader);
  let released=0;const resources=new Set();
  bv.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);if(o.material.map)resources.add(o.material.map);}});
  resources.add(y.shader.uniforms.roomIllumination.value);
  for(const resource of resources)resource.addEventListener('dispose',()=>released++);
  disposeScenery(bv);assert.equal(released,resources.size);
 }finally{disposeScenery(av);}
});
test('bad scene references, missing facility anchors and incompatible atlas layouts fail explicitly',()=>{
 assert.throws(()=>roomsFor(LAYERS.map(l=>l.id==='old_mine'?{...l,scene:'missing'}:l)),/未知房间场景/);
 assert.throws(()=>roomsFor(LAYERS.map(l=>l.id==='old_mine'?{...l,shop:true}:l)),/缺少商店位置/);
 const badSpawn=scene();badSpawn.facilities.spawn.at=[0,0,0];
 assert.throws(()=>customRoom(badSpawn),/占用垂直入口/);
 badSpawn.facilities.spawn.at=[50,0,0];assert.throws(()=>customRoom(badSpawn),/功能点越界/);
 const definition=scene();definition.render.atlas.columns=3;
 assert.throws(()=>roomPlan(customRoom(definition)),/图集尺寸/);
 definition.render.atlas.columns=2;definition.signs[0].anchor='shop';
 assert.throws(()=>customRoom(definition),/无效房间场景/);
 const asset=structuredClone(roomSceneAsset('old-mine-v2'));asset.layout.groups[0].instances[0].mesh='missing';
 assert.throws(()=>authoredRoomPlan(ROOMS[0],asset),/无效场景实例/);
});
test('light descriptors can be disabled without deleting decorative lamp geometry',()=>{
 const asset=structuredClone(roomSceneAsset('old-mine-v2'));
 asset.layout.groups.forEach(g=>g.lamps=[]);
 const before=roomPlan(ROOMS[0]),after=authoredRoomPlan(ROOMS[0],asset);
 assert.deepEqual(after.authored.instances,before.authored.instances);
 const bytes=roomIllumination(after.authored).bytes;
 assert.ok(bytes.every((v,i)=>i%4!==0||v===0));
});
test('terrain room metadata does not import authored geometry or layout payloads',()=>{
 const visited=new Set();
 function visit(file){
  if(visited.has(file))return;visited.add(file);
  assert.ok(!/assets\/rooms\/|\.layout\.json$|sceneAssets\.ts$/.test(file),file);
  if(!file.endsWith('.ts'))return;
  const source=readFileSync(file,'utf8');
  // Follow runtime local imports, excluding type-only dependencies.
  for(const match of source.matchAll(/import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/g)){
   if(match[1].startsWith('.'))visit(resolve(dirname(file),match[1]));
  }
 }
 visit(resolve('src/game/world/rooms.ts'));
});
