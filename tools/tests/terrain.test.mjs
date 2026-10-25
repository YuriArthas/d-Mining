import assert from 'node:assert/strict';
import test from 'node:test';

import { KIND } from './fixtures/world.mjs';
import { WORLD1, WORLD1_LAYERS } from './fixtures/world.mjs';
import { greedyMesh, buildRegion } from '../../src/game/terrain/meshing.ts';
import { CELL, RENDER_SIZE as CHUNK, regionOf, SparseWorld, sampleXYZ, affectedRegions, LIMITS, mergeRemoved, contains } from '../../src/game/terrain/SparseWorld.ts';

function surfaceArea(mesh) {
 let area=0;
 for(let i=0;i<mesh.indices.length;i+=3){
  const p=Array.from({length:3},(_,j)=>Array.from(mesh.positions.slice(mesh.indices[i+j]*3,mesh.indices[i+j]*3+3)));
  const a=p[1].map((v,j)=>v-p[0][j]),b=p[2].map((v,j)=>v-p[0][j]);
  area+=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2;
 }
 return area;
}
test('greedy mesh reduces a homogeneous solid chunk to 12 correctly oriented triangles',()=>{
 const mesh=greedyMesh((x,y,z)=>[x,y,z].every(v=>v>=0&&v<16)?1:0,16);
 assert.equal(mesh.indices.length/3,12);assert.equal(surfaceArea(mesh),6*(16*CELL)**2);
 for(let i=0;i<mesh.indices.length;i+=3){
  const ids=Array.from(mesh.indices.slice(i,i+3));const points=ids.map(id=>Array.from(mesh.positions.slice(id*3,id*3+3)));
  const a=points[1].map((v,j)=>v-points[0][j]),b=points[2].map((v,j)=>v-points[0][j]);
  const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const normal=mesh.normals.slice(ids[0]*3,ids[0]*3+3);assert.ok(cross.reduce((s,v,j)=>s+v*normal[j],0)>0);
 }
});
test('material boundaries split visuals but not physical geometry',()=>{
 const get=(x,y,z)=>[x,y,z].every(v=>v>=0&&v<16)?1+(x%2):0;
 const visual=greedyMesh(get,16),physical=greedyMesh(get,16,true);
 assert.ok(visual.indices.length>physical.indices.length);assert.equal(physical.indices.length,36);assert.equal(surfaceArea(visual),surfaceArea(physical));
});
test('holes and irregular solids match an independent six-neighbor exposed-face oracle',()=>{
 const size=6,get=(x,y,z)=>[x,y,z].every(v=>v>=0&&v<size)&&((x*11+y*7+z*3)%5!==0)?1:0;
 let faces=0;
 for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(get(x,y,z)){
  for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])if(!get(x+dx,y+dy,z+dz))faces++;
 }
 assert.equal(surfaceArea(greedyMesh(get,size)),faces*CELL**2);
});
test('chunk boundaries never emit internal faces or geometry owned by neighbors',()=>{
 // Flat floor away from the authored surface excavation and the creek.
 const a=buildRegion('collision',[-2,-1,-2],CHUNK,[],WORLD1),b=buildRegion('collision',[-2,-1,-1],CHUNK,[],WORLD1);
 assert.equal(a.mesh.indices.length,6);assert.equal(b.mesh.indices.length,6);
 assert.ok(Array.from(a.mesh.positions).filter((_,i)=>i%3===1).every(v=>v===32));
 const empty=greedyMesh((x,y,z)=>x===-1?1:0,16);assert.equal(empty.indices.length,0);
});

test('20M logical cells allocate no dense region data; sparse edits survive rebuilding',()=>{
 assert.equal((LIMITS.maxX-LIMITS.minX+1)*(LIMITS.maxY-LIMITS.minY+1)*(LIMITS.maxZ-LIMITS.minZ+1),20_000_000);
 // Just under the floor of world 1's deepest rest room (air above it, rock in it).
 const floor=WORLD1_LAYERS[6].from/2,world=new SparseWorld(WORLD1),c=[0,-floor-1,0],coord=regionOf(c,16);
 assert.equal(world.stats().editedRegions,0);assert.ok(world.cell(c));world.remove([c,c]);
 assert.equal(world.removed,1);assert.equal(world.stats().editBytes,4);assert.equal(world.cell(c),0);
 const snapshot=world.snapshot(coord,16);assert.equal(sampleXYZ(...c,new Map(snapshot),WORLD1),0);
 const a=buildRegion('render',coord,16,snapshot,WORLD1),b=buildRegion('render',coord,16,world.snapshot(coord,16),WORLD1);
 assert.deepEqual(a.mesh,b.mesh);assert.equal('cells' in a,false);
 assert.equal(world.cell([0,-floor,0]),0);assert.equal(world.cell([0,-2001,0]),0);
});
test('sparse runs merge consecutive changes and full-air regions collapse to a marker',()=>{
 let runs=mergeRemoved(undefined,[7,3,5,4,7]);assert.deepEqual([...runs],[3,5,7,7]);
 runs=mergeRemoved(runs,[6]);assert.deepEqual([...runs],[3,7]);assert.ok(contains(runs,4));assert.equal(contains(runs,8),false);
 assert.equal(mergeRemoved(runs,Array.from({length:4096},(_,i)=>i)),null);
 // A whole region of rock 354-384 m down, between world 1's rest rooms at 260 and 420 m.
 const w=new SparseWorld(WORLD1),cells=[];for(let z=0;z<16;z++)for(let y=-192;y<-176;y++)for(let x=0;x<16;x++)cells.push([x,y,z]);w.remove(cells);
 assert.equal(w.stats().fullAirRegions,1);assert.equal(w.stats().editBytes,0);assert.equal(w.cell([5,-184,5]),0);
});
test('independent region boundaries invalidate only face neighbors; staged edits never mutate source',()=>{
 assert.equal(affectedRegions([3,-7,4],16).length,1);assert.equal(affectedRegions([0,-16,0],16).length,4);
 assert.equal(affectedRegions([7,-7,3],8).length,2);assert.equal(affectedRegions([7,-7,3],16).length,1);
 const w=new SparseWorld(WORLD1),c=[0,-16,0],snapshot=w.snapshot(regionOf(c,16),16,[c]);
 assert.ok(w.cell(c));assert.equal(sampleXYZ(...c,new Map(snapshot),WORLD1),0);assert.equal(w.stats().editedRegions,0);
});
test('random sparse edits agree with a Set oracle across negative coordinates and region halos',()=>{
 const w=new SparseWorld(WORLD1),removed=new Set();let seed=41;
 for(let i=0;i<500;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const c=[seed%90-45,-(seed%1900)-1,(seed>>>9)%90-45];if(w.cell(c))removed.add(c.join(','));w.remove([c]);}
 for(const key of removed){const c=key.split(',').map(Number);assert.equal(w.cell(c),0);for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(w.snapshot(regionOf(c,size),size)),WORLD1),0);}
});

test('merged UVs retain cell scale and every quad has one material on both face orientations',()=>{
 const mesh=greedyMesh((x,y,z)=>[x,y,z].every(v=>v>=0&&v<16)?6:0,16);
 for(let start=0;start<mesh.positions.length/3;start+=4){
  const axis=[0,1,2].find(a=>Math.abs(mesh.normals[start*3+a])===1),u=(axis+1)%3,v=(axis+2)%3;
  for(let k=0;k<4;k++){
   const n=start+k;assert.equal(mesh.tiles[n],5);
   assert.equal(mesh.uvs[n*2],mesh.positions[n*3+u]/CELL);
   assert.equal(mesh.uvs[n*2+1],mesh.positions[n*3+v]/CELL);
  }
  assert.equal(Math.max(...mesh.uvs.slice(start*2,(start+4)*2)),16);
 }
});
test('ore identity remains deterministic across lazy snapshots, sparse edits and independent seams',()=>{
 const w=new SparseWorld(WORLD1);const cells=[[7,-2,-25],[8,-2,-25],[15,-2,-25],[16,-2,-25],[0,-501,20]];
 for(const c of cells){
  const before=w.cell(c);assert.ok(before>=64);
  for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(w.snapshot(regionOf(c,size),size)),WORLD1),before);
  w.remove([c]);assert.equal(w.cell(c),0);
  for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(w.snapshot(regionOf(c,size),size)),WORLD1),0);
 }
 assert.equal(w.stats().editBytes,16); // The first two neighboring edits share one run.
});
test('digging a cell rebuilds exactly the exposed area in render and collision alike',()=>{
 // A buried cell under the flat floor: removing it exposes its six faces as a closed pocket.
 const w=new SparseWorld(WORLD1),region=[-2,-1,-2],cell=[-25,-3,-25];w.remove([cell]);
 const render=buildRegion('render',region,16,w.snapshot(region,16),w.generation).mesh;
 assert.equal(surfaceArea(render),(16*16+6)*CELL**2);
 const physical=buildRegion('collision',region,16,w.snapshot(region,16),w.generation).mesh;
 assert.equal(surfaceArea(render),surfaceArea(physical));
});
test('mineral tiles remain distinct within an atlas that includes the protected floor',async()=>{
 const { mineralAtlas,MINERALS,TERRAIN_MATERIALS,TILE_SIZE,ATLAS_COLUMNS,ATLAS_WIDTH,ATLAS_HEIGHT }=await import('../../src/game/terrain/minerals.ts');
 const a=mineralAtlas();assert.equal(a.byteLength,ATLAS_WIDTH*ATLAS_HEIGHT*4);assert.deepEqual(a,mineralAtlas());
 assert.ok(ATLAS_WIDTH<=2048&&ATLAS_HEIGHT<=2048,'all mineral tiles fit a compact GPU texture without rescaling');
 const fingerprints=new Set();
 for(let tile=0;tile<MINERALS.length;tile++){
  const colors=new Set();let hash=0;
  for(let y=0;y<TILE_SIZE;y++)for(let x=0;x<TILE_SIZE;x++){
   const slot=TERRAIN_MATERIALS.findIndex(r=>r.id===MINERALS[tile].id);
   const p=((Math.floor(slot/ATLAS_COLUMNS)*TILE_SIZE+y)*ATLAS_WIDTH+(slot%ATLAS_COLUMNS)*TILE_SIZE+x)*4;assert.equal(a[p+3],255);
   colors.add(a.slice(p,p+3).join(','));hash=(Math.imul(hash,31)+a[p]*65536+a[p+1]*256+a[p+2])>>>0;
  }
  const {resourceByKind}=await import('../../src/game/content/resources.ts');
  if(resourceByKind(MINERALS[tile].id).base)assert.equal(colors.size,1,'host rock has no repeated cell texture');else assert.ok(colors.size>=5);fingerprints.add(hash);
 }
 assert.equal(fingerprints.size,MINERALS.length);
});

test('mineral response atlas separates metal inclusions from matte host and keeps floors flat',async()=>{
 const { mineralResponseAtlas,TERRAIN_MATERIALS,TILE_SIZE,ATLAS_COLUMNS,ATLAS_WIDTH,ATLAS_HEIGHT }=await import('../../src/game/terrain/minerals.ts');
 const data=mineralResponseAtlas();assert.equal(data.length,ATLAS_WIDTH*ATLAS_HEIGHT*4);assert.deepEqual(data,mineralResponseAtlas());
 const tilePixels=id=>{
  const tile=TERRAIN_MATERIALS.findIndex(m=>m.id===id),pixels=[];
  for(let y=0;y<TILE_SIZE;y++)for(let x=0;x<TILE_SIZE;x++){const i=((Math.floor(tile/ATLAS_COLUMNS)*TILE_SIZE+y)*ATLAS_WIDTH+(tile%ATLAS_COLUMNS)*TILE_SIZE+x)*4;pixels.push([...data.slice(i,i+4)])}
  return pixels;
 };
 const gold=tilePixels(KIND.copper),floor=tilePixels(7),soil=tilePixels(KIND.rock);
 assert.ok(gold.some(p=>p[2]>100&&p[1]<120));assert.ok(gold.some(p=>p[2]===0&&p[1]>200));
 assert.ok(soil.every(p=>p[2]===0));assert.equal(new Set(floor.map(p=>p.join(','))).size,1);
 assert.ok(floor.every(p=>p[1]>200&&p[2]===0&&p[3]===255));
});
