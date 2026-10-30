import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { eggsOfWorld } from '../../src/game/content/eggStands.ts';
import { TECH_BASE } from '../../src/game/content/world2/techBase.ts';
import { STAR_BASE } from '../../src/game/content/world3/starBase.ts';
import techBase from '../../src/game/content/underground/tech-base.json' with { type: 'json' };
import starBase from '../../src/game/content/underground/star-base.json' with { type: 'json' };
import { baseSurfacePlan } from '../../src/game/content/baseSurfaces.ts';

/** Is (x, z) within `margin` of a box collider's footprint (turned by its yaw)? */
const near = (solid, x, z, margin) => {
  const dx = x - solid.at[0], dz = z - solid.at[2], c = Math.cos(solid.yaw ?? 0), s = Math.sin(solid.yaw ?? 0);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < solid.half[0] + margin && Math.abs(lz) < solid.half[2] + margin;
};
for (const [world, base, solids] of [[2, TECH_BASE, techBase.solids], [3, STAR_BASE, baseSurfacePlan(3).solids.map(s => ({ ...s, at: [s.at[0], s.at[1], s.at[2] - STAR_BASE.worldZ] }))]]) {
  test(`world ${world}'s eggs stand round its hatchery: cheapest first, apart, each reachable and clear of the base`, () => {
    assert.deepEqual(base.stands.map(s => s.eggId), eggsOfWorld(world));
    const [cx, cz] = base.hatchery.centre;
    base.stands.forEach((stand, i) => {
      // On the pad, facing its centre; neighbours far enough apart that their labels (1.7 m) never touch.
      assert.ok(Math.hypot(stand.x - cx, stand.z - cz) + 1.23 < base.hatchery.pad, stand.eggId);
      if (i) assert.ok(Math.hypot(stand.x - base.stands[i - 1].x, stand.z - base.stands[i - 1].z) > 4, stand.eggId);
      const station = GAME_CONTENT.session.eggStations.find(s => s.eggId === stand.eggId), zone = station.zone;
      assert.ok(Math.hypot(zone.x - cx, zone.z - base.worldZ - cz) < base.hatchery.radius, `${stand.eggId}: the player stands inside the arc`);
      // Its own collider is the only one at the stand; nothing blocks the spot in front of it.
      const own = solids.filter(s => near(s, stand.x, stand.z, 0));
      assert.equal(own.length, 1, stand.eggId);
      assert.ok(!solids.some(s => near(s, zone.x, zone.z - base.worldZ, .35)), `${stand.eggId}: its spot is clear`);
    });
    // Nothing else of the base stands on the pad.
    for (const solid of solids) if (!base.stands.some(stand => near(solid, stand.x, stand.z, 0)))
      assert.ok(Math.hypot(solid.at[0] - cx, solid.at[2] - cz) > base.hatchery.pad + Math.min(solid.half[0], solid.half[2]) - .5, `collider at ${solid.at}`);
    // The world's sell and shop rings stay off the pad.
    for (const zone of [...GAME_CONTENT.session.sales, ...GAME_CONTENT.session.shops.map(s => s.zone)].filter(z => Math.abs(z.z - base.worldZ - 30) < 60))
      assert.ok(Math.hypot(zone.x - cx, zone.z - base.worldZ - cz) > base.hatchery.pad + zone.radius, `ring at ${zone.x},${zone.z}`);
  });
}
