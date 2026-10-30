import { WORLD1 } from './fixtures/world.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, CharacterPhysics, RAPIER } from '../../src/game/validation/physics.ts';
import { SceneryCollision } from '../../src/game/presentation/SceneryCollision.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { CAPSULE_MACHINE_AT, CAPSULE_MACHINE_ZONE } from '../../src/game/content/feedbackFacilities.ts';
import { ZoneDetector } from '../../src/game/logic/ZoneDetector.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';
import { COLLISION_SIZE, CELL } from '../../src/game/terrain/SparseWorld.ts';
import { MOVEMENT } from '../../src/game/movement.ts';

await initPhysics();
// Every check runs at the live capsule machine zone, wherever the hub places it.
const Z = CAPSULE_MACHINE_ZONE, AT = [Z.x, 0, Z.z];
// A low ledge (a 14 cm curb-like step) whose edge overlaps the capsule standing beside it, masking the voxel floor.
const LEDGE = [12, 0, 31.8];
const LEDGE_PLAN = { shapes: [], signs: [], solids: [{ at: [12, 0.068, 32], half: [1, 0.068, 0.14], yaw: 0 }] };
const floorMeshes = [];
for (let x = -1; x <= 1; x++) for (let z = 0; z <= 3; z++) {
  const coord = [x, -1, z], mesh = buildRegion('collision', coord, COLLISION_SIZE, [], WORLD1).mesh;
  if (mesh.indices.length) floorMeshes.push({ coord, mesh });
}

function setup({ floor = true, feedback = true, floorFirst = false, scenery = true, at = AT, plan = GAME_CONTENT.surface.plan } = {}) {
  const physics = new CharacterPhysics(), floorHandles = [];
  function installFloor() {
    if (!floor) return;
    for (const { coord, mesh } of floorMeshes) floorHandles.push(physics.world.createCollider(
      RAPIER.ColliderDesc.trimesh(mesh.positions, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setTranslation(...coord.map(value => value * COLLISION_SIZE * CELL)),
    ));
  }
  if (floorFirst) installFloor();
  // Without `feedback`, the machine's own colliders (its model's) are taken out of the plan.
  const own = s => Math.hypot(s.at[0] - CAPSULE_MACHINE_AT[0], s.at[2] - CAPSULE_MACHINE_AT[2]) < 1 && s.half[1] > 1;
  const sites = scenery ? [{ id: 'surface', depth: 0, plan: feedback ? plan : { ...plan, solids: plan.solids.filter(s => !own(s)) } }] : [];
  const collisions = new SceneryCollision(physics, sites);
  collisions.sync(at);
  if (!floorFirst) installFloor();
  return {
    physics, collisions, floorHandles,
    dispose() { collisions.dispose(); physics.dispose(); },
  };
}
function ticks(physics, count, x = 0, forward = 0) {
  for (let i = 0; i < count; i++) physics.tick(x, forward, 0, false, true);
}

test('the capsule machine\'s zone stands on the real voxel floor, including the failed public float position', () => {
  const arrivals = [
    AT,
    [Z.x + 0.000136375427246, 0.019701611995696977, Z.z + 0.000216674804688],
    [Z.x, 0.05, Z.z],
  ];
  for (const floorFirst of [false, true]) for (const arrival of arrivals) {
    const scene = setup({ floorFirst });
    try {
      const p = scene.physics;
      p.teleport(arrival); ticks(p, 300);
      assert.equal(p.grounded, true, JSON.stringify({ floorFirst, arrival, feet: p.feet() }));
      assert.equal(p.verticalSpeed, 0);
      assert.ok(p.feet()[1] >= -0.001 && p.feet()[1] < 0.2);
      const zone = new ZoneDetector(CAPSULE_MACHINE_ZONE);
      assert.equal(zone.update(p.feet(), p.grounded), 'enter');
    } finally { scene.dispose(); }
  }
});

test('the machine\'s surroundings find real ground without the machine\'s own collider', () => {
  const scene = setup({ feedback: false });
  try {
    const p = scene.physics;
    p.teleport(AT); ticks(p, 300);
    assert.equal(p.grounded, true); assert.equal(p.verticalSpeed, 0);
    assert.ok(p.feet()[1] < 0.2);
  } finally { scene.dispose(); }
});

test('walking up to the machine, falling onto its zone and returning from the spawn all retain stable support', () => {
  for (const route of ['walk', 'fall', 'return']) {
    // The machine stands in the live hub (north of the egg terraces), so the routes run through its scenery.
    const scene = setup();
    try {
      const p = scene.physics;
      if (route === 'walk') {
        p.teleport([Z.x, 0.3, Z.z + 2.2]); ticks(p, 30); ticks(p, 24, 0, 1);
      } else if (route === 'fall') {
        p.teleport([Z.x, 4, Z.z]);
      } else {
        scene.collisions.sync([0, 0.05, 46]); p.teleport([0, 0.05, 46]); ticks(p, 60);
        scene.collisions.sync(AT); p.teleport(AT);
      }
      ticks(p, 300);
      assert.equal(p.grounded, true, route); assert.equal(p.verticalSpeed, 0, route);
      const before = p.feet()[1]; ticks(p, 120);
      assert.ok(Math.abs(p.feet()[1] - before) < 0.001, route);
      const zone = new ZoneDetector(CAPSULE_MACHINE_ZONE);
      assert.equal(zone.update(p.feet(), p.grounded), 'enter', route);
    } finally { scene.dispose(); }
  }
});

test('scenery without the voxel floor under it never grants support or an airborne jump', () => {
  const scene = setup({ floor: false });
  try {
    const p = scene.physics;
    p.teleport(AT); ticks(p, 150);
    assert.equal(p.grounded, false); assert.ok(p.verticalSpeed < 0);
    const jumps = p.jumps; p.tick(0, 0, 0, true, true);
    assert.equal(p.jumps, jumps); assert.equal(p.grounded, false);
  } finally { scene.dispose(); }
});

test('removing the voxel floor immediately removes jump eligibility', () => {
  const scene = setup();
  try {
    const p = scene.physics;
    p.teleport(AT); ticks(p, 30); assert.equal(p.grounded, true);
    for (const floor of scene.floorHandles) p.world.removeCollider(floor, false);
    const jumps = p.jumps; p.tick(0, 0, 0, true, true);
    assert.equal(p.jumps, jumps); assert.equal(p.grounded, false); assert.ok(p.verticalSpeed < 0);
  } finally { scene.dispose(); }
});

test('a vertical wall alone never counts as a walkable support plane', () => {
  const p = new CharacterPhysics();
  try {
    p.world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 10, 10).setTranslation(12.5, 0, 32));
    p.teleport(LEDGE); ticks(p, 60);
    assert.equal(p.grounded, false);
    assert.ok(p.feet()[1] < -1);
    const jumps = p.jumps; p.tick(0, 0, 0, true, true);
    assert.equal(p.jumps, jumps);
  } finally { p.dispose(); }
});

test('a grounded jump by the machine rises once and lands normally on actual support', () => {
  const scene = setup();
  try {
    const p = scene.physics;
    p.teleport(AT); ticks(p, 30);
    assert.equal(p.grounded, true);
    const base = p.feet()[1]; p.tick(0, 0, 0, true, true);
    assert.equal(p.jumps, 1); assert.equal(p.grounded, false);
    let peak = p.feet()[1];
    for (let i = 0; i < 20; i++) { p.tick(0, 0, 0, true, true); peak = Math.max(peak, p.feet()[1]); }
    assert.equal(p.jumps, 1); assert.ok(peak > base + 1);
    ticks(p, 150);
    assert.equal(p.grounded, true); assert.equal(p.verticalSpeed, 0);
  } finally { scene.dispose(); }
});

test('support retries only rejected colliders: one query on a clear floor and two beside a masking ledge', () => {
  for (const scenery of [false, true]) {
    const scene = setup({ scenery, feedback: false, at: LEDGE, plan: LEDGE_PLAN });
    try {
      const p = scene.physics;
      p.teleport([LEDGE[0], 0.02, LEDGE[2]]);
      const original = p.world.castShape.bind(p.world);
      let casts = 0;
      p.world.castShape = (...args) => { casts++; return original(...args); };
      assert.notEqual(p.support(p.body.translation(), MOVEMENT.supportProbe), null);
      assert.equal(casts, scenery ? 2 : 1);
    } finally { scene.dispose(); }
  }
});
