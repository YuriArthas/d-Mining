import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {boundaryCoreGeometry} from '../../src/game/presentation/BoundaryCore.ts';
import {BOUNDARY_TIERS,TERRACE_SOLIDS} from '../../src/game/world/BoundaryProfile.ts';
import {BOUNDARY_PLACEMENTS} from '../../src/game/world/TimberBoundary.ts';

test('terrace core is closed at all edges and has no exposed timber filler or stair holes',()=>{
 const g=boundaryCoreGeometry(BOUNDARY_TIERS),p=g.attributes.position,edges=new Map();
 for(let i=0;i<p.count;i+=3){
  const v=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)].map(n=>n.toFixed(4)).join(','));
  for(let j=0;j<3;j++){const key=[v[j],v[(j+1)%3]].sort().join('|');edges.set(key,(edges.get(key)??0)+1);}
 }
 assert.ok([...edges.values()].every(n=>n===2));assert.ok(p.count/3<200);assert.equal(TERRACE_SOLIDS.length,16);
 assert.ok(BOUNDARY_PLACEMENTS.every(p=>p.asset!=='bank-steps'&&p.asset!=='grid-mine-timber-blender'));g.dispose();
});
test('dense downward scans across every narrow terrace hit exactly its continuous top',()=>{
 const g=boundaryCoreGeometry(BOUNDARY_TIERS),m=new Mesh(g,new MeshBasicMaterial());m.updateMatrixWorld();const ray=new Raycaster();
 for(const [level,t] of BOUNDARY_TIERS.entries()){
  for(let a=0;a<=40;a++)for(const edge of ['left','right','back','front']){
   const f=a/40,x=edge==='left'?t.inner.left-1:edge==='right'?t.inner.right+1:t.inner.left+1+(t.inner.right-t.inner.left-2)*f;
   const z=edge==='back'?t.inner.back-1:edge==='front'?t.inner.front+1:t.inner.back+1+(t.inner.front-t.inner.back-2)*f;
   ray.set(new Vector3(x,30,z),new Vector3(0,-1,0));const hit=ray.intersectObject(m,false)[0];
   assert.ok(hit,`${level} ${edge} ${a}: hole`);assert.ok(Math.abs(hit.point.y-t.top)<.001,`${level} ${edge}: ${hit.point.y}`);
  }
 }
 g.dispose();m.material.dispose();
});
