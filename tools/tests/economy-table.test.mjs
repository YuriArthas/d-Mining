import test from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY, isRound, validateEconomy } from '../../src/game/content/economy.ts';
import { loadPlan, simulate } from '../economy/model.mts';

test('the model plays a typical player through economy.json, hand edits included, to the end of world 3', () => {
  const run = simulate(JSON.parse(JSON.stringify(ECONOMY)), loadPlan(), 1);
  assert.equal(run.arrive.length, 22, 'every layer of the three worlds reached');
  const minutes = w => (run.arrive[w * 7] - run.arrive[(w - 1) * 7]) / 60;
  for (const [w, target] of [[1, 120], [2, 240], [3, 360]]) assert.ok(Math.abs(minutes(w) / target - 1) < .15, `world ${w}: ${minutes(w).toFixed(0)} min`);
});

test('numbers a player sees are round: at most two significant figures', () => {
  for (const [value, round] of [[0, true], [99, true], [480, true], [450, true], [468, false], [12000, true], [12300, false]]) assert.equal(isRound(value), round, String(value));
});

test('the load check refuses broken tables: odd prices, falling prices, wrong currencies, a falling gate', () => {
  const broken = [
    e => { e.tools[3].price = 468; },
    e => { e.tools[4].price = e.tools[3].price - 10; },
    e => { e.bags[12].currency = 'gold'; },
    e => { e.eggs[0].currency = 'tech'; },
    e => { e.layers[4].gate = 1; },
    e => { e.layers[2].deepAt = 999; },
    e => { e.worlds[2].ticket.currency = 'gold'; },
    e => { e.worlds[1].ticket.materials[0].world = 2; },
    e => { e.tools[20].speed = 9; },
  ];
  assert.doesNotThrow(() => validateEconomy(structuredClone(ECONOMY)));
  for (const change of broken) { const e = structuredClone(ECONOMY); change(e); assert.throws(() => validateEconomy(e), /economy\.json/); }
});

test('the design holds: a currency per world, a gate on every layer, speed capped at 4×, pets ×2.5 per layer', () => {
  assert.deepEqual(ECONOMY.currencies.map(c => c.name), ['金币', '科技币', '星晶']);
  assert.deepEqual(ECONOMY.worlds.map(w => w.ticket?.toolLevel ?? null), [null, 10, 20]);
  assert.equal(Math.max(...ECONOMY.tools.map(t => t.speed)), 4 * ECONOMY.tools[0].speed);
  for (const w of [1, 2, 3]) {
    const base = ECONOMY.eggs.filter(e => e.world === w && !e.premium).map(e => e.pets[0].bonusPct);
    for (let i = 1; i < base.length; i++) assert.ok(Math.abs(base[i] / base[i - 1] - 2.5) < .2, `world ${w} layer ${i}`);
  }
  // World 1's first rest layers are shallow (7 and 15 minutes in); the later worlds keep 400 m layers.
  assert.deepEqual(ECONOMY.layers.slice(0, 3).map(l => l.from), [0, 60, 140]);
  assert.deepEqual(ECONOMY.layers.slice(7).map(l => l.from), [0, 400, 800, 1200, 1600, 2000, 2400, 0, 400, 800, 1200, 1600, 2000, 2400]);
});
