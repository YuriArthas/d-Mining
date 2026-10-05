import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,Vector3} from 'three';
import {instanceStaticProps} from '../../src/game/presentation/instanceStaticProps.ts';

test('batching preserves world transforms, shared assets and spatial culling boundaries',()=>{
 const root=new Group();root.position.set(4,0,2);root.rotation.y=.3;
 const geometry=new BoxGeometry(),material=new MeshStandardMaterial(),original=[];
 for(const x of [1,3,40]){
  const prop=new Group();prop.position.set(x,0,1);prop.rotation.y=.6;prop.scale.set(2,3,1);
  const mesh=new Mesh(geometry,material);mesh.position.set(.1,2,.1);mesh.castShadow=true;prop.add(mesh);root.add(prop);
  root.updateMatrixWorld(true);original.push(mesh.matrixWorld.clone());
 }
 const stats=instanceStaticProps(root);assert.equal(stats.batchedMeshes,2);assert.equal(stats.batches,1);assert.equal(stats.savedCalls,1);
 const batch=root.children.find(o=>o instanceof InstancedMesh);root.updateMatrixWorld(true);
 assert.equal(batch.geometry,geometry);assert.equal(batch.material,material);assert.equal(batch.castShadow,true);
 for(let i=0;i<2;i++){const actual=new Matrix4();batch.getMatrixAt(i,actual);actual.premultiply(batch.matrixWorld);assert.ok(actual.elements.every((n,j)=>Math.abs(n-original[i].elements[j])<1e-5));}
 const bound=batch.boundingBox;assert.ok(bound.max.x<20,'distant prop remains outside this batch');
 assert.equal(stats.instanceBytes,128);batch.dispose();geometry.dispose();material.dispose();
});
test('mutable portals, custom ground, draw hooks, transparency and negative transforms stay separate',()=>{
 const root=new Group(),geometry=new BoxGeometry(),material=new MeshStandardMaterial();
 for(const kind of ['portal','ground','hook','transparent','negative'])for(let i=0;i<2;i++){
  const prop=new Group(),mesh=new Mesh(geometry,kind==='transparent'?new MeshStandardMaterial({transparent:true}):material);
  if(kind==='portal')prop.userData.portalId='one';if(kind==='ground')mesh.userData.surfaceGround=true;
  if(kind==='hook')mesh.onBeforeRender=()=>{};if(kind==='negative')mesh.scale.x=-1;
  prop.add(mesh);root.add(prop);
 }
 assert.equal(instanceStaticProps(root).batches,0);assert.equal(root.children.length,10);
});
