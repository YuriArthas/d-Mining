import test from 'node:test';
import assert from 'node:assert/strict';
import { Color } from 'three';
import { OreSparkles, ORE_SPARKLES } from '../../src/game/presentation/OreSparkles.ts';

const GEM = { color: new Color('#ff2d55'), strength: 1 };
// A corridor along x at y = 0..1, z = 0; its walls (z = ±1) are gem ore, everything else plain rock.
const cell = ([x, y, z]) => (z === 0 && (y === 0 || y === 1)) ? 0 : Math.abs(z) === 1 ? 2 : 1;
const ore = kind => kind === 2 ? GEM : null;

test('矿石闪光：只从露在外面的矿石面上冒出，颜色随矿；粒子池固定上限，不随矿多少增长', () => {
  const sparkles = new OreSparkles(cell, ore);
  let seed = 1; sparkles.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let peak = 0;
  for (let i = 0; i < 600; i++) { sparkles.update(1 / 60, [1, 1, 1]); peak = Math.max(peak, sparkles.count); }
  assert.ok(sparkles.spawned > 20, `sparkles appear: ${sparkles.spawned}`);
  assert.ok(peak <= ORE_SPARKLES.capacity);
  assert.ok(sparkles.spawned / 10 <= ORE_SPARKLES.rate + 1, 'the spawn rate is capped');
  const p = sparkles.points.geometry.getAttribute('position'), c = sparkles.points.geometry.getAttribute('color');
  for (let i = 0; i < sparkles.count; i++) {
    const z = p.getZ(i);
    assert.ok(z > 0 && z < 2, `in the corridor, off a wall face: z ${z.toFixed(2)}`);
    assert.ok(Math.abs(c.getX(i) - GEM.color.r) < 1e-6, 'in the ore colour');
  }
  sparkles.clear(); assert.equal(sparkles.count, 0);
  sparkles.dispose();
});

test('全是岩石或矿石被埋着时一个闪光都不出', () => {
  const buried = new OreSparkles(([x, y, z]) => Math.abs(z) === 1 ? 2 : 1, ore);
  for (let i = 0; i < 300; i++) buried.update(1 / 60, [1, 1, 1]);
  assert.equal(buried.spawned, 0);
});
