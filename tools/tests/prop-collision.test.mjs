import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { placeProp, placeSolid, placement } from '../../src/game/world/propCollision.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { roomPlan } from '../../src/game/world/scenery.ts';
import authored from '../../src/game/content/pinewind/authored.json' with { type: 'json' };
import { initPhysics, CharacterPhysics, RAPIER } from '../../src/game/validation/physics.ts';
import { SceneryCollision } from '../../src/game/presentation/SceneryCollision.ts';

// Every model in the scenes says how it collides where it is built (surface-game-art/tools/blender/collision.py) and
// its colliders are placed with it (2026-10-30: the ore cart, the signpost and the plaza lamps had none; the halls'
// colliders were boxes typed next to each placement, not turned or scaled with the prop).

const close = (a, b, eps = 1e-3) => a.every((v, i) => Math.abs(v - b[i]) < eps);
const yawTurn = yaw => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

test('a prop\'s box moves, turns round Y and scales with the prop; any other turn makes it a hull of its corners', () => {
  const box = { at: [1, .5, 0], half: [.5, .5, .25], yaw: 0 };
  const turned = placeSolid(box, placement([10, 0, 20], yawTurn(Math.PI / 2), [2, 2, 2]));
  assert.ok(close(turned.at, [10, 1, 18]), JSON.stringify(turned.at));
  assert.ok(close(turned.half, [1, 1, .5]));
  assert.ok(Math.abs(turned.yaw - Math.PI / 2) < 1e-4);
  // A box turned in its prop, then the prop scaled unevenly in x and z: no longer a box.
  const sheared = placeSolid({ ...box, yaw: .3 }, placement([0, 0, 0], [0, 0, 0, 1], [2, 1, 1]));
  assert.equal(sheared.hull.length, 24);
  const tipped = placeSolid(box, placement([0, 0, 0], new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0)).toArray(), [1, 1, 1]));
  assert.equal(tipped.hull.length, 24);
  assert.ok(close(tipped.half, [.5, .25, .5]), JSON.stringify(tipped.half));
  // Hulls and triangles move point by point, re-centred on their new bounds.
  const hull = placeSolid({ at: [0, 1, 0], half: [1, 1, 1], yaw: 0, hull: [-1, -1, 0, 1, -1, 0, 0, 1, 1] }, placement([5, 0, 0], yawTurn(Math.PI), [1, 1, 1]));
  assert.ok(close(hull.at, [5, 1, -.5]), JSON.stringify(hull.at));
  const points = [];
  for (let i = 0; i < hull.hull.length; i += 3) points.push(hull.hull.slice(i, i + 3).map((v, k) => v + hull.at[k]));
  assert.ok(points.some(p => close(p, [6, 0, 0])) && points.some(p => close(p, [5, 2, -1])), JSON.stringify(points));
  assert.throws(() => placeProp('Mystery', {}, new Matrix4()), /no collision decision/);
  assert.deepEqual(placeProp('Rug', { passable: 'flat on the floor' }, new Matrix4()), []);
});

const glbJson = file => { const b = readFileSync(file); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12))); };
const KITS = 'surface-game-art/public/assets/underground';
test('every prop of every hall and base kit says how it collides', () => {
  const kits = readdirSync(KITS).filter(f => f.endsWith('-props.glb'));
  assert.ok(kits.length >= 15, kits.join());
  for (const kit of kits) {
    const json = glbJson(`${KITS}/${kit}`);
    for (const i of json.scenes[0].nodes) {
      const node = json.nodes[i], raw = node.extras?.collision;
      assert.equal(typeof raw, 'string', `${kit}: ${node.name} has no collision`);
      const c = JSON.parse(raw);
      assert.ok(c.solids?.length || c.mesh || c.passable, `${kit}: ${node.name} decided nothing`);
      assert.ok(!/\.\d{3}$/.test(node.name), `${kit}: ${node.name} lost its name to a part`);
      for (const s of c.solids ?? []) assert.ok(s.half.every(v => v > 0) && s.at.every(Number.isFinite), `${kit}: ${node.name}`);
    }
  }
});

test('Pinewind: every model brings its colliders where it stands; the cart, crates, signpost and lamps stop the character', async () => {
  for (const r of authored.roots) assert.ok(r.collision.solids?.length || r.collision.passable, r.node);
  const solids = GAME_CONTENT.surface.plan.solids, near = (node, reach = 2.5) => {
    const at = GAME_CONTENT.surface.authored.instances.find(i => i.node === node).at;
    return solids.filter(s => Math.hypot(s.at[0] - at[0], s.at[2] - at[2]) < reach && s.half[1] > .3 && s.half[0] < 6);
  };
  for (const node of ['Ore_Cart', 'Ore_Crates', 'Plaza_Signpost', 'Plaza_Lamp_0', 'Plaza_Lamp_1', 'Capsule_Cabinet', 'Teleport_Station', 'World_Gate'])
    assert.ok(near(node, node === 'World_Gate' ? 8 : 2.5).length, `${node} collides`);
  await initPhysics();
  const physics = new CharacterPhysics(), collisions = new SceneryCollision(physics, [{ id: 'surface', depth: 0, plan: GAME_CONTENT.surface.plan }]);
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(100, 1, 100).setTranslation(0, -1, 0));
  // Walking straight at each one (toward -Z) from 4 m: the character is stopped or slides round it, never into it.
  const inside = (s, [x, , z]) => {
    const dx = x - s.at[0], dz = z - s.at[2], c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    return Math.abs(dx * c - dz * sn) < s.half[0] + .3 && Math.abs(dx * sn + dz * c) < s.half[2] + .3;
  };
  try {
    for (const node of ['Ore_Cart', 'Ore_Crates', 'Plaza_Lamp_0', 'Plaza_Signpost']) {
      const at = GAME_CONTENT.surface.authored.instances.find(i => i.node === node).at, boxes = near(node).filter(s => !s.triangles);
      physics.teleport([at[0], .1, at[2] + 4]);
      let passed = false;
      for (let i = 0; i < 240; i++) {
        collisions.sync(physics.feet()); physics.tick(0, 1, 0, false, true);
        assert.ok(!boxes.some(s => inside(s, physics.feet())), `walked into ${node} at ${physics.feet()}`);
        passed ||= physics.feet()[2] < at[2];
      }
      assert.ok(!passed || Math.abs(physics.feet()[0] - at[0]) > .5, `${node}: went straight through to ${physics.feet()}`);
    }
  } finally { collisions.dispose(); physics.dispose(); }
});

test('world 3\'s kit rooms: every piece standing on the floor above the knee, away from the walls, touches a collider', () => {
  for (const room of GAME_CONTENT.worlds[2].localRooms) {
    const plan = roomPlan(room), kit = plan.authored;
    if (!kit) continue;
    const transform = new Matrix4().makeScale(...kit.scale).setPosition(...kit.origin), bounds = new Map();
    for (const [id, m] of Object.entries(kit.kit.meshes)) {
      const b = new Box3();
      for (let i = 0; i < m.positions.length; i += 3) b.expandByPoint(new Vector3(m.positions[i], m.positions[i + 1], m.positions[i + 2]));
      bounds.set(id, b);
    }
    for (const p of kit.instances) {
      const m = new Matrix4().compose(new Vector3(...p.at), new Quaternion().setFromEuler(new Euler(...p.rotation)), new Vector3(...p.scale));
      if (!p.fixed) m.premultiply(transform);
      const b = bounds.get(p.mesh).clone().applyMatrix4(m), c = b.getCenter(new Vector3()), size = b.getSize(new Vector3());
      if (b.min.y > .3 || b.max.y < .6 || p.floor || Math.abs(c.x - room.x) > 18 || Math.abs(c.z - room.z) > 18) continue;
      assert.ok(plan.solids.some(s => {
        const r = Math.hypot(s.half[0], s.half[2]);
        return Math.abs(c.x - s.at[0]) < r + size.x / 2 && Math.abs(c.z - s.at[2]) < r + size.z / 2 && s.at[1] - s.half[1] < b.max.y && s.at[1] + s.half[1] > b.min.y;
      }), `${room.id}: ${p.name ?? p.mesh} at ${c.toArray().map(v => v.toFixed(1))} has no collider`);
    }
  }
});

// 2026-10-30: the sale house's entry steps, once solid, reached into its ring: a trip there (出售) landed against
// the lower step and the character crept up its edge for 16 s before it stood, above the ring's height (the
// playthrough's selling took eight times as long). Where trips land and players stand, the middle of every sale,
// shop and egg zone, nothing but the ground is within a character's reach.
test('every sale, shop and egg zone\'s middle is clear of everything but the ground, a character\'s width round', () => {
  const s = GAME_CONTENT.session, reach = .44 + .1;
  const zones = [...s.sales.map(z => ['sale', z]), ...s.shops.map(p => [p.id, p.zone]), ...s.eggStations.map(e => [e.id, e.zone])];
  const sites = GAME_CONTENT.sites.map(site => ({ ...site, solids: site.plan.solids.filter(x => !x.ground).map(x => ({ ...x, at: [x.at[0], x.at[1] - site.depth, x.at[2] + (site.z ?? 0)] })) }));
  // Distance in the ground plane from a point to a solid's footprint (a turned box; a hull's or triangles' bounds).
  const gap = (x, [px, , pz]) => {
    const dx = px - x.at[0], dz = pz - x.at[2], c = Math.cos(x.yaw), sn = Math.sin(x.yaw);
    const u = Math.abs(dx * c - dz * sn) - x.half[0], v = Math.abs(dx * sn + dz * c) - x.half[2];
    return Math.hypot(Math.max(u, 0), Math.max(v, 0));
  };
  for (const [id, zone] of zones) for (const site of sites) for (const x of site.solids) {
    const bottom = x.at[1] - x.half[1], top = x.at[1] + x.half[1];
    if (top <= zone.y + .1 || bottom >= zone.y + 1.85) continue; // under the feet, or over the head
    assert.ok(gap(x, [zone.x, 0, zone.z]) > reach, `${id} at ${zone.x.toFixed(2)},${zone.z.toFixed(2)}: a collider ${x.half[1] * 2 > 0 ? (top - zone.y).toFixed(2) : ''} m high at ${x.at.map(v => v.toFixed(2))} (${site.id})`);
  }
});
