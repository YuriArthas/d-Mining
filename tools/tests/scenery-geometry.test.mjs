import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, TorusGeometry, Mesh, Group, BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute, BufferGeometry } from 'three';
import { compactSceneryGeometry } from '../../src/game/presentation/compactSceneryGeometry.ts';
import { sceneryGeometryMemory } from '../../src/game/presentation/sceneryGeometryMemory.ts';
import { createScenery, disposeScenery } from '../../src/game/presentation/SceneryMesh.ts';
import { roomPlan } from '../../src/game/world/scenery.ts';
import { ROOMS } from '../../src/game/world/rooms.ts';

test('indexing preserves triangle corner attributes, hard normals and UV seams',()=>{
 for(const source of [new BoxGeometry(),new TorusGeometry(1,.1,32,160)]){
  const flat=source.toNonIndexed();source.dispose();
  const before=flat.clone(),packed=compactSceneryGeometry(flat);
  try{
   assert.equal(packed.index.count,before.attributes.position.count);
   assert.ok(packed.attributes.position.count<before.attributes.position.count);
    for(const [name,attribute] of Object.entries(before.attributes)){
    const actual=packed.attributes[name];
    const tolerance=name==='color'?1/255+1e-6:name==='normal'?1/32767+1e-6:name==='uv'?1/65535+1e-6:1e-6;
    for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)assert.ok(Math.abs(attribute.getComponent(i,c)-actual.getComponent(packed.index.getX(i),c))<=tolerance);
   }
  }finally{packed.dispose();before.dispose()}
 }
});

test('geometry accounting deduplicates clones, interleaved arrays and index backing stores',()=>{
 const backing=new ArrayBuffer(128),data=new InterleavedBuffer(new Float32Array(backing,0,24),6),geometry=new BufferGeometry();
 geometry.setAttribute('position',new InterleavedBufferAttribute(data,3,0));
 geometry.setAttribute('normal',new InterleavedBufferAttribute(data,3,3));
 geometry.setIndex(new BufferAttribute(new Uint16Array(backing,96,6),1));
 const group=new Group(),mesh=new Mesh(geometry);group.add(mesh,mesh.clone());
 assert.deepEqual(sceneryGeometryMemory(group),{geometryBytes:128,geometries:1,instanceTriangles:4});
 geometry.dispose();mesh.material.dispose();
});

test('all nine room recipes retain triangle counts within a bounded geometry allocation',()=>{
 let bytes=0,triangles=0;
 for(const room of ROOMS){
  const plan=roomPlan(room);
  // Text signs require a browser canvas; this test measures modeled room geometry.
  const group=createScenery({...plan,signs:[]});
  try{
   const stats=sceneryGeometryMemory(group);bytes+=stats.geometryBytes;triangles+=stats.instanceTriangles;
   assert.ok(group.children.length>0);assert.ok(group.children.every(mesh=>mesh.geometry.index));
  }finally{disposeScenery(group)}
 }
 console.log('Underground geometry:',(bytes/1048576).toFixed(2),'MiB;',triangles,'triangles');
 assert.ok(bytes<40*1048576,`Room geometry unexpectedly uses ${bytes} bytes`);
 // No tessellation reduction: 129.725 MiB previously held these triangle corners.
 assert.ok(triangles<=1_030_504,`Room geometry grew to ${triangles} triangles`);
});
