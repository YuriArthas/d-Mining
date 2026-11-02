// How long the way down from each layer takes when a player only digs (docs/phase-layer-cap-20261029.md): from the
// layer's pit (world 1's first: the surface pit) straight down to the next hall, the pick held, a big bag, no pets
// and no enhancement; once with the pickaxe the layer asks for (the one a player has on arriving) and once with the
// one its cap recommends (the next layer's). On the game's own logic, no rendering (headless.mts).
//   node tools/economy/rush.mts [world] > artifacts/economy-measure/rush.json
import { createHeadlessGame } from './headless.mts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { ECONOMY as E } from '../../src/game/content/economy.ts';
import { worldRequirement, worldSpawn } from '../../src/game/content/worldJourney.ts';
import type { Coord } from '../../src/game/terrain/SparseWorld.ts';

const content = GAME_CONTENT.session, only = process.argv[2] ? [+process.argv[2]] : [1, 2, 3];
const halls = (w: number) => content.destinations.filter(d => d.worldId === w);

async function rush(w: number, k: number, level: number) {
  const d = new GameSession(content).exportProgress() as any;
  d.onboarding = { ...d.onboarding, status: 'skipped' };
  d.pickaxe = { version: 1, level, enhance: 0 }; d.equipment = { ...d.equipment, toolLevel: level, backpackTier: E.bags.at(-1)!.tier, equippedBackpackTier: E.bags.at(-1)!.tier };
  d.inventory = { ...d.inventory, capacity: E.bags.at(-1)!.capacity };
  d.worldProgress = { version: 2, openWorlds: [1, 2, 3].filter(x => x <= w) };
  for (const x of [1, 2, 3]) { const rooms = halls(x).slice(0, x < w ? 6 : k); d.worldExploration[x] = { version: 1, maxDepth: rooms.at(-1)?.depth ?? 0, unlockedDestinationIds: rooms.map(r => r.id) }; }
  d.exploration = d.worldExploration[1];
  const g = await createHeadlessGame(d);
  const reached = () => g.session.devUnlocks()[w - 1].layers.filter(l => l.unlocked).length;
  g.player.travelTo(worldSpawn(w as 1)); g.settle();
  if (k > 0) { g.run(1); g.session.travelTo(halls(w)[k - 1].id); g.settle(); }
  else { g.player.travelTo([0, .1, worldRequirement(w as 1).z + 10]); g.settle(); }
  const cellOf = (v: readonly number[]) => v.map(x => Math.floor(x / 2)) as Coord;
  const air = (c: Coord) => { const v = g.terrain.cell(c); return v === 0 || (v === null && c[1] >= 0); };
  const solid = (c: Coord) => g.terrain.canMine(c) && g.terrain.cell(c)! > 0 && !g.terrain.pending(c);
  // Over to the pit (its nearest mineable cell touching the air), then down.
  const f0 = g.feet(), h = cellOf([f0[0], f0[1] + .1, f0[2]]);
  let pit: Coord | null = null, best = Infinity;
  for (let dy = -1; dy >= -2; dy--) for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) {
    const c: Coord = [h[0] + dx, h[1] + dy, h[2] + dz];
    if (!solid(c) || !air([c[0], c[1] + 1, c[2]])) continue;
    const dist = Math.hypot(dx, dz); if (dist < best) { best = dist; pit = c; }
  }
  if (!pit) { g.dispose(); return { seconds: null, note: 'no pit found' }; }
  g.run(10, () => { const f = g.feet(), to = [(pit![0] + .5) * 2, 0, (pit![2] + .5) * 2]; if (Math.hypot(f[0] - to[0], f[2] - to[2]) < .3) return true; g.walk(to); });
  g.walk(null);
  const start = g.clock.now, limit = 3 * 3600;
  const done = g.run(limit, () => {
    if (reached() > k) return true;
    const f = g.feet(); let c = cellOf([f[0], f[1] - .1, f[2]]);
    for (let n = 0; n < 4 && air(c); n++) c = [c[0], c[1] - 1, c[2]];
    if (air(c)) { g.walk([(c[0] + .5) * 2, f[1], (c[2] + .5) * 2]); return; }
    g.walk(null);
    // on the hall's floor already (a stone or a prop): over to where the hall is entered
    if (!solid(c)) { const s = halls(w)[k].spawn; g.walk([s[0], s[1], s[2]]); return; }
    g.aim(c);
  });
  const seconds = g.clock.now - start, depth = -g.feet()[1];
  g.dispose();
  return { seconds: done ? Math.round(seconds) : null, depth: Math.round(depth) };
}

const rows = [];
for (const w of only) for (let k = 0; k < 6; k++) {
  const arrive = E.layers[(w - 1) * 7 + k].gate, recommended = E.layers[(w - 1) * 7 + k].capLevel!;
  const withArrival = await rush(w, k, arrive), withRecommended = await rush(w, k, recommended);
  const row = { world: w, layer: k, arrive, recommended, arrivalMinutes: withArrival.seconds == null ? null : +(withArrival.seconds / 60).toFixed(1),
    recommendedMinutes: withRecommended.seconds == null ? null : +(withRecommended.seconds / 60).toFixed(1) };
  rows.push(row); console.error(JSON.stringify(row));
}
console.log(JSON.stringify(rows, null, 1));
