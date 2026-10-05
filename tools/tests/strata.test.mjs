import { appearanceKey } from '../../src/game/terrain/minerals.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { STRATA, stratumAtDepth, generatedMineral, mineralRoll } from '../../src/game/terrain/strata.ts';
import { SparseWorld, WORLD_GENERATION, regionOf, sampleXYZ } from '../../src/game/terrain/SparseWorld.ts';
import { buildRegion, greedyMesh } from '../../src/game/terrain/meshing.ts';
import {oreChanceAtDepth} from '../../src/game/content/oreDistribution.ts';

test('layer boundaries use metres and the top face of each block', () => {
 assert.equal(stratumAtDepth(399.999).id,'surface');assert.equal(stratumAtDepth(400).id,'old_mine');
 assert.equal(stratumAtDepth(799.999).id,'old_mine');assert.equal(stratumAtDepth(800).id,'fungal');
 const allowed = [[-200,[1,8,3,4,16]],[-201,[2,1,3,4,16,17,5]],[-400,[2,1,3,4,16,17,5]],[-401,[9,2,4,17,18,25]]];
 for(const [y,ids] of allowed) for(let x=-48;x<=51;x++)for(let z=-48;z<=51;z++)assert.ok(ids.includes(generatedMineral(x,y,z,0)));
});
test('production shallow terrain excludes advanced minerals even at old sample coordinates', () => {
 const game=new SparseWorld(),fixture=new SparseWorld({...WORLD_GENERATION,samples:true});
 for(let x=-16;x<32;x++)for(let y=-16;y<0;y++)for(let z=-32;z<-16;z++)assert.ok((y===-1?[7]:[1,8,3,4,16]).includes(game.cell([x,y,z])));
 assert.equal(fixture.cell([14,-1,-25]),6);assert.notEqual(game.cell([14,-1,-25]),6);
 assert.equal(game.generation.samples,false);assert.equal(game.stats().editBytes,0);
});
test('per-cell frequencies follow layer weights and ore chance rises continuously with depth', () => {
 let previous=0;
 for(const [index,layer] of STRATA.entries()){
  const counts=new Map();let total=0,chance=0;
  for(let y=-40-index*200;y>-64-index*200;y--){
   chance+=oreChanceAtDepth(-(y+1)*2)/24;
   for(let x=-48;x<=51;x++)for(let z=-48;z<=51;z++){const kind=generatedMineral(x,y,z,0);counts.set(kind,(counts.get(kind)||0)+1);total++;}
  }
  const sum=layer.ores.reduce((n,o)=>n+o.weight,0);
  for(const o of layer.ores)assert.ok(Math.abs((counts.get(o.kind)||0)/total-chance*o.weight/sum)<.003,`${layer.id} mineral ${o.kind}`);
  const density=1-counts.get(layer.base)/total;assert.ok(Math.abs(density-chance)<.003);assert.ok(density>previous);previous=density;
 }
 assert.equal(oreChanceAtDepth(0),.025);assert.equal(oreChanceAtDepth(4000),.28);
 for(let d=1;d<=4000;d++)assert.ok(oreChanceAtDepth(d)>=oreChanceAtDepth(d-1));
});
test('individual cell rolls are deterministic and neighboring ores are not quantized into 3-cube deposits', () => {
 const rolls=new Set();for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++)rolls.add(mineralRoll(x-6,y-1401,z-9,73));
 assert.equal(rolls.size,27);
 const y=-1601,base=stratumAtDepth(-(y+1)*2).base,p=oreChanceAtDepth(-(y+1)*2);let adjacent=0;
 for(let x=-15000;x<15000;x++)if(generatedMineral(x,y,5,73)!==base&&generatedMineral(x+1,y,5,73)!==base)adjacent++;
 assert.ok(Math.abs(adjacent/30000-p*p)<.006,'neighbor probability should be independent');
 const g={...WORLD_GENERATION,seed:73},world=new SparseWorld(g);
 for(const c of [[7,-200,33],[8,-201,33],[15,-400,33],[16,-401,33]]){
  for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(world.snapshot(regionOf(c,size),size)),g),world.cell(c));
  world.remove([c]);for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(world.snapshot(regionOf(c,size),size)),g),0);
 }
 assert.ok(Array.from({length:100},(_,x)=>generatedMineral(x,-80,4,0)!==generatedMineral(x,-80,4,73)).some(Boolean));
});
test('worker render and collision use the exact same generation source across layer seams', () => {
 for(const generation of [WORLD_GENERATION,{...WORLD_GENERATION,samples:true,seed:73}]){
  const world=new SparseWorld(generation);
  for(const cell of [[0,-1,0],[0,-5,-1],[2,-200,35],[2,-201,35],[2,-400,35],[2,-401,35],[14,-1,-25]]){
   world.remove([cell]);
   for(const [kind,size] of [['render',16],['collision',8]]){
    const coord=regionOf(cell,size),snapshot=world.snapshot(coord,size);
    const actual=buildRegion(kind,coord,size,snapshot,generation).mesh;
    const expected=greedyMesh((x,y,z)=>kind==='collision'?world.cell([coord[0]*size+x,coord[1]*size+y,coord[2]*size+z]):appearanceKey(world.cell([coord[0]*size+x,coord[1]*size+y,coord[2]*size+z]),coord[1]*size+y,generation.layers),size,kind==='collision');
    assert.deepEqual(actual,expected);
   }
  }
 }
});
