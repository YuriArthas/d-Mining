import { ECONOMY as E } from '../../src/game/content/economy.ts';
// The way down dug as a player digs it, not as one shaft (2026-10-31). rush.mts digs only the block under the feet, a
// one-block shaft; the user, digging world 1's first layer, was still above the cap's end after ten minutes. Here the
// bot clears an N×N hole level by level (always the highest blocks left in it, as a player digging down around
// themselves does) from the surface pit to the first hall; with the pickaxe a new player has and with the one the cap
// recommends. On the game's own logic, no rendering (headless.mts).
//   node tools/economy/rush-wide.mts [sizes=1,2,3] [levels=1,2]
import { createHeadlessGame } from './headless.mts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { worldSpawn } from '../../src/game/content/worldJourney.ts';
import type { Coord } from '../../src/game/terrain/SparseWorld.ts';

const content = GAME_CONTENT.session;
/** A layer's cap block (kinds 64 + 4 × layer + 1). */
const isCap = (kind: number) => kind >= 64 && (kind - 64) % 4 === 1;
const sizes = (process.argv[2] ?? '1,2,3').split(',').map(Number), levels = (process.argv[3] ?? '1,2').split(',').map(Number);

async function dig(size: number, level: number) {
  const d = new GameSession(content).exportProgress() as any;
  d.onboarding = { ...d.onboarding, status: 'skipped' };
  d.pickaxe = { version: 1, level, enhance: 0 }; d.equipment = { ...d.equipment, toolLevel: level, backpackTier: E.bags.at(-1)!.tier, equippedBackpackTier: E.bags.at(-1)!.tier };
  d.inventory = { ...d.inventory, capacity: E.bags.at(-1)!.capacity };
  const g = await createHeadlessGame(d);
  const reached = () => g.session.devUnlocks()[0].layers.filter(l => l.unlocked).length;
  g.player.travelTo(worldSpawn(1)); g.settle();
  g.player.travelTo([1, .1, 1]); g.settle();
  const cellOf = (v: readonly number[]) => v.map(x => Math.floor(x / 2)) as Coord;
  const solid = (c: Coord) => g.terrain.canMine(c) && g.terrain.cell(c)! > 0 && !g.terrain.pending(c);
  // The hole: N×N columns from the cell under the feet (the middle of the surface pit).
  const f0 = g.feet(), top = cellOf([f0[0], f0[1] - .1, f0[2]]);
  const columns: [number, number][] = [];
  for (let dx = 0; dx < size; dx++) for (let dz = 0; dz < size; dz++) columns.push([top[0] + dx, top[2] + dz]);
  const start = g.clock.now, limit = +(process.env.LIMIT ?? 3600), mined = new Map<string, number>();
  let report = start;
  let capAt: number | null = null;
  const done = g.run(limit, () => {
    if (reached() > 0) return true;
    const f = g.feet(), feet = cellOf([f[0], f[1] - .1, f[2]]);
    if (process.env.TRACE && g.clock.now - report >= 60) { report = g.clock.now; console.error(`  ${size}×${size} Lv${level} ${Math.round((g.clock.now - start) / 60)} min: feet ${f.map(v => v.toFixed(1))}, ${mined.size} blocks`); }
    // The highest blocks left in the hole, down to the one under the feet.
    let target: Coord | null = null;
    for (let y = top[1]; y >= feet[1] - 1 && !target; y--) {
      const left = columns.map(([x, z]) => [x, y, z] as Coord).filter(solid);
      if (left.length) target = left.sort((a, b) => Math.hypot(a[0] * 2 + 1 - f[0], a[2] * 2 + 1 - f[2]) - Math.hypot(b[0] * 2 + 1 - f[0], b[2] * 2 + 1 - f[2]))[0];
    }
    if (!target) { g.aim(null); return; }
    const kind = g.terrain.cell(target)!;
    if (capAt === null && isCap(kind)) capAt = g.clock.now;
    if (g.select(target)) { g.walk(null); g.aim(target); mined.set(target.join(), kind); return; }
    // Out of reach of a straight look: step toward it.
    g.aim(null); g.walk([(target[0] + .5) * 2, f[1], (target[2] + .5) * 2]);
  });
  const seconds = g.clock.now - start, capCells = [...mined.values()].filter(isCap).length;
  g.dispose();
  return { size, level, minutes: done ? +(seconds / 60).toFixed(1) : null, capMinutes: done && capAt !== null ? +((g.clock.now - capAt) / 60).toFixed(1) : null, cells: mined.size, capCells };
}

const rows = [];
for (const size of sizes) for (const level of levels) { const row = await dig(size, level); rows.push(row); console.error(JSON.stringify(row)); }
console.log(JSON.stringify(rows, null, 1));
