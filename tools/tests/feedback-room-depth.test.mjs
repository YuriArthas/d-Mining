import { WORLD1 } from './fixtures/world.mjs';
import test from 'node:test';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import assert from 'node:assert/strict';
import { Scene, HemisphereLight, DirectionalLight } from 'three';
import { playerDepthAtFeet, environmentDepthAtFeet } from '../../src/game/logic/PlayerDepth.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { themeById } from '../../src/game/content/themes.ts';
import { stratumAtDepth } from '../../src/game/terrain/strata.ts';
import { initPhysics, CharacterPhysics, RAPIER } from '../../src/game/validation/physics.ts';
import { SceneryCollision } from '../../src/game/presentation/SceneryCollision.ts';
import { createScenerySites } from '../../src/game/world/createScenerySites.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';
import { CELL, COLLISION_SIZE } from '../../src/game/terrain/SparseWorld.ts';
import { EnvironmentController } from '../../src/game/presentation/EnvironmentController.ts';
import { surfaceLightStrengthAtFeet } from '../../src/game/world/SurfaceLightFade.ts';

await initPhysics();
const destinations = GAME_CONTENT.session.destinations;
const rooms = GAME_CONTENT.rooms.filter(room => ['old_mine', 'fungal'].includes(room.id));
function physicsAtRoom(room) {
  const physics = new CharacterPhysics();
  const floorRegion = Math.floor(-room.depth / (CELL * COLLISION_SIZE));
  for (let x = -1; x <= 0; x++) for (let y = floorRegion - 1; y <= floorRegion; y++) {
    const coord = [x, y, 0], { mesh } = buildRegion('collision', coord, COLLISION_SIZE, [], WORLD1);
    if (mesh.indices.length) physics.world.createCollider(
      RAPIER.ColliderDesc.trimesh(mesh.positions, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setTranslation(...coord.map(value => value * COLLISION_SIZE * CELL)),
    );
  }
  const scenery = new SceneryCollision(physics, createScenerySites(GAME_CONTENT.rooms, GAME_CONTENT.surface.plan));
  scenery.sync(room.spawn);
  physics.teleport(room.spawn);
  return { physics, dispose() { scenery.dispose(); physics.dispose(); } };
}
function ticks(physics, count) {
  for (let i = 0; i < count; i++) physics.tick(0, 0, 0, false, true);
}
function visualFrame(feet, grounded) {
  const layer = stratumAtDepth(environmentDepthAtFeet(feet, grounded, destinations), GAME_CONTENT.layers);
  const theme = themeById(layer.theme);
  return { surface: theme.motif === 'meadow', surfaceLightStrength: surfaceLightStrengthAtFeet(feet[1]),
    depth: layer.from, sky: theme.sky, groundLight: theme.groundLight, sceneryRevision: 0 };
}
function environment() {
  const scene = new Scene(), ambient = new HemisphereLight(), key = new DirectionalLight();
  const sky = { active: false, lightingStrength: 0, setEnabled(value) { this.active = value; }, setLightingStrength(value) { this.lightingStrength = value; }, prepareDraw() {}, markSubmitted() {}, dispose() {}, diagnostics() { return {}; } };
  const controller = new EnvironmentController(scene, ambient, key, sky, GAME_CONTENT.environment);
  const lightState = () => [ambient.color.getHex(), ambient.groundColor.getHex(), ambient.intensity,
    key.color.getHex(), key.intensity, ...key.position.toArray(), ...key.target.position.toArray()];
  return { scene, sky, controller, lightState };
}

for (const room of rooms) {
  test(`${room.id}: actual authored floor and Rapier skin count as the milestone and keep the underground lighting`, () => {
    const fixture = physicsAtRoom(room), env = environment();
    try {
      const physics = fixture.physics;
      ticks(physics, 180);
      const feet = physics.feet();
      assert.equal(physics.grounded, true);
      assert.ok(-feet[1] + .04 < room.depth, 'the real floor exceeds the previous generic contact tolerance');
      const session = GameSession.createNew(GAME_CONTENT.session);
      session.updatePosition(feet, true);
      assert.equal(session.getSnapshot().depth, room.depth);
      assert.equal(session.getSnapshot().destinations.find(destination => destination.id === room.id).unlocked, true);
      assert.equal(session.exportProgress().exploration.maxDepth, room.depth);
      assert.equal(playerDepthAtFeet(feet, true, destinations), room.depth);
      env.controller.prepare(visualFrame(feet, true));
      const underground = env.lightState();
      env.controller.update(visualFrame(feet, true), .016);
      assert.deepEqual(env.lightState(), underground);
      assert.equal(env.sky.active, false);
      assert.equal(env.controller.surfaceBlend, 0);
      assert.ok(env.scene.fog);
    } finally { env.controller.dispose(); fixture.dispose(); }
  });

  test(`${room.id}: a normal jump keeps the room theme while airborne depth cannot grant the milestone`, () => {
    const fixture = physicsAtRoom(room), env = environment();
    try {
      const physics = fixture.physics;
      ticks(physics, 90);
      const base = physics.feet()[1];
      env.controller.prepare(visualFrame(physics.feet(), true));
      const baseline = env.lightState();
      physics.tick(0, 0, 0, true, true);
      let airborneFrames = 0, peak = base;
      for (let i = 0; i < 90; i++) {
        const feet = physics.feet();
        peak = Math.max(peak, feet[1]);
        const frame = visualFrame(feet, physics.grounded);
        assert.equal(frame.depth, room.depth);
        env.controller.update(frame, .016);
        assert.deepEqual(env.lightState(), baseline);
        assert.equal(env.sky.active, false);
        if (!physics.grounded) {
          airborneFrames++;
          const freshSession = GameSession.createNew(GAME_CONTENT.session);
          freshSession.updatePosition(feet, false);
          assert.equal(freshSession.getSnapshot().destinations.find(destination => destination.id === room.id).unlocked, false);
          assert.ok(freshSession.exportProgress().exploration.maxDepth < room.depth);
        }
        physics.tick(0, 0, 0, false, true);
      }
      assert.ok(airborneFrames > 10);
      assert.ok(peak > base + 1);
      assert.equal(physics.grounded, true);
    } finally { env.controller.dispose(); fixture.dispose(); }
  });
}

test('airborne room entry and grounded objects above its floor window never grant early progression', () => {
  const room = destinations.find(destination => destination.id === 'old_mine'), d = room.depth;
  const samples = [
    { feet: room.spawn, grounded: false },
    { feet: [0, -(d - .025), 11], grounded: false },
    { feet: [0, -(d - .5), 11], grounded: false },
    { feet: [0, room.spawn[1] + .032, 11], grounded: true },
    { feet: [room.roomBounds.maxX, room.spawn[1], 11], grounded: true },
  ];
  for (const { feet, grounded } of samples) {
    const session = GameSession.createNew(GAME_CONTENT.session);
    session.updatePosition(feet, grounded);
    assert.equal(session.getSnapshot().destinations.find(destination => destination.id === room.id).unlocked, false);
    assert.ok(session.exportProgress().exploration.maxDepth < room.depth);
    assert.equal(session.getSnapshot().depth, d - 1);
  }
});

test('natural descent outside room bounds keeps exact airborne thresholds and the existing grounded contact tolerance', () => {
  const d = destinations.find(destination => destination.id === 'old_mine').depth;
  for (const { y, grounded, unlocked } of [
    { y: -(d - .01), grounded: false, unlocked: false },
    { y: -d, grounded: false, unlocked: true },
    { y: -(d - .025), grounded: true, unlocked: true },
    { y: -(d - .1), grounded: true, unlocked: false },
  ]) {
    const feet = [90, y, 90], session = GameSession.createNew(GAME_CONTENT.session);
    session.updatePosition(feet, grounded);
    assert.equal(session.getSnapshot().destinations.find(destination => destination.id === 'old_mine').unlocked, unlocked);
    assert.equal(session.exportProgress().exploration.maxDepth, -y + (grounded ? .04 : 0));
    assert.equal(visualFrame(feet, grounded).depth, unlocked ? d : 0);
  }
});

test('standing on a hall floor stone (8.5 cm, with the skin about 11 cm over the floor) reaches the hall', () => {
  const room = destinations.find(destination => destination.id === 'old_mine');
  const session = GameSession.createNew(GAME_CONTENT.session);
  session.updatePosition([0, -room.depth + .112, 11], true);
  assert.equal(session.getSnapshot().destinations.find(destination => destination.id === room.id).unlocked, true);
});
