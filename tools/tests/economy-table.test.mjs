import { tr } from '../../src/game/i18n/i18n.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY, isRound, validateEconomy } from '../../src/game/content/economy.ts';
import { loadPlan, simulate } from '../economy/model.mts';

test('joint economy reaches all worlds near the 2/4/6-hour design with sparse ores', (t) => {
  for(const seed of [1,7,15]) {
    const run=simulate(structuredClone(ECONOMY),loadPlan(),seed);
    assert.equal(run.arrive.length,22);
    for(const w of [1,2,3]) {
      const minutes=(run.arrive[w*7]-run.arrive[(w-1)*7])/60,target=w*120;
      t.diagnostic(`seed ${seed} world ${w}: ${minutes.toFixed(1)} min (model)`);
      assert.ok(minutes>target*.7&&minutes<target*1.3,`world ${w} outside pacing band`);
    }
  }
});

test('rock is cheap and bulky by health; adjacent ores grow about 3x then accelerate',()=>{
  assert.equal(ECONOMY.layers[0].rock.volume,1);
  for(const l of ECONOMY.layers){assert.equal(l.rock.price,1);assert.equal(l.deep.price,1);assert.ok(l.deep.volume>=l.rock.volume);assert.ok(l.ores.every(o=>o.volume===1));}
  assert.ok(ECONOMY.layers[13].rock.volume>=1000);assert.ok(ECONOMY.layers[17].rock.volume>=10000);
  for(const w of [0,1,2]) {
    const layers=ECONOMY.layers.slice(w*7,w*7+7);
    assert.deepEqual(layers.map(l=>l.oreChance),[.045,.049,.0535,.0575,.0615,.066,.07]);
    for(let i=1;i<7;i++) for(let ore=0;ore<2;ore++)assert.ok(layers[i].ores[ore].price/layers[i-1].ores[ore].price>=2.9);
    assert.ok(layers[6].ores[0].price/layers[5].ores[0].price>=4.9);
  }
  assert.ok(ECONOMY.bags[1].capacity>=ECONOMY.bags[0].capacity*4);
  assert.ok(ECONOMY.bags[1].price<=ECONOMY.bags[0].capacity,'first upgrade within one ordinary-rock bag');
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
  assert.deepEqual(ECONOMY.currencies.map(c => tr(c.name)), ['金币', '科技币', '星晶']);
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
