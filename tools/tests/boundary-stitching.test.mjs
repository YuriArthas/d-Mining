import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,PlaneGeometry,Group,Mesh,MeshBasicMaterial,Plane,Vector3,Raycaster} from 'three';
import {clipBoundaryGeometry,BoundaryStitcher} from '../../src/game/presentation/BoundaryStitcher.ts';
import {BOUNDARY_PLACEMENTS} from '../../src/game/world/TimberBoundary.ts';

test('clipping interpolates source UVs and retains the exposed surface without overlap',()=>{
 const source=new PlaneGeometry(8.6,3.6),material=new MeshBasicMaterial();
 const left=clipBoundaryGeometry(source,[new Plane(new Vector3(-1,0,0),4)]);
 const right=clipBoundaryGeometry(source,[new Plane(new Vector3(1,0,0),4)]);
 const a=new Mesh(left,material),b=new Mesh(right,material);b.position.x=8;a.updateMatrixWorld();b.updateMatrixWorld();
 for(const x of [3.8,3.99,4.01,4.2]){
  const ray=new Raycaster(new Vector3(x,0,2),new Vector3(0,0,-1));
  const hits=ray.intersectObjects([a,b],false);assert.equal(hits.length,1,`duplicate or missing face at ${x}`);
 }
 for(const g of [left,right]){
  const pos=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<pos.count;i++)assert.ok(Math.abs(uv.getX(i)-(pos.getX(i)/8.6+.5))<.00003);
  assert.equal(g.getAttribute('normal').normalized,true);
 }
 source.dispose();left.dispose();right.dispose();material.dispose();
});

test('transformed modules share cached cuts; original geometry is unchanged',()=>{
 const source=new BoxGeometry(8.6,3.6,8.6),original=Array.from(source.attributes.position.array),mat=new MeshBasicMaterial(),cut=new BoundaryStitcher(),groups=[];
 for(const x of [100,108]){
  const group=new Group();group.position.set(x,3,0);group.rotation.y=Math.PI/2;group.add(new Mesh(source,mat));
  cut.apply(group,{asset:'bank-turf',x,z:0,width:8.6,boundaryClip:{minX:x-4,maxX:x+4}});groups.push(group);
 }
 assert.equal(cut.stats.variants,1);assert.ok(cut.stats.maxOutsideError<.00001);assert.equal(groups[0].children[0].geometry,groups[1].children[0].geometry);
 assert.deepEqual(Array.from(source.attributes.position.array),original);
 groups[0].children[0].geometry.dispose();source.dispose();mat.dispose();
});

test('all neighboring boundary modules including corner turns meet at the same plane',()=>{
 const blocks=BOUNDARY_PLACEMENTS.filter(p=>p.asset.startsWith('bank-')&&p.boundaryClip);let joins=0;
 for(const a of blocks)for(const b of blocks){
  if(a.y!==b.y)continue;
  if(a.z===b.z&&b.x-a.x===8){assert.equal(a.boundaryClip.maxX,b.boundaryClip.minX);assert.equal(a.boundaryClip.maxX,a.x+4);joins++;}
  if(a.x===b.x&&b.z-a.z===8){assert.equal(a.boundaryClip.maxZ,b.boundaryClip.minZ);assert.equal(a.boundaryClip.maxZ,a.z+4);joins++;}
 }
 assert.ok(joins>200);
 for(const p of BOUNDARY_PLACEMENTS.filter(p=>p.asset==='grid-mine-timber-blender'))assert.ok(p.boundaryClip);
});
