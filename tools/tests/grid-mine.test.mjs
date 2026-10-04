import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial,Matrix4,Box3,Vector3} from 'three';
import {MINE_PAVILION_PLACEMENTS as blocks,MINE_PAVILION_SOLIDS as solids,MINE_GRID,MINE_JOIN} from '../../src/game/world/MinePavilion.ts';
import {instanceMineBlocks} from '../../src/game/presentation/instanceMineBlocks.ts';
import {sceneryGeometryMemory} from '../../src/game/presentation/sceneryGeometryMemory.ts';
import {disposeScenery} from '../../src/game/presentation/disposeScenery.ts';

test('mine kit is symmetric on both axes with voxel-size pillars and a covered shaft',()=>{
 const keys=new Set(blocks.map(b=>[b.asset,b.x,b.y,b.z,b.height].join(':')));
 assert.equal(keys.size,blocks.length);
 for(const b of blocks){
  assert.equal(b.width,MINE_GRID+MINE_JOIN);assert.equal(b.depth,MINE_GRID+MINE_JOIN);assert.ok(b.x%2===0);assert.ok(b.z%2===0);
  for(const [x,z] of [[-b.x,b.z],[b.x,-b.z]])assert.ok(keys.has([b.asset,x,b.y,z,b.height].join(':')));
  if(b.y<7.9)assert.ok(Math.abs(b.x)>=9&&Math.abs(b.z)>=9);
 }
 for(let x=-7.5;x<8;x++)for(let z=-7.5;z<8;z++){
  assert.ok(blocks.some(b=>b.asset==='grid-mine-roof-blender'&&Math.abs(b.x-x)<1&&Math.abs(b.z-z)<1));
 }
 assert.ok(solids.length<blocks.length/5,'collision should describe the building shell, not each module');
});

test('mine instancing preserves model transforms and releases instance buffers',()=>{
 const group=new Group(),geometry=new BoxGeometry(),material=new MeshBasicMaterial();
 const expected=[];
 for(let i=0;i<3;i++){
  const root=new Group();root.name='grid-mine-timber@'+i;root.position.set(i*2,2,3);root.scale.set(2,1,2);
  const model=new Mesh(geometry,material);model.position.y=.5;model.rotation.y=Math.PI/2;root.add(model);group.add(root);
  root.updateMatrixWorld(true);expected.push(model.matrixWorld.clone());
 }
 const unrelated=new Group();unrelated.name='ordinary-tree';group.add(unrelated);
 const before=new Box3().setFromObject(group),memoryBefore=sceneryGeometryMemory(group);
 assert.deepEqual(instanceMineBlocks(group),{blocks:3,batches:1});
 const memoryAfter=sceneryGeometryMemory(group);assert.equal(memoryAfter.instanceTriangles,memoryBefore.instanceTriangles);assert.equal(memoryAfter.geometryBytes,memoryBefore.geometryBytes+3*16*4);assert.ok(group.children.includes(unrelated));
 const mesh=group.children.find(o=>o.isInstancedMesh),actual=new Matrix4();
 for(let i=0;i<3;i++){mesh.getMatrixAt(i,actual);assert.deepEqual(actual.elements.map(v=>Math.round(v*1e5)),expected[i].elements.map(v=>Math.round(v*1e5)));}
 assert.ok(new Box3().setFromObject(group).getSize(new Vector3()).distanceTo(before.getSize(new Vector3()))<1e-6);
 let released=false;mesh.addEventListener('dispose',()=>released=true);disposeScenery(group);assert.equal(released,true);
});

test('mine downlight illuminates the shaft and releases its shadow resources',async()=>{
 const {SceneLightingRig}=await import('../../src/game/presentation/SceneLightingRig.ts');
 const rig=new SceneLightingRig(),light=rig.key;
 assert.ok(light.isSpotLight);assert.equal(light.castShadow,true);
 assert.ok(light.position.y>8);assert.ok(light.target.position.y<0);
 assert.ok(Math.hypot(light.position.x,light.position.z)<8);
 assert.ok(light.angle>.6&&light.angle<1);assert.equal(light.shadow.mapSize.x,1024);
 assert.equal(rig.diagnostics().independentOfDecorations,true);
 assert.equal(rig.setSurfaceActive(false),true);assert.equal(rig.diagnostics().active,false);
 assert.equal(rig.fills.length,8);
 let released=0;for(const entry of [light,...rig.fills])entry.shadow.dispose=()=>released++;rig.dispose();assert.equal(released,9);
});
