import { appearanceKey } from '../../src/game/terrain/minerals.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { STRATA, stratumAtDepth, generatedMineral } from '../../src/game/terrain/strata.ts';
import { SparseWorld, WORLD_GENERATION, regionOf, sampleXYZ } from '../../src/game/terrain/SparseWorld.ts';
import { buildRegion, greedyMesh } from '../../src/game/terrain/meshing.ts';
import { oreDefinition } from '../../src/game/application/items.ts';

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
test('large samples match configured frequencies and higher layers increase value per capacity', () => {
 let lastValue=0,lastHp=0;
 for(const [index,layer] of STRATA.entries()){
  const counts=new Map();let total=0,coins=0,volume=0,hp=0;
  for(let y=-40-index*200;y>-64-index*200;y--)for(let x=-48;x<=51;x++)for(let z=-48;z<=51;z++){
   const id=generatedMineral(x,y,z,0),item=oreDefinition(id);counts.set(id,(counts.get(id)||0)+1);total++;coins+=item.price;volume+=item.volume;hp+=item.maxHp;
  }
  const weights=[...layer.ores,{kind:layer.base,weight:100-layer.ores.reduce((n,o)=>n+o.weight,0)}];
  for(const {kind,weight} of weights)assert.ok(Math.abs((counts.get(kind)||0)/total-weight/100)<.015,`${layer.id} mineral ${kind}`);
  assert.equal(counts.size,weights.length);assert.ok(coins/volume>lastValue);assert.ok(hp/total>lastHp);lastValue=coins/volume;lastHp=hp/total;
 }
});
test('coherent deposits survive negative coordinates, seeds, and sparse region boundaries', () => {
 const g={...WORLD_GENERATION,seed:73},world=new SparseWorld(g);
 for(const y of [-40,-240,-440]){
  // Each complete deposit has a single kind, including deposits at negative x/z.
  const base=[-6,Math.floor(y/3)*3,-9],kind=generatedMineral(...base,g.seed);
  for(let x=0;x<3;x++)for(let a=0;a<3;a++)for(let z=0;z<3;z++)assert.equal(generatedMineral(base[0]+x,base[1]+a,base[2]+z,g.seed),kind);
 }
 for(const c of [[7,-200,33],[8,-201,33],[15,-400,33],[16,-401,33]]){
  for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(world.snapshot(regionOf(c,size),size)),g),world.cell(c));
  world.remove([c]);for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(world.snapshot(regionOf(c,size),size)),g),0);
 }
 const different=Array.from({length:100},(_,x)=>generatedMineral(x,-80,4,0)!==generatedMineral(x,-80,4,73));assert.ok(different.some(Boolean));
});
test('worker render and collision use the exact same generation source across layer seams', () => {
 for(const generation of [WORLD_GENERATION,{...WORLD_GENERATION,samples:true,seed:73}]){
  const world=new SparseWorld(generation);
  for(const cell of [[2,-200,35],[2,-201,35],[2,-400,35],[2,-401,35],[14,-1,-25]]){
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
