// P6, measured with the real game logic and no rendering (headless.mts): a bot plays a stretch of a layer the way a
// player would, and what it makes is set against the economy model for the same pickaxe and bag
// (docs/phase-economy-calibration-20261029.md).
//   node tools/economy/measure-headless.mts [minutes per run] > artifacts/economy-measure/headless.json
// Each layer's own rock lies under its hall's floor (the walls at standing height belong to the layer above), and a
// 2 m step cannot be jumped (1.69 m), so a player mining a layer is in a pit: a full bag goes by the sell button (to
// the surface ring), on foot to the teleport station (world 1 over the bridge), a menu choice, the hall, and back down
// the pit along the way it came. The bot does that. In the layer it takes, of the cells of the layer above the dense
// rock it can see within reach, the nearest (its own level and above first); with none, it digs the cell under its
// feet, or walks to the nearest face on its level or just below. After each block it waits AIM seconds, the player's re-aim. A
// descent run digs straight down from the hall to the next layer instead, the pick held (no re-aim). Teleports land as soon as the terrain is in
// place here, so the public build's measured 0.2 s (sell button) and 0.8 s (station) are added, plus TAP for the
// button and UI seconds for the station's menu.
import { createHeadlessGame } from './headless.mts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { worldSpawn } from '../../src/game/content/worldJourney.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';
import { PINEWIND_BRIDGE } from '../../src/game/content/pinewind/hubLayout.ts';
import type { Coord } from '../../src/game/terrain/SparseWorld.ts';

const MINUTES = +(process.argv[2] ?? 15), AIM = +(process.env.AIM ?? .35), UI = +(process.env.UI ?? 1.5), TAP = .5;
const SOLD = .2, TELEPORT = .8;
const content = GAME_CONTENT.session;
type Plan = { world: 1 | 2 | 3; layer: number; tool: number; bag: number; mode: 'layer' | 'descent' };

function saveFor(p: Plan) {
  const d = new GameSession(content).exportProgress() as any;
  d.onboarding = { ...d.onboarding, status: 'skipped' };
  d.pickaxe = { version: 1, level: p.tool, enhance: 0 }; d.equipment = { ...d.equipment, toolLevel: p.tool, backpackCapacity: p.bag };
  d.inventory = { ...d.inventory, capacity: p.bag };
  d.worldProgress = { version: 2, openWorlds: [1, 2, 3].filter(w => w <= p.world) };
  for (const w of [1, 2, 3]) {
    const rooms = content.destinations.filter(r => r.worldId === w).slice(0, w < p.world ? 6 : p.layer);
    d.worldExploration[w] = { version: 1, maxDepth: rooms.at(-1)?.depth ?? 0, unlockedDestinationIds: rooms.map(r => r.id) };
  }
  d.exploration = d.worldExploration[1];
  return d;
}

async function play(p: Plan) {
  const g = await createHeadlessGame(saveFor(p));
  const s = () => g.session.getSnapshot() as any;
  const i = (p.world - 1) * 7 + p.layer, L = ECONOMY.layers[i], next = ECONOMY.layers[i + 1];
  const room = content.destinations.filter(r => r.worldId === p.world)[p.layer - 1];
  const station = content.stations!.find(x => x.worldId === p.world)!.zone;
  // the layer's own cells above its dense rock (cell y spans 2y..2y+2 m; its depth is the middle)
  const depth = (c: Coord) => -(2 * c[1] + 1), top = L.from, dense = L.deepAt == null ? Infinity : L.from + L.deepAt;
  const inLayer = (c: Coord) => depth(c) > top && depth(c) < (p.mode === 'descent' ? next.from + 2 : dense);
  g.player.travelTo(worldSpawn(p.world)); g.settle();
  g.run(1); g.session.travelTo(room.id); g.settle();
  const cellOf = (v: readonly number[]) => v.map(x => Math.floor(x / 2)) as Coord;
  const key = (c: Coord) => c.join(',');
  const bad = new Set<string>();
  const t = { swing: 0, aim: 0, walk: 0, sell: 0 };
  const start = g.clock.now, coins = () => s().coins as number, coins0 = coins();
  let blocks = 0, sells = 0, extra = 0;
  // what actually reached the bag (or the material store), by item
  const got: Record<string, number> = {};
  const stop = g.session.onOreCollected(batch => { for (const b of batch) got[b.itemId] = (got[b.itemId] ?? 0) + b.count; });
  const trail: [number, number, number][] = [[...g.feet()]];   // from the hall's arrival point, to retrace
  const note = () => { const f = g.feet(), last = trail.at(-1)!; if (Math.hypot(f[0] - last[0], f[2] - last[2]) > 1.5 || last[1] - f[1] > 1.5) trail.push([...f]); };
  /** Walk to a point (falls on the way are fine); gives up when it stops getting closer. */
  const walkTo = (to: readonly number[], near = .6, limit = 60, record = true) => {
    if (Math.hypot(g.feet()[0] - to[0], g.feet()[2] - to[2]) < near) return true;
    let best = Infinity, since = g.clock.now;
    g.run(limit, () => {
      const f = g.feet(), d = Math.hypot(f[0] - to[0], f[2] - to[2]);
      if (d < near) return true;
      if (d < best - .2) { best = d; since = g.clock.now; } else if (g.clock.now - since > 1.5) return true;
      g.walk(to); if (record) note();
    });
    g.walk(null); g.run(.15);
    return Math.hypot(g.feet()[0] - to[0], g.feet()[2] - to[2]) < near + .3;
  };
  /** World 1's creek is crossed on the bridge. */
  const route = (to: readonly number[]) => {
    const f = g.feet(), b = PINEWIND_BRIDGE, a = b.z - b.halfSpan - 1.5, c = b.z + b.halfSpan + 1.5;
    const crosses = p.world === 1 && Math.min(f[2], to[2]) < a && Math.max(f[2], to[2]) > c;
    return crosses ? (f[2] < to[2] ? [[b.x, 0, a], [b.x, 0, c], to] : [[b.x, 0, c], [b.x, 0, a], to]) : [to];
  };
  const surfaceWalk = (to: readonly number[]) => { for (const w of route(to)) walkTo(w, .8, 60, false); };
  const visible = () => {
    const f = g.feet(), h = cellOf([f[0], f[1] + .1, f[2]]), out: { c: Coord; d: number }[] = [];
    for (let dy = -2; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      const c: Coord = [h[0] + dx, h[1] + dy, h[2] + dz];
      if (bad.has(key(c)) || !inLayer(c) || !g.terrain.canMine(c) || !(g.terrain.cell(c)! > 0) || g.terrain.pending(c)) continue;
      const hit = g.select(c); if (!hit || key(hit) !== key(c)) continue;
      out.push({ c, d: Math.hypot(dx, dz) + (dy < 0 ? 6 - dy : dy * .5) });   // below the feet only when nothing else
    }
    return out.sort((a, b) => a.d - b.d);
  };
  const SIDES: Coord[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const exposed = (c: Coord) => SIDES.some(o => g.terrain.cell([c[0] + o[0], c[1] + o[1], c[2] + o[2]]) === 0);
  const below = () => { const f = g.feet(); return cellOf([f[0], f[1] - .1, f[2]]); };
  const nearestFace = () => {
    const f = g.feet(), h = cellOf([f[0], f[1] + .1, f[2]]);
    let best: Coord | null = null, bd = Infinity;
    // its own level, or the floor below it (a hall's pit starts one cell under its floor)
    for (let dy = 0; dy >= -2; dy--) for (let dx = -14; dx <= 14; dx++) for (let dz = -14; dz <= 14; dz++) {
      const c: Coord = [h[0] + dx, h[1] + dy, h[2] + dz];
      if (bad.has(key(c)) || !inLayer(c) || !g.terrain.canMine(c) || !(g.terrain.cell(c)! > 0) || !exposed(c)) continue;
      const d = Math.hypot(dx, dz) - dy * .1; if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  const mine = (c: Coord, aim = AIM) => {
    const a0 = g.clock.now; g.run(aim); t.aim += g.clock.now - a0;
    const b0 = g.clock.now;
    g.aim(c);
    const broke = g.run(30, () => { if (!(g.terrain.cell(c)! > 0) || g.terrain.pending(c)) return true; });
    g.aim(null);
    // a broken block waits for its terrain rebuild (a frame or two) before it is gone
    if (broke) g.run(1, () => g.terrain.cell(c) === 0); else bad.add(key(c));
    t.swing += g.clock.now - b0; note();
  };
  const sell = () => {
    const c0 = coins();
    extra += TAP + SOLD; g.session.goTo('sale'); g.settle(); g.run(.3);
    surfaceWalk([station.x, station.y, station.z]); g.run(.3);
    if (!s().atStation) return false;
    extra += UI + TELEPORT; g.session.travelTo(room.id); g.settle();
    // back the way it came; where the way drops, to the middle of the hole so it falls in
    for (const w of trail.slice(1)) walkTo(w, w[1] < g.feet()[1] - 1 ? .25 : .9, 20, false);
    sells++; return coins() > c0;
  };
  const end = start + MINUTES * 60;
  let reached = false;
  while (g.clock.now < end) {
    if (s().inventory.isFull) { const before = g.clock.now; if (!sell()) { console.error('sell failed', JSON.stringify(p), g.feet()); break; } t.sell += g.clock.now - before; continue; }
    if (p.mode === 'descent') {
      if (-g.feet()[1] >= next.from - .5) { reached = true; break; }
      // straight down, the pick held: while it falls it already strikes the next solid cell of the shaft (in reach)
      let c = below(); for (let k = 0; k < 4 && g.terrain.cell(c) === 0; k++) c = [c[0], c[1] - 1, c[2]];
      if (g.terrain.cell(c)! > 0 && g.terrain.canMine(c) && !bad.has(key(c)) && g.select(c)) { mine(c, 0); continue; }
      // the hole is under the feet's centre but the body still rests on the next cell: step over it
      const w0 = g.clock.now;
      if (g.terrain.cell(c) === 0) { walkTo([(c[0] + .5) * 2, g.feet()[1], (c[2] + .5) * 2], .25, 3); g.run(.1); t.walk += g.clock.now - w0; continue; }
      // standing on the hall's protected floor: over to its pit first
      const face = nearestFace(); if (!face) break;
      if (!walkTo([(face[0] + .5) * 2, g.feet()[1], (face[2] + .5) * 2], .9)) bad.add(key(face));
      t.walk += g.clock.now - w0; continue;
    }
    const pick = visible()[0];
    if (pick) { mine(pick.c); continue; }
    const under = below();
    if (inLayer(under) && g.terrain.canMine(under) && g.terrain.cell(under)! > 0 && !bad.has(key(under))) { mine(under); continue; }
    const face = nearestFace(); if (!face) break;
    const before = g.clock.now;
    // onto the face's column (from further off, the eye's ray meets the hall's protected floor ring first)
    if (!walkTo([(face[0] + .5) * 2, g.feet()[1], (face[2] + .5) * 2], .9) || !visible().length) bad.add(key(face));
    t.walk += g.clock.now - before;
  }
  const seconds = g.clock.now - start + extra, earned = coins() - coins0;
  stop(); g.dispose();
  blocks = Object.values(got).reduce((a, b) => a + b, 0);
  // the swing time the model gives the blocks actually mined (rock, ores, dense rock)
  const kinds = [L.rock, L.deep, ...L.ores, ...(p.mode === 'descent' ? [next.rock, next.deep, ...next.ores] : [])];
  const tool = ECONOMY.tools[p.tool - 1], swingOf = (hp: number) => Math.ceil(hp / tool.power) / tool.speed;
  const swings = Object.entries(got).reduce((a, [id, n]) => a + n * swingOf(kinds.find(k => k.itemId === id)?.hp ?? NaN), 0);
  const mix = Object.fromEntries(Object.entries(got).map(([id, n]) => [id, n]));
  const mined = Object.entries(got).reduce((a, [id, n]) => a + n * (kinds.find(k => k.itemId === id)?.price ?? NaN), 0);
  const trips = t.sell + extra;
  return { ...p, minutes: +(seconds / 60).toFixed(1), blocks, sells, earned, reached: p.mode === 'descent' ? reached : undefined,
    perHour: Math.round(mined / seconds * 3600), perBlock: +((t.swing + t.aim + t.walk) / blocks).toFixed(3),
    swingPerBlock: +(swings / blocks).toFixed(3), overheadPerBlock: +((t.swing + t.aim + t.walk - swings) / blocks).toFixed(3), mix,
    split: Object.fromEntries(Object.entries({ ...t, sell: trips }).map(([k, v]) => [k, +v.toFixed(1)])), sellTrip: +(trips / Math.max(1, sells)).toFixed(1) };
}

/** On foot across each world's surface, from where the sell, shop and egg buttons land the player to the teleport
 *  station (world 1 over the bridge): seconds, and the straight-line metres. */
async function surfaceWalks() {
  const out: Record<string, unknown>[] = [];
  for (const world of [1, 2, 3] as const) {
    const g = await createHeadlessGame(saveFor({ world, layer: 6, tool: world * 10, bag: 25, mode: 'layer' }));
    g.player.travelTo(worldSpawn(world)); g.settle(); g.run(1);
    const station = content.stations!.find(x => x.worldId === world)!.zone;
    const timed = (go: () => unknown) => {
      if (go() !== 'travelling') return null;
      g.settle(); g.run(.3);
      const from = g.feet(), t0 = g.clock.now, b = PINEWIND_BRIDGE, a = b.z - b.halfSpan - 1.5, c = b.z + b.halfSpan + 1.5;
      const way = world === 1 && from[2] < a && station.z > c ? [[b.x, 0, a], [b.x, 0, c]] : [];
      for (const w of [...way, [station.x, station.y, station.z]]) {
        let best = Infinity, since = g.clock.now;
        g.run(60, () => { const f = g.feet(), d = Math.hypot(f[0] - w[0], f[2] - w[2]); if (d < .8) return true; if (d < best - .2) { best = d; since = g.clock.now; } else if (g.clock.now - since > 1.5) return true; g.walk(w); });
      }
      g.walk(null);
      const ok = !!(g.session.getSnapshot() as any).atStation || Math.hypot(g.feet()[0] - station.x, g.feet()[2] - station.z) < 1.2;
      return { seconds: +(g.clock.now - t0).toFixed(1), metres: +Math.hypot(from[0] - station.x, from[2] - station.z).toFixed(1), ok };
    };
    const eggs = content.eggStations.filter(e => Math.abs(e.zone.z - worldSpawn(world)[2]) < 100).map(e => timed(() => g.session.goTo({ egg: e.eggId }))).filter(Boolean) as { seconds: number; metres: number; ok: boolean }[];
    out.push({ world, sale: timed(() => g.session.goTo('sale')), shop: timed(() => g.session.goTo('shop')),
      eggs: { count: eggs.length, ok: eggs.every(e => e.ok), seconds: +(eggs.reduce((a, e) => a + e.seconds, 0) / Math.max(1, eggs.length)).toFixed(1) } });
    g.dispose();
  }
  return out;
}

/** The model for the same layer, pickaxe and bag (no pets): its time per block, its trip, its income per hour; for a
 *  descent, its time down to the next layer (rock, then the dense rock, and a trip per bagful). */
function model(p: Plan, trip: number) {
  const l = ECONOMY.layers[(p.world - 1) * 7 + p.layer], tool = ECONOMY.tools[p.tool - 1];
  if (p.mode === 'descent') {
    const next = ECONOMY.layers[(p.world - 1) * 7 + p.layer + 1], n = (next.from - l.from) / 2, d = n - (l.deepAt ?? n * 2) / 2;
    const bt = (hp: number) => Math.ceil(hp / tool.power) / tool.speed + Math.max(0, .1 - 1 / tool.speed);
    const wt = l.ores.reduce((a, o) => a + o.weight, 0), c = l.oreChance;
    const mixed = [[l.rock, 1 - c], ...l.ores.map(o => [o, c * o.weight / wt] as const)].reduce((a, [x, q]) => a + (q as number) * bt((x as { hp: number }).hp), 0);
    const fall = (h: number) => h <= 28 * 28 / 48 ? Math.sqrt(2 * h / 24) : 28 / 24 + (h - 28 * 28 / 48) / 28;
    return { minutes: +(((n - d) * mixed + d * bt(l.deep.hp) + Math.ceil(n / p.bag) * (trip + fall(next.from - l.from) / 2)) / 60).toFixed(1), blocks: n };
  }
  const wt = l.ores.reduce((a, o) => a + o.weight, 0), c = l.oreChance;
  // as the model had it (swings + AIM), and as it has it now (AIM and MOVE overlap the wait for the next swing)
  let v = 0, before = 0, now = 0;
  for (const [x, q] of [[l.rock, 1 - c], ...l.ores.map(o => [o, c * o.weight / wt] as const)] as const) {
    const swings = Math.ceil(x.hp / tool.power) / tool.speed;
    v += q * x.price; before += q * (swings + AIM); now += q * (swings + Math.max(0, AIM + .1 - 1 / tool.speed));
  }
  return { perHour: Math.round(p.bag * v / (p.bag * now + trip) * 3600), perBlock: +now.toFixed(3), perBlockBefore: +before.toFixed(3) };
}

const only = process.env.ONLY?.split(',');
const plans: Plan[] = [
  { world: 1, layer: 1, tool: 2, bag: 35, mode: 'layer' }, { world: 1, layer: 4, tool: 6, bag: 60, mode: 'layer' },
  { world: 2, layer: 3, tool: 13, bag: 160, mode: 'layer' }, { world: 3, layer: 5, tool: 27, bag: 400, mode: 'layer' },
  { world: 1, layer: 1, tool: 3, bag: 35, mode: 'descent' }, { world: 2, layer: 3, tool: 14, bag: 160, mode: 'descent' },
].filter((_, k) => !only || only.includes(String(k)));
const results = [];
for (const p of plans) {
  const r = await play(p), m = model(p, r.sellTrip) as { perHour?: number; minutes?: number };
  const row = { ...r, model: m, ratio: +(p.mode === 'descent' ? m.minutes! / r.minutes : r.perHour / m.perHour!).toFixed(2) };
  results.push(row); console.error(JSON.stringify(row));
}
const surface = await surfaceWalks();
console.error(JSON.stringify(surface));
console.log(JSON.stringify({ aim: AIM, ui: UI, minutes: MINUTES, results, surface }, null, 1));
