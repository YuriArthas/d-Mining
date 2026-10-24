import test from 'node:test';
import assert from 'node:assert/strict';
import { CatmullRomCurve3, Vector3 } from 'three';
import { GAME_CONTENT, GAME_GENERATION } from '../../src/game/content/gameContent.ts';
import { creekFloorCells } from '../../src/game/content/pinewindSurface.ts';
import { PINEWIND_CREEK, PINEWIND_PLAZA, PINEWIND_SPAWN, PINEWIND_BRIDGE } from '../../src/game/content/pinewind/hubLayout.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';
import { COLLISION_SIZE, CELL, sampleXYZ } from '../../src/game/terrain/SparseWorld.ts';
import { PROTECTED_FLOOR } from '../../src/game/world/entrance.ts';
import { initPhysics, CharacterPhysics, RAPIER } from '../../src/game/validation/physics.ts';
import { SceneryCollision } from '../../src/game/presentation/SceneryCollision.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { footSurface } from '../../src/game/runtime/footSurface.ts';

const cells = new Set();
for (let i = 0; i < GAME_GENERATION.surfaceCut.length; i += 2) cells.add(GAME_GENERATION.surfaceCut[i] + ',' + GAME_GENERATION.surfaceCut[i + 1]);
const cellAt = (x, z) => Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
const line = new CatmullRomCurve3(PINEWIND_CREEK.points.map(([x, z]) => new Vector3(x, 0, z))).getPoints(220);

test('the voxel floor is cut under the whole sunken creek and nowhere near the plaza, spawn or mine; the generation version is kept for saves', () => {
  assert.deepEqual(creekFloorCells(), [...GAME_GENERATION.surfaceCut]);
  assert.equal(GAME_GENERATION.version, 11, 'saves keep loading');
  const reach = PINEWIND_CREEK.width.base - PINEWIND_CREEK.width.wave + PINEWIND_CREEK.bank;
  // Every point of the corridor (centre line out to the bank tops) inside the authored ground lies in a cut cell.
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], tx = b.x - a.x, tz = b.z - a.z, length = Math.hypot(tx, tz) || 1;
    for (const offset of [-reach, -reach / 2, 0, reach / 2, reach]) {
      const x = a.x - tz / length * offset, z = a.z + tx / length * offset;
      if (x < -95 || x > 103 || z < -95 || z > 103) continue;
      assert.ok(cells.has(cellAt(x, z)), `corridor point ${x.toFixed(1)},${z.toFixed(1)} not cut`);
    }
  }
  for (const [x, z, what] of [[PINEWIND_PLAZA.x, PINEWIND_PLAZA.z, 'plaza'], [PINEWIND_SPAWN.x, PINEWIND_SPAWN.z, 'spawn'], [0, 0, 'mine'], [-20.5, 14, 'sale'], [18.5, 11, 'shop']])
    assert.ok(!cells.has(cellAt(x, z)), `${what} must keep its floor`);
  // Gameplay data is untouched: the cut cells stay protected floor (nothing to mine, saves unaffected).
  const [cx, cz] = GAME_GENERATION.surfaceCut;
  assert.equal(sampleXYZ(cx, -1, cz, new Map(), GAME_GENERATION), PROTECTED_FLOOR);
});

test('terrain meshes leave the cut floor out: no voxel top surface inside the creek, the rest of the floor unchanged', () => {
  const region = [-3, -1, 2], origin = region.map(v => v * COLLISION_SIZE * CELL);
  for (const kind of ['collision', 'render']) {
    const cut = buildRegion(kind, region, COLLISION_SIZE, [], GAME_GENERATION).mesh, whole = buildRegion(kind, region, COLLISION_SIZE, [], { ...GAME_GENERATION, surfaceCut: undefined }).mesh;
    // Triangles of the top surface (all three corners at y = 0): none may lie over a cut cell.
    const tops = mesh => { const out = []; for (let t = 0; t < mesh.indices.length; t += 3) {
      const v = [0, 1, 2].map(k => mesh.indices[t + k] * 3);
      if (v.every(i => Math.abs(mesh.positions[i + 1] + origin[1]) < 1e-6)) out.push([v.reduce((a, i) => a + mesh.positions[i], 0) / 3 + origin[0], v.reduce((a, i) => a + mesh.positions[i + 2], 0) / 3 + origin[2]]);
    } return out; };
    for (const [x, z] of tops(cut)) assert.ok(!cells.has(cellAt(x, z)), `${kind}: floor top at ${x.toFixed(1)},${z.toFixed(1)} over the creek`);
    // Exactly the cut cells' tops are gone (2 m x 2 m each); the rest of the floor is unchanged.
    const area = mesh => { let sum = 0; for (let t = 0; t < mesh.indices.length; t += 3) {
      const v = [0, 1, 2].map(k => mesh.indices[t + k] * 3);
      if (!v.every(i => Math.abs(mesh.positions[i + 1] + origin[1]) < 1e-6)) continue;
      const [a, b, c] = v.map(i => [mesh.positions[i], mesh.positions[i + 2]]);
      sum += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    } return sum; };
    let inRegion = 0;
    for (let x = region[0] * COLLISION_SIZE; x < (region[0] + 1) * COLLISION_SIZE; x++) for (let z = region[2] * COLLISION_SIZE; z < (region[2] + 1) * COLLISION_SIZE; z++) if (cells.has(x + ',' + z)) inRegion++;
    assert.ok(inRegion > 0, 'the region crosses the creek');
    assert.ok(Math.abs(area(whole) - area(cut) - inRegion * CELL * CELL) < 1e-3, `${kind}: removed ${area(whole) - area(cut)} m2 of floor for ${inRegion} cells`);
  }
});

test('a character walks down into the creek, wades across and climbs out, on real voxel and bank collision', async () => {
  await initPhysics();
  const physics = new CharacterPhysics(false, true), collisions = new SceneryCollision(physics, [{ id: 'surface', depth: 0, plan: GAME_CONTENT.surface.plan }]);
  for (let x = -4; x <= -1; x++) for (let z = 1; z <= 3; z++) {
    const coord = [x, -1, z], mesh = buildRegion('collision', coord, COLLISION_SIZE, [], GAME_GENERATION).mesh;
    if (mesh.indices.length) physics.world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.positions, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setTranslation(...coord.map(v => v * COLLISION_SIZE * CELL)));
  }
  try {
    // Across at x = -20, well away from the bridge: south from the plaza side to the spawn side.
    physics.teleport([-20, .3, 30]);
    let lowest = Infinity;
    for (let i = 0; i < 900 && physics.feet()[2] < 50; i++) { collisions.sync(physics.feet()); physics.tick(0, 1, Math.PI, false, true); lowest = Math.min(lowest, physics.feet()[1]); }
    assert.ok(lowest < PINEWIND_CREEK.water - .3, `waded through the water (lowest feet ${lowest.toFixed(2)})`);
    assert.ok(lowest > -1, 'never below the bed (the journey sends players home below -1 m in closed mines)');
    assert.ok(physics.feet()[2] >= 50 && physics.feet()[1] > -.05, `climbed out on the far bank: ${physics.feet()}`);
  } finally { collisions.dispose(); physics.dispose(); }
});

test('standing in the creek is still the surface (not the mine) and sounds like wading', () => {
  const session = new GameSession(GAME_CONTENT.session);
  session.attach({ cell: () => 0, pending: () => false, mine: () => false, cancelMining() {}, returnToSurface() {}, travelTo() {} });
  session.updatePosition([-20, -.93, 41.2], true);
  assert.equal(session.getSnapshot().location, 'surface');
  session.updatePosition([-20, -2.05, 41.2], true);
  assert.equal(session.getSnapshot().location, 'mine', 'a real mine floor below is still the mine');
  const ports = { cell: () => PROTECTED_FLOOR, theme: () => 'meadow_mine', hub: () => true };
  assert.equal(footSurface([-20, -.93, 41.2], ports), 'water');
  assert.equal(footSurface([-20, -.2, 39], ports), 'dirt', 'the bank above the water');
  assert.notEqual(footSurface([PINEWIND_BRIDGE.x + 20, .03, 20], ports), 'water');
});
