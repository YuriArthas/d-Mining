import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three/webgpu';
import {createShadowCasters} from '../src/shadowCasters.ts';

test('spatial casters retain every transformed triangle and winding, including cell-crossing geometry',()=>{
 const root=new THREE.Group();root.position.set(3,2,-9);root.rotation.y=.21;
 const material=new THREE.MeshBasicMaterial();
 const a=new THREE.Mesh(new THREE.BoxGeometry(19,2,31),material);a.castShadow=true;root.add(a);
 const b=new THREE.Mesh(new THREE.SphereGeometry(1,6,4).toNonIndexed(),material);b.position.set(-8,2,10);b.castShadow=true;root.add(b);
 const excluded=new THREE.Mesh(new THREE.BoxGeometry(),material);excluded.castShadow=false;root.add(excluded);
 const original=[];root.updateMatrixWorld(true);
 for(const mesh of [a,b]){
  const g=mesh.geometry,p=g.getAttribute('position'),v=new THREE.Vector3();
  for(let i=0;i<(g.index?.count??p.count);i+=3){const row=[];for(let j=0;j<3;j++)row.push(...v.fromBufferAttribute(p,g.index?g.index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld).toArray().map(Math.fround));original.push(JSON.stringify(row));}
 }
 const casters=createShadowCasters(root,6),actual=[];let shared;
 for(const mesh of casters.scene.children){
  const g=mesh.geometry,p=g.getAttribute('position'),v=new THREE.Vector3();
  if(shared)assert.equal(p,shared);shared=p;
  assert.deepEqual(Object.keys(g.attributes),['position']);
  for(let i=0;i<g.index.count;i+=3){const row=[];for(let j=0;j<3;j++){v.fromBufferAttribute(p,g.index.getX(i+j));row.push(...v.toArray());assert.ok(g.boundingBox.containsPoint(v));assert.ok(g.boundingSphere.containsPoint(v));}actual.push(JSON.stringify(row));}
 }
 assert.deepEqual(actual.sort(),original.sort());assert.equal(casters.stats.triangles,original.length);assert.equal(casters.stats.sourceMeshes,2);assert.ok(casters.stats.cells>1);
 assert.equal(casters.stats.additionalBytes,shared.array.byteLength+casters.scene.children.reduce((n,m)=>n+m.geometry.index.array.byteLength,0));
 casters.dispose();root.children.forEach(m=>m.geometry.dispose());material.dispose();
});
test('unsupported changing or alpha geometry is rejected rather than silently losing silhouettes',()=>{
 const m=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({transparent:true}));m.castShadow=true;
 assert.throws(()=>createShadowCasters(m),/opaque static/);assert.throws(()=>createShadowCasters(m,0),/cell size/);
 m.geometry.dispose();m.material.dispose();
});
