import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { PINEWIND_BRIDGE } from '../../src/game/content/pinewind/hubLayout.ts';
import { guideRoute, routeLength } from '../../src/game/world/guideRoute.ts';
import { chevronGeometry, markerGeometry, updateGuidePath } from '../../src/game/presentation/guidePath.ts';
import { CharacterPhysics, initPhysics } from '../../src/game/validation/physics.ts';
import { SceneryCollision } from '../../src/game/presentation/SceneryCollision.ts';
import { createScenerySites } from '../../src/game/world/createScenerySites.ts';

const target = GAME_CONTENT.session.onboarding.entrance, spawn = GAME_CONTENT.returnPoint, B = PINEWIND_BRIDGE;
const south = B.z + B.halfSpan + 1.5, north = B.z - B.halfSpan - 1.5;

test('the guide goes over the creek by the bridge, ends first; on one bank it goes straight', () => {
  assert.deepEqual(guideRoute(spawn, target), [[spawn[0], spawn[2]], [B.x, south], [B.x, north], [target[0], target[2]]]);
  assert.deepEqual(guideRoute([6, 0, 20], target), [[6, 20], [target[0], target[2]]], 'north bank: straight to the mine');
  assert.deepEqual(guideRoute([0, 1, B.z], target), [[0, B.z], [B.x, north], [target[0], target[2]]], 'on the bridge: off its far end');
  assert.ok(routeLength(guideRoute(spawn, target)) >= Math.hypot(target[0] - spawn[0], target[2] - spawn[2]));
});

test('chevrons and the arrow over the mine: a white face in front of a dark-blue rim', () => {
  for (const [geometry, front] of [[chevronGeometry(), 1], [markerGeometry(), 2]]) {
    const colours = new Set(), position = geometry.getAttribute('position'), colour = geometry.getAttribute('color');
    let faceFront = -Infinity, rimFront = -Infinity;
    for (let i = 0; i < position.count; i++) {
      const c = [colour.getX(i), colour.getY(i), colour.getZ(i)].map(v => v.toFixed(2)).join(','), white = c === '1.00,1.00,1.00';
      colours.add(c); const v = position.getComponent(i, front);
      if (white) faceFront = Math.max(faceFront, v); else rimFront = Math.max(rimFront, v);
    }
    assert.equal(colours.size, 2, 'white and the rim colour');
    assert.ok(faceFront > rimFront, 'the face stands in front of its rim');
  }
  // A chevron points +Z: its tip on the middle line ahead, its two wings trailing behind.
  const chevron = chevronGeometry().getAttribute('position'), xs = i => chevron.getX(i), zs = i => chevron.getZ(i);
  const tip = Math.max(...Array.from({ length: chevron.count }, (_, i) => Math.abs(xs(i)) < .05 ? zs(i) : -Infinity));
  const wings = Math.max(...Array.from({ length: chevron.count }, (_, i) => Math.abs(xs(i)) > .45 ? zs(i) : -Infinity));
  assert.ok(tip > .3 && wings < 0, `tip ${tip}, wings ${wings}`);
});

test('laid on world 1, every chevron rides on the bridge deck, never inside it; the arrow bobs over the mine', async () => {
  await initPhysics();
  const physics = new CharacterPhysics(), scenery = new SceneryCollision(physics, createScenerySites(GAME_CONTENT.rooms, GAME_CONTENT.surface.plan));
  try {
    // Colliders join the queries with the world's next step, as in the game (physics ticks before the guide).
    scenery.sync([0, 0, B.z]); physics.world.step();
    const deck = z => physics.surfaceBelow(B.x, z, 4, 8);
    assert.ok(deck(B.z) > .8, `the bridge rises in the middle (${deck(B.z)})`);
    const group = new Group(), material = new MeshBasicMaterial({ vertexColors: true });
    group.add(new InstancedMesh(chevronGeometry(), material, 48), new Mesh(markerGeometry(), material));
    const from = 1.6, surface = (x, z) => { const y = physics.surfaceBelow(x, z, from, 4); return y !== null && y < from - .25 ? y : null; };
    let onBridge = 0;
    for (const time of [0, .3, .6]) {
      updateGuidePath(group, spawn, target, [0, 4, 52], time, surface);
      const chevrons = group.children[0], at = new Vector3(), m = new Matrix4();
      assert.ok(chevrons.count >= 15, `a dotted line all the way (${chevrons.count})`);
      for (let i = 0; i < chevrons.count; i++) {
        chevrons.getMatrixAt(i, m); at.setFromMatrixPosition(m);
        if (Math.abs(at.z - B.z) < B.halfSpan - .5) { onBridge++; assert.ok(at.y > deck(at.z) + .1, `chevron at z ${at.z.toFixed(1)} sits on the deck (${at.y.toFixed(2)} over ${deck(at.z).toFixed(2)})`); }
      }
    }
    assert.ok(onBridge >= 9, 'chevrons cross on the bridge');
    const marker = group.children[1].position;
    assert.ok(Math.abs(marker.x - target[0]) < 1e-6 && Math.abs(marker.z - target[2]) < 1e-6 && marker.y > 2, 'the arrow floats over the mine');
  } finally { scenery.dispose(); physics.dispose(); }
});
