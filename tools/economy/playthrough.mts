// The whole journey on the game's own logic, no rendering (headless.mts; docs/phase-playthrough-20261029.md): a bot
// starts a new save and plays to the end of world 3 the way the economy model's typical player does (model.mts
// `simulate`): it mines the deepest layer it has reached, in the pit under its hall (the surface pit on layer 0),
// sells a full bag by the sell button and comes back by the station; after each sale it buys the cheapest thing it
// wants and can pay for (this layer's eggs up to plan.json's pulls, the next pickaxe once its shop is open, an
// enhancement, a pet slot), a backpack sized for 45 seconds of mining, claims the reward page's lucky coins and
// spins them at the capsule (at once in world 1, from later worlds once seven have gathered). With this layer's eggs
// pulled and the pickaxe the next layer asks for, it digs down to the next hall; on layer 6 it pays the ticket at
// the portal (mining missing ticket minerals where they are found first) and goes on. Human time is waited out:
// AIM per block (the swing cadence is the game's), UI per menu choice, HATCH per pull, the measured teleports.
// It reports when each layer and world is reached against the model, every purchase, and where it got stuck.
//   SEED=1 HOURS=20 node tools/economy/playthrough.mts [out.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHeadlessGame } from './headless.mts';
import { loadPlan, simulate, loadEconomy, local, world as worldOf } from './model.mts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { ECONOMY as E } from '../../src/game/content/economy.ts';
import { worldPortal, worldRequirement, worldSpawn, type WorldId } from '../../src/game/content/worldJourney.ts';
import { ONLINE_REWARD_MINUTES } from '../../src/game/content/rewards.ts';
import { guideRoute } from '../../src/game/world/guideRoute.ts';
import type { Coord } from '../../src/game/terrain/SparseWorld.ts';

const SEED = +(process.env.SEED ?? 1), HOURS = +(process.env.HOURS ?? 20), OUT = process.argv[2] ?? `artifacts/economy-playthrough/seed-${SEED}.json`;
const AIM = .35, UI = 1.5, TAP = .5, SOLD = .2, TELEPORT = .8, HATCH = 2, DAY = 120 * 60;
const content = GAME_CONTENT.session, plan = loadPlan();
let seed = SEED * 7919 + 13; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** Reward days: one every two hours played (YYYY-MM-DD). */
const dayOf = (now: number) => new Date(Date.UTC(2026, 10, 1 + Math.floor(now / DAY))).toISOString().slice(0, 10);

const start = new GameSession(content).exportProgress() as any;
start.onboarding = { ...start.onboarding, status: 'skipped' };
// START=2|3 (finding where the bot gets stuck in a later world without replaying the earlier ones): that world open,
// the pickaxe and backpack an earlier world ends with, no pets. Not a measurement.
const FIRST = +(process.env.START ?? 1) as 1 | 2 | 3;
if (FIRST > 1) {
  const level = (FIRST - 1) * 10, bag = E.bags[(FIRST - 1) * 10 - 1];
  start.worldProgress = { version: 2, openWorlds: [1, 2, 3].filter(w => w <= FIRST) };
  start.pickaxe = { version: 1, level, enhance: 0 }; start.equipment = { ...start.equipment, toolLevel: level, backpackTier: bag.tier, equippedBackpackTier: bag.tier };
  start.inventory = { ...start.inventory, capacity: bag.capacity };
  for (let w = 1; w < FIRST; w++) { const rooms = content.destinations.filter(d => d.worldId === w); start.worldExploration[w] = { version: 1, maxDepth: rooms.at(-1)!.depth, unlockedDestinationIds: rooms.map(r => r.id) }; }
  start.exploration = start.worldExploration[1];
}
const g = await createHeadlessGame(start, { random: rnd, day: dayOf });
const s = () => g.session.getSnapshot() as any;
// The world tickets' minerals locked from the start, as a player saving them for the next world does (2026-10-31:
// nothing is kept unless locked); each unlocks once the store has all of it, and the rest sells.
for (const w of E.worlds) for (const m of w.ticket?.materials ?? []) g.session.lockItem(m.itemId);
const events: { t: number; type: string; [k: string]: unknown }[] = [];
const log = (type: string, detail: Record<string, unknown> = {}) => { const e = { t: +(g.clock.now / 60).toFixed(2), type, ...detail }; events.push(e); if (process.env.TRACE) console.error(JSON.stringify(e)); };
const minutes = () => g.clock.now / 60;
// Where the time goes, per world: mining (and stepping between faces), trips (to a site, back down its trail),
// selling, shopping, hatching, rewards (and the capsule), descending, tickets (portals, farming).
const spent: Record<string, number>[] = [{}, {}, {}];
let doing = 'other', since = 0;
const account = () => { const w = (s().currentWorld as number) - 1, t = g.clock.now - since; spent[w][doing] = (spent[w][doing] ?? 0) + t; since = g.clock.now; };
function timed<T>(what: string, fn: () => T): T { account(); const before = doing; doing = what; try { return fn(); } finally { account(); doing = before; } }
let lastProgress = 0;
const progressed = () => { lastProgress = g.clock.now; };

// ---- where things are -----------------------------------------------------------------------------------------
const halls = (w: number) => content.destinations.filter(d => d.worldId === w);
const reached = (w: number) => g.session.devUnlocks()[w - 1].layers.filter(l => l.unlocked).length;   // 0..6
const layerOf = (w: number, k: number) => E.layers[(w - 1) * 7 + k];
const exitLevel = (w: number, k: number) => k < 6 ? layerOf(w, k + 1).gate : w < 3 ? E.worlds[w].ticket!.toolLevel : E.rebirth.toolLevel;
const currency = (w: number) => E.currencies[w - 1].id;
const balance = (c: string) => s().balances[c] as number;
const worldZ = (w: number) => worldRequirement(w as WorldId).z;
const station = (w: number) => content.stations!.find(x => x.worldId === w)!.zone;
const pitEntrance = (w: number): Coord => [0, .1, worldZ(w) + 10];
const onSurface = () => g.feet()[1] > -1.5;

// ---- moving -----------------------------------------------------------------------------------------------------
const cellOf = (v: readonly number[]) => v.map(x => Math.floor(x / 2)) as Coord;
const key = (c: Coord) => c.join(',');
let trail: [number, number, number][] = [], site = '';
const note = () => { const f = g.feet(), last = trail.at(-1); if (!last || Math.hypot(f[0] - last[0], f[2] - last[2]) > 1.5 || last[1] - f[1] > 1.5) trail.push([...f]); };
function walkTo(to: readonly number[], near = .6, limit = 60, record = false) {
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
}
/** On a world's surface, on foot (world 1's creek by its bridge). */
function surfaceWalk(to: readonly number[], near = .8) {
  const way = world() === 1 ? guideRoute(g.feet(), to).slice(1) : [[to[0], to[2]] as const];
  let ok = true; for (const [x, z] of way) ok = walkTo([x, 0, z], near, 90) && ok; return ok;
}
const wait = (seconds: number) => g.run(seconds);
const world = () => s().currentWorld as 1 | 2 | 3;
function teleported(result: unknown) { if (result !== 'travelling') return false; wait(TELEPORT); g.settle(); return true; }
function toSurface() { if (onSurface() && !g.travelling) return; wait(TAP); g.session.returnToSurface(); teleported('travelling'); }
function toWorld(w: 1 | 2 | 3) {
  if (world() === w) return true;
  toSurface(); surfaceWalk([worldPortal(world()).zone.x, 0, worldPortal(world()).zone.z], 1);
  wait(UI); const ok = teleported(g.session.travelWorld(w));
  if (ok) log('portal', { to: w }); return ok && world() === w;
}

// ---- mining -----------------------------------------------------------------------------------------------------
const SIDES: Coord[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// Above ground the terrain holds no cells outside world 1's mine area (null): that is air too.
const air = (c: Coord) => { const v = g.terrain.cell(c); return v === 0 || (v === null && c[1] >= 0); };
const exposed = (c: Coord) => SIDES.some(o => air([c[0] + o[0], c[1] + o[1], c[2] + o[2]]));
const solid = (c: Coord) => g.terrain.canMine(c) && g.terrain.cell(c)! > 0 && !g.terrain.pending(c);
const bad = new Set<string>();
const depthOf = (c: Coord) => -(2 * c[1] + 1);
let failures = 0;
function mine(c: Coord, aim = AIM) {
  wait(aim);
  g.aim(c);
  const broke = g.run(20, () => !(g.terrain.cell(c)! > 0) || g.terrain.pending(c));
  g.aim(null);
  if (broke) { g.run(1, () => g.terrain.cell(c) === 0); progressed(); failures = 0; } else { bad.add(key(c)); failures++; }
  note();
}
function visible(inLayer: (c: Coord) => boolean) {
  const f = g.feet(), h = cellOf([f[0], f[1] + .1, f[2]]);
  let best: Coord | null = null, bd = Infinity;
  for (let dy = -2; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
    const c: Coord = [h[0] + dx, h[1] + dy, h[2] + dz];
    if (bad.has(key(c)) || !inLayer(c) || !solid(c)) continue;
    const d = Math.hypot(dx, dz) + (dy < 0 ? 6 - dy : dy * .5);
    if (d >= bd) continue;
    const hit = g.select(c); if (!hit || key(hit) !== key(c)) continue;
    best = c; bd = d;
  }
  return best;
}
/** The nearest face of the layer the bot can get to: on its level, touching the air; or below it, at the bottom of
 *  an open column (the pit it has dug: walking over it drops the bot in; a cave under rock does not count). */
function nearestFace(inLayer: (c: Coord) => boolean) {
  const f = g.feet(), h = cellOf([f[0], f[1] + .1, f[2]]);
  const openAbove = (c: Coord) => { for (let y = c[1] + 1; y <= h[1]; y++) if (!air([c[0], y, c[2]])) return false; return true; };
  let best: Coord | null = null, bd = Infinity;
  for (let dy = 0; dy >= -24; dy--) {
    for (let dx = -14; dx <= 14; dx++) for (let dz = -14; dz <= 14; dz++) {
      const c: Coord = [h[0] + dx, h[1] + dy, h[2] + dz];
      if (bad.has(key(c)) || !inLayer(c) || !solid(c) || !(dy === 0 ? exposed(c) : openAbove(c))) continue;
      const d = Math.hypot(dx, dz) - dy * .5; if (d < bd) { bd = d; best = c; }
    }
    if (best && dy <= -2) break;
  }
  return best;
}
const below = (): Coord => { const f = g.feet(); return cellOf([f[0], f[1] - .1, f[2]]); };
/** One step of mining a layer's own rock (above its dense rock) where the bot stands; false when nothing is left. */
function mineStep(w: number, k: number) {
  const L = layerOf(w, k), top = L.from, dense = L.deepAt == null ? Infinity : L.from + L.deepAt;
  const inLayer = (c: Coord) => depthOf(c) > top && depthOf(c) < dense;
  const pick = visible(inLayer);
  if (pick) { mine(pick); return true; }
  const under = below();
  if (inLayer(under) && solid(under) && !bad.has(key(under))) { mine(under); return true; }
  const face = nearestFace(inLayer); if (!face) return false;
  if (!walkTo([(face[0] + .5) * 2, g.feet()[1], (face[2] + .5) * 2], .9, 20, true) || !visible(inLayer)) bad.add(key(face));
  return true;
}
/** Down a hole of 2×2 columns, as a player digs down around themselves (2026-10-31: one block's shaft had a quarter of
 *  the blocks and set the caps four times too hard): the highest blocks left in it first, down to the one under the
 *  feet. The hole is fixed where the descent of a layer starts. */
let hole: { site: string; columns: [number, number][] } | null = null;
function digDownStep(until: number) {
  if (-g.feet()[1] >= until - .5) return false;
  const under = below();
  if (hole?.site !== site) hole = { site, columns: [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dz]) => [under[0] + dx, under[2] + dz]) };
  for (let y = under[1] + 1; y >= under[1] - 1; y--) {
    const left = hole.columns.map(([x, z]) => [x, y, z] as Coord).filter(c => solid(c) && !bad.has(key(c)) && depthOf(c) < until);
    if (!left.length) continue;
    const f = g.feet(), c = left.sort((a, b) => Math.hypot(a[0] * 2 + 1 - f[0], a[2] * 2 + 1 - f[2]) - Math.hypot(b[0] * 2 + 1 - f[0], b[2] * 2 + 1 - f[2]))[0];
    if (g.select(c)) { mine(c, c[1] < under[1] + 1 && c[0] === under[0] && c[2] === under[2] ? 0 : AIM); return true; }
    if (walkTo([(c[0] + .5) * 2, f[1], (c[2] + .5) * 2], .4, 3) && g.select(c)) return true;
    bad.add(key(c)); return true;
  }
  let c = under; for (let k = 0; k < 4 && air(c); k++) c = [c[0], c[1] - 1, c[2]];
  if (solid(c) && !bad.has(key(c)) && g.select(c)) { mine(c, 0); return true; }
  if (air(c)) { walkTo([(c[0] + .5) * 2, g.feet()[1], (c[2] + .5) * 2], .25, 3); wait(.1); return true; }
  // on a protected floor: over to the pit first
  const L = { from: -Infinity };
  const face = nearestFace(c2 => depthOf(c2) > L.from && depthOf(c2) < until + 2); if (!face) return false;
  if (!walkTo([(face[0] + .5) * 2, g.feet()[1], (face[2] + .5) * 2], .9, 20, true)) bad.add(key(face));
  return true;
}

/** To where layer k of world w is mined: its hall (by the station) or the surface pit, then back down its trail. */
function toSite(w: 1 | 2 | 3, k: number) { return timed('trip', () => toSiteNow(w, k)); }
function toSiteNow(w: 1 | 2 | 3, k: number) {
  if (!toWorld(w)) return false;
  const id = `${w}:${k}`;
  if (id !== site) { site = id; trail = []; }
  if (k === 0) {
    toSurface(); surfaceWalk(pitEntrance(w), .9);
  } else {
    // Portable travel works directly from the nearest sale floor.
    wait(UI); if (!teleported(g.session.travelTo(halls(w)[k - 1].id))) return false;
  }
  if (!trail.length) trail.push([...g.feet()]);
  for (const p of trail.slice(1)) walkTo(p, p[1] < g.feet()[1] - 1 ? .25 : .9, 20, false);
  return true;
}

// ---- selling, rewards, shopping -----------------------------------------------------------------------------------
function sell() { return timed('sell', sellNow); }
function sellNow() {
  wait(TAP + SOLD); const before = balance(currency(world()));
  if (!teleported(g.session.goTo('sale'))) return false;
  wait(.3); log('sell', { coins: balance(currency(world())) - before });
  return true;
}
function rewards() { timed('rewards', rewardsNow); }
function rewardsNow() {
  g.session.claimDailyReward();
  for (const m of ONLINE_REWARD_MINUTES) g.session.claimOnlineReward(m as never);
  const lucky = () => s().rewards.balance as number, w = world();
  if (!lucky() || (w > 1 && lucky() < 7)) return;
  if (w > 1 && !toWorld(1)) return;
  if (teleported(g.session.goTo('capsule'))) {
    while (lucky() > 0) { wait(UI); const r = g.session.spinCapsule() as any; if (r.status !== 'spun') break; log('spin', { prize: r.reward, coins: r.coinReward }); }
  }
  if (w > 1) toWorld(w);
}
const hatched = E.eggs.map(() => 0);
const target = (j: number) => Math.max(1, Math.round(plan.pulls[j]));
const wantEgg = (j: number, w: number, k: number) => { const e = E.eggs[j]; return e.world === w && e.layer <= k && hatched[j] < target(j) && (e.layer === k || e.premium); };
function equipBest() {
  const pets = g.session.pets.getSnapshot() as any;
  for (const card of pets.pets) if (!card.golden && card.mergeable >= pets.goldenNeed) { if ((g.session.pets.mergeGolden(card.pet.speciesId) as any).status === 'merged') { log('golden', { species: card.pet.speciesId }); return equipBest(); } }
  g.session.pets.equipBest();
}
/** Match model.mts: buy enough carry time, or the largest currently available shelf bag. */
function wantedBag(w:number,k:number) {
  const state=s(),l=E.layers[(w-1)*7+k],stats=state.miningStats,cap=state.inventory.capacity;
  const wt=l.ores.reduce((a,o)=>a+o.weight,0);let time=0,volume=0;
  for(const [b,q] of [[l.rock,1-l.oreChance],...l.ores.map(o=>[o,l.oreChance*o.weight/wt] as const)] as const){
    time+=q*(Math.ceil(b.hp/stats.power)/stats.speed+Math.max(0,AIM+.1-1/stats.speed));volume+=q*b.volume;
  }
  if(Math.ceil(cap/volume)*time>=35&&cap>=2*l.deep.volume)return null;
  const target=Math.max(volume*45/time,2*l.deep.volume),offers=state.shopCatalog.backpacks.filter((b:any)=>b.capacity>state.equipment.backpackCapacity&&b.world===w&&b.shop<=k);
  return offers.find((b:any)=>b.capacity>=target)??offers.at(-1)??null;
}
/** The model's buying round: the cheapest wanted thing it can pay for, again and again; including a needed backpack. */
function shop() { timed('shop', shopNow); }
function shopNow() {
  const w = world(), k = reached(w), c = currency(w);
  for (let round = 0; round < 200; round++) {
    const lv = s().equipment.toolLevel, enh = s().equipment.enhance, tools = s().shopCatalog.tools;
    const opts: [string, number, number][] = [];
    const bag=wantedBag(w,k);if(bag)opts.push(['bag',bag.price,bag.level]);
    E.eggs.forEach((e, j) => { if (wantEgg(j, w, k)) opts.push(['egg', e.price, j]); });
    if (lv < exitLevel(w, k) && E.tools[lv].shop <= k && E.tools[lv].currency === c) opts.push(['tool', E.tools[lv].price, 0]);
    const step = E.tools[lv - 1].enhance[enh]; if (step && E.tools[lv - 1].currency === c) opts.push(['enh', step.price, 0]);
    const slot = s().petSlot; if (slot?.unlocked && slot.currency === c) opts.push(['slot', slot.price, 0]);
    const ok = opts.filter(o => o[1] <= balance(c)).sort((a, b) => a[1] - b[1]);
    if (!ok.length) break;
    const [what, price, j] = ok[0];
    let done = false;
    if (what === 'egg') {
      const egg = E.eggs[j];
      done = timed('hatch', () => {
        if (s().eggId !== egg.id) teleported(g.session.goTo({ egg: egg.id! }));
        wait(HATCH); const r = g.session.pets.hatch(egg.id!) as any;
        if (r.status !== 'hatched') return false;
        hatched[j]++; log('egg', { egg: egg.id, n: hatched[j], price }); equipBest(); return true;
      });
    } else if(what==='bag') {
      const trip=g.session.goToShop('backpacks','furthest');if(trip==='travelling')teleported(trip);wait(UI);
      const result=g.session.useShopItem('backpacks',bag!.id);done=result.status==='upgraded';
      if(done)log('bag',{capacity:bag!.capacity,price});
    } else if (what === 'tool' || what === 'enh') {
      const trip = g.session.goToShop('tools', what === 'tool' ? 'next' : 'furthest'); if (trip === 'travelling') teleported(trip);
      wait(UI);
      const r = what === 'tool' ? g.session.useShopItem('tools', tools[lv].id) as any : g.session.enhancePickaxe(lv, enh) as any;
      done = r.status === 'upgraded' || r.status === 'enhanced';
      if (done) log(what, { level: s().equipment.toolLevel, enhance: s().equipment.enhance, price });
    } else {
      wait(UI); const r = g.session.buyPetSlot(s().pets?.slots?.length ?? (g.session.pets.getSnapshot() as any).slots.length) as any;
      done = r.status === 'bought'; if (done) { log('slot', { slots: r.slots, price }); equipBest(); }
    }
    if (!done) { log('buy-failed', { what, price }); break; }
    progressed();
  }

}
/** What the player saves up for next (the model's `want`): the cheapest of the wanted things. */
function need(w: number, k: number) {
  const c = currency(w), lv = s().equipment.toolLevel, enh = s().equipment.enhance, prices: number[] = [];
  E.eggs.forEach((e, j) => { if (wantEgg(j, w, k)) prices.push(e.price); });
  if (lv < exitLevel(w, k) && E.tools[lv].shop <= k) prices.push(E.tools[lv].price);
  const step = E.tools[lv - 1].enhance[enh]; if (step) prices.push(step.price);
  const bag=wantedBag(w,k);if(bag)prices.push(bag.price);
  if (k === 6 && w < 3) prices.push(E.worlds[w].ticket!.price);
  return prices.length ? Math.min(...prices) - balance(c) : 0;
}

// ---- the journey --------------------------------------------------------------------------------------------------
const arrive: number[] = Array.from({ length: (FIRST - 1) * 7 + 1 }, () => 0);
let lastLayer = (FIRST - 1) * 7;
const noteArrivals = () => {
  const total = [1, 2, 3].reduce((n, w) => n + (w < world() ? 7 : w === world() ? reached(w) + 1 : 0), 0) - 1;
  while (lastLayer < total) { lastLayer++; arrive.push(g.clock.now); log('arrive', { layer: lastLayer, world: worldOf(lastLayer) + 1, local: local(lastLayer) }); progressed(); }
};
/** Mine layer k of world w until the bag is full or what is saved up for is paid (at least five blocks). */
function mineBag(w: 1 | 2 | 3, k: number) { return timed('mine', () => mineBagNow(w, k)); }
function mineBagNow(w: 1 | 2 | 3, k: number) {
  if (!toSite(w, k)) return false;
  const wanted = need(w, k); let mined = 0;
  while (!s().inventory.isFull && (mined < 5 || (s().sale?.coins ?? 0) < wanted)) { if (!mineStep(w, k) || failures > 30) return false; mined++; if (g.clock.now - lastProgress > 300) return false; }
  return true;
}
function descend(w: 1 | 2 | 3, k: number) { return timed('descend', () => descendNow(w, k)); }
function descendNow(w: 1 | 2 | 3, k: number) {
  if (!toSite(w, k)) return false;
  const until = layerOf(w, k + 1).from;
  while (reached(w) <= k) {
    if (s().inventory.isFull) { sell(); rewards(); shop(); if (!toSite(w, k)) return false; continue; }
    if (!digDownStep(until)) {
      // down in the hall but not on its floor yet (on a prop, say): over to where the hall is entered
      const spawn = halls(w)[k].spawn; walkTo([spawn[0], spawn[1], spawn[2]], .6, 20); wait(.5);
      break;
    }
    if (g.clock.now - lastProgress > 300) return false;
  }
  noteArrivals();
  return reached(w) > k;
}
/** Ticket minerals the next world still lacks, mined where they are found. */
function farmTicket(w: number) {
  for (const m of E.worlds[w].ticket!.materials) {
    const owned = () => (s().materials as any[]).find(x => x.itemId === m.itemId)?.stored ?? 0;
    if (owned() >= m.count) continue;
    log('farm', { item: m.itemId, owned: owned(), need: m.count });
    while (owned() < m.count) {
      if (!mineBag(m.world as 1 | 2 | 3, m.layer)) return false;
      sell(); rewards(); shop();
      if (minutes() > HOURS * 60) return false;
    }
  }
  return toWorld(w as 1 | 2 | 3);
}
function ticket(w: 1 | 2 | 3) { return timed('ticket', () => ticketNow(w)); }
function ticketNow(w: 1 | 2 | 3) {
  if (!farmTicket(w)) return false;
  toSurface(); const p = worldPortal(w).zone; surfaceWalk([p.x, 0, p.z], 1);
  wait(UI); const r = g.session.unlockWorld((w + 1) as WorldId) as any;
  if (r.status !== 'opened' && r.status !== 'already-open') { log('ticket-failed', { status: r.status }); return false; }
  log('ticket', { world: w + 1 });
  if (!toWorld((w + 1) as 1 | 2 | 3)) return false;
  noteArrivals(); return true;
}

let failure: string | null = null;
const wall = Date.now();
try {
  g.player.travelTo(worldSpawn(FIRST)); g.settle();
  while (minutes() < HOURS * 60) {
    noteArrivals();
    const w = world(), k = reached(w), lv = s().equipment.toolLevel;
    const eggsDone = E.eggs.every((e, j) => !(e.world === w && e.layer === k) || hatched[j] >= target(j));
    const slot = s().petSlot, slotDone = !slot || !slot.unlocked || slot.currency !== currency(w);
    if (eggsDone && lv >= exitLevel(w, k) && slotDone) {
      if (w === 3 && k === 6) { log('journey-complete', { rebirthReady: s().rebirth.ready }); break; }
      if (k < 6) { if (!descend(w, k)) throw Error(`stuck descending world ${w} layer ${k}`); continue; }
      if (balance(currency(w)) >= E.worlds[w].ticket!.price) { if (!ticket(w)) throw Error(`stuck at world ${w}'s ticket`); continue; }
    }
    if (!mineBag(w, k)) throw Error(`stuck mining world ${w} layer ${k}`);
    sell(); rewards(); shop();
    if (g.clock.now - lastProgress > 600) throw Error('no progress for 10 minutes');
  }
} catch (error) { failure = String((error as Error).message ?? error); log('stuck', { failure, feet: g.feet(), snapshot: { world: world(), layer: reached(world()), tool: s().equipment.toolLevel, coins: s().balances, bag: s().inventory.used } }); }

// ---- report ---------------------------------------------------------------------------------------------------------
account();
const model = simulate(loadEconomy(), plan, SEED);
const worlds = [1, 2, 3].map(w => arrive[w * 7] != null || (w === 3 && events.some(e => e.type === 'journey-complete'))
  ? +(((w === 3 ? (events.find(e => e.type === 'journey-complete')?.t ?? NaN) * 60 : arrive[w * 7]) - arrive[(w - 1) * 7]) / 60).toFixed(1) : null);
const result = {
  seed: SEED, failure, simulatedHours: +(g.clock.now / 3600).toFixed(2), wallSeconds: Math.round((Date.now() - wall) / 1000),
  worldMinutes: worlds, modelWorldMinutes: [1, 2, 3].map(w => +(((model.arrive[w * 7] ?? NaN) - model.arrive[(w - 1) * 7]) / 60).toFixed(1)),
  layerMinutes: arrive.map(t => +(t / 60).toFixed(1)), modelLayerMinutes: model.arrive.map(t => +(t / 60).toFixed(1)),
  spentMinutes: spent.map(x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, +(v / 60).toFixed(1)]))),
  modelSpentMinutes: model.spent.map((x: Record<string, number>) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, +(v / 60).toFixed(1)]))),
  counts: Object.fromEntries([...new Set(events.map(e => e.type))].map(t => [t, events.filter(e => e.type === t).length])),
  events,
};
mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ seed: SEED, failure, simulatedHours: result.simulatedHours, wallSeconds: result.wallSeconds, worldMinutes: worlds, modelWorldMinutes: result.modelWorldMinutes, counts: result.counts }));
g.dispose();
