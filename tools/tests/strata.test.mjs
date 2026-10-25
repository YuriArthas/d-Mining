import { appearanceKey } from '../../src/game/terrain/minerals.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { stratumAtDepth, generatedMineral, mineralRoll } from '../../src/game/terrain/strata.ts';
import { SparseWorld, regionOf, sampleXYZ } from '../../src/game/terrain/SparseWorld.ts';
import { buildRegion, greedyMesh } from '../../src/game/terrain/meshing.ts';
import { WORLD1_LAYERS as LAYERS } from './fixtures/world.mjs';
import { WORLD1 } from './fixtures/world.mjs';

const at = depth => stratumAtDepth(depth, LAYERS);
test('layer boundaries use metres and the top face of each block', () => {
 const [surface,oldMine,fungal]=LAYERS,kinds=l=>[l.base,...l.ores.map(o=>o.kind)];
 assert.equal(at(oldMine.from-.001).id,'surface');assert.equal(at(oldMine.from).id,'old_mine');
 assert.equal(at(fungal.from-.001).id,'old_mine');assert.equal(at(fungal.from).id,'fungal');
 const allowed = [[-oldMine.from/2,[surface.deepKind]],[-oldMine.from/2-1,kinds(oldMine)],[-fungal.from/2,[oldMine.deepKind]],[-fungal.from/2-1,kinds(fungal)]];
 for(const [y,ids] of allowed) for(let x=-48;x<=51;x++)for(let z=-48;z<=51;z++)assert.ok(ids.includes(generatedMineral(x,y,z,0,LAYERS)));
});
test('shallow terrain holds only the surface layer\'s rock and ores under the protected floor', () => {
 const game=new SparseWorld(WORLD1),surface=LAYERS[0],allowed=[surface.base,...surface.ores.map(o=>o.kind)];
 for(let x=-16;x<32;x++)for(let y=-16;y<0;y++)for(let z=-32;z<-16;z++)assert.ok((y===-1?[7]:allowed).includes(game.cell([x,y,z])));
 assert.equal(game.stats().editBytes,0);
});
test('per-cell frequencies follow layer weights and each layer\'s ore chance, which rises layer by layer', () => {
 let previous=0;
 for(const layer of LAYERS){
  const counts=new Map();let total=0,chance=layer.oreChance;
  // The top 24 m of the layer, above its dense rock.
  for(let y=-layer.from/2-1;y>-layer.from/2-13;y--){
   for(let x=-48;x<=51;x++)for(let z=-48;z<=51;z++){const kind=generatedMineral(x,y,z,0,LAYERS);counts.set(kind,(counts.get(kind)||0)+1);total++;}
  }
  const sum=layer.ores.reduce((n,o)=>n+o.weight,0);
  for(const o of layer.ores)assert.ok(Math.abs((counts.get(o.kind)||0)/total-chance*o.weight/sum)<.003,`${layer.id} mineral ${o.kind}`);
  const density=1-counts.get(layer.base)/total;assert.ok(Math.abs(density-chance)<.003);assert.ok(density>previous);previous=density;
 }
});
test('individual cell rolls are deterministic and neighboring ores are not quantized into 3-cube deposits', () => {
 const rolls=new Set();for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++)rolls.add(mineralRoll(x-6,y-1401,z-9,73));
 assert.equal(rolls.size,27);
 // Deep in the last layer (2420 m).
 const y=-1211,base=at(-(y+1)*2).base,p=at(-(y+1)*2).oreChance;let adjacent=0;
 for(let x=-15000;x<15000;x++)if(generatedMineral(x,y,5,73,LAYERS)!==base&&generatedMineral(x+1,y,5,73,LAYERS)!==base)adjacent++;
 assert.ok(Math.abs(adjacent/30000-p*p)<.006,'neighbor probability should be independent');
 const g={...WORLD1,seed:73},world=new SparseWorld(g);
 for(const c of [[7,-200,33],[8,-201,33],[15,-400,33],[16,-401,33]]){
  for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(world.snapshot(regionOf(c,size),size)),g),world.cell(c));
  world.remove([c]);for(const size of [8,16])assert.equal(sampleXYZ(...c,new Map(world.snapshot(regionOf(c,size),size)),g),0);
 }
 assert.ok(Array.from({length:100},(_,x)=>generatedMineral(x,-80,4,0,LAYERS)!==generatedMineral(x,-80,4,73,LAYERS)).some(Boolean));
});
test('worker render and collision use the exact same generation source across layer seams', () => {
 // The creek's surface cut leaves cells out of the meshes on purpose (creek.test.mjs); compare without it.
 const uncut={...WORLD1,surfaceCut:undefined};
 for(const generation of [uncut,{...uncut,seed:73}]){
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

test('theme blocks occur only in their owning layer, including every seam and moved depths', async () => {
 const { resourceByKind } = await import('../../src/game/content/resources.ts');
 const { validateLayers } = await import('../../src/game/content/layers.ts');
 assert.deepEqual(LAYERS.map(l=>l.base), [64,68,72,76,80,84,88]);
 for(const layers of [LAYERS, LAYERS.map(l=>l.id==='fungal'?{...l,from:l.from+40}:l)]) {
  validateLayers(layers);
  const world = new SparseWorld({...WORLD1,layers});
  for(let i=0;i<layers.length;i++) {
   const layer=layers[i], end=layers[i+1]?.from??layer.from+400, counts=new Map();
   // Away from room footprints: inspect both boundary-adjacent block slices and the interior.
   for(const depth of [layer.from, layer.from+Math.floor((end-layer.from)/4)*2, end-2]) {
    const y=-depth/2-1;
    for(let x=20;x<40;x++)for(let z=20;z<40;z++) {
     const kind=world.cell([x,y,z]);
     if(kind===7)continue; // Protected hub floor is not a collectible theme block.
     counts.set(kind,(counts.get(kind)||0)+1);
     if(resourceByKind(kind).base) assert.equal(kind,layer.deepAt!=null&&depth-layer.from>=layer.deepAt?layer.deepKind:layer.base,`${layer.id} contains foreign base ${kind}`);
    }
   }
   assert.ok(counts.get(layer.base)>0);
  }
 }
});
