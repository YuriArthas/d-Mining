import assert from 'node:assert/strict';
import test from 'node:test';
import { raycastCells } from '../../src/game/terrain/raycast.ts';
import { selectCell, SELECTION } from '../../src/game/terrain/selection.ts';
import { SparseWorld, CELL, WORLD_GENERATION } from '../../src/game/terrain/SparseWorld.ts';
import { pointerNdc } from '../../src/game/aim.ts';
const source = (...cells) => c => cells.some(v => v.every((n, i) => n === c[i])) ? 1 : 0;

test('all six faces choose entered cell, including negative coordinates', () => {
  const cell = [-1, -1, -1], center = [-1, -1, -1];
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const origin = [...center], direction = [0,0,0]; origin[axis] += sign * 5; direction[axis] = -sign;
    const hit = raycastCells(origin, direction, 8, source(cell));
    assert.deepEqual(hit.cell, cell); assert.equal(hit.distance, 4);
  }
});
test('exact edges and corners advance tied axes without selecting merely touched cells', () => {
  const sample = source([1,0,0], [0,1,0], [1,1,1]);
  assert.deepEqual(raycastCells([1,1,1], [1,1,1], 8, sample).cell, [1,1,1]);
  assert.deepEqual(raycastCells([2,2,2], [-1,-1,-1], 8, source([0,0,0])).cell, [0,0,0]);
  assert.deepEqual(raycastCells([2,2,2], [1,1,1], 8, source([1,1,1])).cell, [1,1,1]);
});
test('near either side of a grid edge selects the actual side without snapping', () => {
  const sample = c => c[1] === -1 ? 1 : 0;
  for (const x of [-32, -16, 0, 16, 32]) for (const delta of [-1e-7, 1e-7]) {
    assert.deepEqual(raycastCells([x+delta,3,1], [0,-1,0], 6, sample).cell, [Math.floor((x+delta)/2),-1,0]);
  }
});
test('query follows sparse edits across both region grids and observes maximum range', () => {
  const world = new SparseWorld({...WORLD_GENERATION,samples:true}), sample = c => world.cell(c);
  for (const x of [7,8,15,16,-16]) {
    assert.deepEqual(raycastCells([2*x+1,3,-19], [0,-1,0], 8, sample).cell, [x,-1,-10]);
    world.remove([[x,-1,-10]]);
    assert.deepEqual(raycastCells([2*x+1,3,-19], [0,-1,0], 8, sample).cell, [x,-2,-10]);
    assert.equal(raycastCells([2*x+1,3,-19], [0,-1,0], 4, sample), null);
  }
});
test('invalid and empty rays terminate with bounded logical queries', () => {
  let queries = 0; const sample = () => { queries++; return 0; };
  assert.equal(raycastCells([0,0,0], [0,0,0], 18, sample), null);
  assert.equal(raycastCells([0,0,0], [1,1,1], 18, sample), null);
  assert.ok(queries <= 17);
});
test('selection checks hand distance and ignores intervening voxels on the hand path', () => {
  const origin = [1,5,1], direction = [0,-1,0], target = [0,-1,0];
  assert.deepEqual(selectCell(origin,direction,[1,1,1],source(target)),target);
  assert.equal(selectCell(origin,direction,[9,1,1],source(target)),null);
  assert.deepEqual(selectCell(origin,direction,[5,1,1],source(target,[1,0,0])),target);
});
test('screen coordinates invert landscape CSS rotation with offset bounding rect', () => {
  const rect = { left: 20, top: 30, width: 800, height: 400 };
  assert.deepEqual(pointerNdc(220,330,rect,false),{x:-.5,y:-.5});
  assert.deepEqual(pointerNdc(220,330,rect,true),{x:.5,y:-.5});
  assert.deepEqual(pointerNdc(420,230,rect,true),{x:0,y:0});
});
test('logical traversal agrees with an independent ray/AABB oracle on random sparse solids', () => {
  let seed = 12345;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2**32);
  const cells = [];
  for (let x=-4;x<=4;x++) for (let y=-4;y<=4;y++) for (let z=-4;z<=4;z++) if (random()<.2) cells.push([x,y,z]);
  const sample = source(...cells);
  for (let n=0;n<500;n++) {
    const origin = [random()*30-15,random()*30-15,random()*30-15];
    const direction = [random()-.5,random()-.5,random()-.5], length = Math.hypot(...direction);
    const d = direction.map(v=>v/length);
    let expected = null, best = Infinity;
    for (const c of cells) {
      let enter=0,exit=18;
      for (let a=0;a<3;a++) {
        const t1=(c[a]*2-origin[a])/d[a],t2=((c[a]+1)*2-origin[a])/d[a];
        enter=Math.max(enter,Math.min(t1,t2)); exit=Math.min(exit,Math.max(t1,t2));
      }
      if (enter<=exit && enter<best) { expected=c; best=enter; }
    }
    const actual=raycastCells(origin,d,18,sample);
    assert.deepEqual(actual?.cell??null,expected);
    if (actual) assert.ok(Math.abs(actual.distance-best)<1e-9);
  }
});
test('pointer picks the front cell even when the hand is behind another voxel', () => {
  assert.deepEqual(selectCell([4,1,1],[-1,0,0],[-1,1,1],source([0,0,0])),[0,0,0]);
  assert.deepEqual(selectCell([4,1,1],[-1,0,0],[-1,1,1],source([0,0,0],[-1,0,0])),[0,0,0]);
});

test('reach is four cells from the hand to the struck surface, including exact limit', () => {
  assert.equal(SELECTION.reach, 4 * CELL);
  const target = [0,-1,0], origin = [1,12,1], direction = [0,-1,0];
  for (const distance of [5.5,7.9,8]) assert.deepEqual(selectCell(origin,direction,[1,distance,1],source(target)),target);
  assert.equal(selectCell(origin,direction,[1,8.001,1],source(target)),null);
  assert.equal(selectCell(origin,direction,[1,8,1],source(target,[0,2,0]))?.join(','),'0,2,0');
});

test('a ray starting inside a solid still uses only hand distance', () => {
  assert.deepEqual(selectCell([1,1,1],[1,0,0],[1,2,1],source([0,0,0])),[0,0,0]);
});
