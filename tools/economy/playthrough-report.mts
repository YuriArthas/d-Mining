// Sums up playthrough.mts runs against the economy model: minutes per world and per layer, the longest stretch
// without an improvement (a pickaxe, an enhancement, a backpack, a pet slot, a golden merge, a layer or a world).
//   node tools/economy/playthrough-report.mts artifacts/economy-playthrough/seed-*.json
import { readFileSync } from 'node:fs';

const IMPROVEMENTS = new Set(['tool', 'enh', 'bag', 'slot', 'golden', 'arrive', 'ticket']);
const median = (a: number[]) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const runs = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, 'utf8')));
for (const r of runs) {
  const times = r.events.filter((e: { type: string }) => IMPROVEMENTS.has(e.type)).map((e: { t: number }) => e.t);
  const gaps = times.slice(1).map((t: number, i: number) => t - times[i]).sort((a: number, b: number) => a - b);
  r.gaps = { longest: +(gaps.at(-1) ?? 0).toFixed(1), p90: +(gaps[Math.floor(gaps.length * .9)] ?? 0).toFixed(1) };
  console.log(`seed ${r.seed}: ${r.failure ? 'STUCK ' + r.failure : 'complete'} after ${r.simulatedHours} h (${r.wallSeconds} s)`);
  console.log(`  worlds (min)  bot ${r.worldMinutes.join(' / ')}   model ${r.modelWorldMinutes.join(' / ')}`);
  console.log(`  layers (min)  bot   ${r.layerMinutes.join(' ')}`);
  console.log(`                model ${r.modelLayerMinutes.join(' ')}`);
  console.log(`  longest without an improvement ${r.gaps.longest} min, 90 % within ${r.gaps.p90} min; ${JSON.stringify(r.counts)}`);
}
if (runs.length > 1) {
  const w = (i: number, key: string) => median(runs.map(r => r[key][i]));
  console.log(`median worlds (min): bot ${[0, 1, 2].map(i => w(i, 'worldMinutes')).join(' / ')}   model ${[0, 1, 2].map(i => w(i, 'modelWorldMinutes')).join(' / ')}`);
}
