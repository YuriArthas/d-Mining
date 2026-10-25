import test from 'node:test';
import assert from 'node:assert/strict';
import { springStep, SHOWROOM } from '../../src/game/presentation/ShopView.ts';
import { offerAction, offerState, offerStats, offerTier } from '../../src/game/ui/shopOffer.ts';
import { shopTools, shopBackpacks } from '../../src/game/content/shopCatalog.ts';

test('镜头沿轨道滑动：先加速再减速，到位时只轻微越过一点再停稳；远跳也一样从容', () => {
  for (const distance of [1, 5, 20].map(n => n * SHOWROOM.spacing)) {
    let x = 0, v = 0, peak = 0, peakAt = 0, overshoot = 0, t = 0;
    for (; t < 5; t += 1 / 60) {
      [x, v] = springStep(x, v, distance, 1 / 60);
      if (v > peak) { peak = v; peakAt = t; }
      overshoot = Math.max(overshoot, x - distance);
    }
    // Short glides peak early and ease in; long ones cruise (checked below).
    if (distance <= 5 * SHOWROOM.spacing) assert.ok(peakAt > 0.05 && peakAt < 0.4, `speeds up first, fastest at ${peakAt.toFixed(2)} s`);
    assert.ok(overshoot > 0 && overshoot < distance * .03, `settles with a slight overshoot (${overshoot.toFixed(3)} m)`);
    assert.ok(Math.abs(x - distance) < 1e-3 && Math.abs(v) < 1e-2, 'at rest on the item');
  }
  // A long jump cruises: never faster than about 60 m/s, still there in under three seconds.
  let x = 0, v = 0, top = 0, t = 0;
  for (; t < 6 && Math.abs(x - 20 * SHOWROOM.spacing) > .01; t += 1 / 60) { [x, v] = springStep(x, v, 20 * SHOWROOM.spacing, 1 / 60); top = Math.max(top, v); }
  assert.ok(top < 66, `top speed ${top.toFixed(1)} m/s`); assert.ok(t < 3, `arrives in ${t.toFixed(2)} s`);
  // Frame rate does not change the path.
  let a = [0, 0], b = [0, 0];
  for (let i = 0; i < 30; i++) a = springStep(a[0], a[1], 10, 1 / 30);
  for (let i = 0; i < 60; i++) b = springStep(b[0], b[1], 10, 1 / 60);
  assert.ok(Math.abs(a[0] - b[0]) < .05);
});

test('商店卡片：已装备、已拥有、下一件、未到；数值和当前装备对比；按钮文字', () => {
  const tools = shopTools(true, 1), bags = shopBackpacks(true);
  const s = { balances: { gold: 1000, tech: 0, star: 0 }, pickaxe: { level: 3 }, inventory: { capacity: bags[1].capacity, used: 10 }, equipment: { toolLevel: 4, backpackCapacity: bags[1].capacity }, backpackUpgrade: { next: { id: bags[2].id } } };
  assert.deepEqual([1, 3, 4, 5, 6].map(l => offerState('tools', tools[l - 1], s)), ['owned', 'equipped', 'owned', 'next', 'locked']);
  assert.deepEqual(bags.slice(0, 4).map(b => offerState('backpacks', b, s)), ['owned', 'equipped', 'next', 'locked']);
  const [power, speed] = offerStats('tools', tools[4], tools, s);
  assert.equal(power.current, tools[2].power); assert.equal(power.value, tools[4].power); assert.equal(power.max, tools.at(-1).power);
  assert.equal(speed.unit, '/秒');
  assert.equal(offerStats('backpacks', bags[2], bags, s)[0].current, bags[1].capacity);
  assert.deepEqual(offerAction('tools', tools[2], s), { label: '已装备', enabled: false, buy: false });
  assert.deepEqual(offerAction('tools', tools[0], s), { label: '装备', enabled: true, buy: false });
  assert.equal(offerAction('tools', tools[5], s).label, '先买上一件');
  const next = offerAction('tools', tools[4], { ...s, balances: { gold: 0, tech: 0, star: 0 } });
  assert.equal(next.enabled, false); assert.equal(next.short, tools[4].price);
  assert.equal(offerAction('tools', tools[4], { ...s, balances: { gold: tools[4].price, tech: 0, star: 0 } }).buy, true);
  assert.deepEqual([tools[0], tools[10], tools[25]].map(offerTier), ['plain', 'fine', 'star']);
});
