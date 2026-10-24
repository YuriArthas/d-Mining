import test from 'node:test';
import assert from 'node:assert/strict';
import { MiningFeedback, hitMaterial, pickupTier } from '../../src/game/runtime/MiningFeedback.ts';
import { HitEffects } from '../../src/game/presentation/HitEffects.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { resourceByKind } from '../../src/game/content/resources.ts';
import { JOURNEY_BACKPACKS } from '../../src/game/content/journeyResources.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
const SESSION_CONTENT = GAME_CONTENT.session, SELL_ZONE = SESSION_CONTENT.sales[0];

import { WORLD1_LAYERS as LAYERS } from './fixtures/world.mjs';
import { itemPrice } from '../../src/game/application/items.ts';
import { Color } from 'three';

function harness(solid = () => 1) {
  const listeners = { feedback: new Set(), ore: new Set() }, cues = [];
  const session = {
    onFeedback: l => { listeners.feedback.add(l); return () => listeners.feedback.delete(l); },
    onOreCollected: l => { listeners.ore.add(l); return () => listeners.ore.delete(l); },
  };
  const scenes = [];
  const audio = { play: cue => { cues.push(cue); return true; }, setScene: scene => scenes.push(scene) };
  const feedback = new MiningFeedback(session, { cell: solid, layers: () => LAYERS, hub: f => f[1] > -0.6 }, audio);
  const still = { contact: false, jump: false, land: null };
  return { feedback, cues, scenes, listeners, still, emit: e => listeners.feedback.forEach(l => l(e)), collect: b => listeners.ore.forEach(l => l(b)) };
}
const feet = [0, 0, 6];

test('普通命中在镐尖落下那一帧出声、飞碎屑；最后一击立刻炸开，不再补一下命中声', () => {
  const h = harness();
  h.feedback.update(1 / 60, { cell: [0, 0, 1], kind: 67, breaking: false }, h.still, feet);
  assert.deepEqual(h.cues, [], 'nothing before the pick lands');
  h.feedback.update(1 / 60, null, { ...h.still, contact: [1, 0.2, 2.6] }, feet);
  assert.deepEqual(h.cues, [{ type: 'hit', material: 'ore' }]);
  assert.ok(h.feedback.effects.diagnostics().particles >= 7 && h.feedback.effects.diagnostics().flashing);
  h.feedback.update(1 / 60, { cell: [0, 0, 1], kind: 67, breaking: true }, h.still, feet);
  assert.deepEqual(h.cues.at(-1), { type: 'break', material: 'ore' });
  const spawned = h.feedback.effects.diagnostics().spawned;
  h.feedback.update(1 / 60, null, { ...h.still, contact: [1, 0.2, 2.6] }, feet);
  assert.equal(h.cues.length, 2, 'the swing after the final blow adds no hit');
  assert.equal(h.feedback.effects.diagnostics().spawned, spawned);
  h.feedback.dispose();
});

test('镐子落下时方块已被挖走就不出命中声；传送清掉待播的命中', () => {
  let kind = 1;
  const h = harness(() => kind);
  h.feedback.update(1 / 60, { cell: [0, -1, 0], kind: 64, breaking: false }, h.still, feet);
  kind = 0;
  h.feedback.update(1 / 60, null, { ...h.still, contact: [1, 0.2, 2.6] }, feet);
  assert.deepEqual(h.cues, []);
  kind = 1;
  h.feedback.update(1 / 60, { cell: [0, -1, 0], kind: 64, breaking: false }, h.still, feet);
  h.feedback.travel();
  h.feedback.update(1 / 60, null, { ...h.still, contact: [1, 0.2, 2.6] }, feet);
  assert.deepEqual(h.cues, [{ type: 'travel' }]);
});

test('起跳、落地有声；重落地扬尘，轻落地不扬尘', () => {
  const h = harness();
  h.feedback.update(1 / 60, null, { ...h.still, jump: true }, feet);
  h.feedback.update(1 / 60, null, { ...h.still, land: 0.3 }, feet);
  assert.equal(h.feedback.effects.diagnostics().particles, 0);
  h.feedback.update(1 / 60, null, { ...h.still, land: 0.9 }, feet);
  assert.deepEqual(h.cues, [{ type: 'jump' }, { type: 'land', strength: 0.3 }, { type: 'land', strength: 0.9 }]);
  assert.ok(h.feedback.effects.diagnostics().particles >= 8);
});

test('出售、购买、奖励、孵蛋、解锁、拒绝和拾取各有对应音效；未知物品不报错', () => {
  const h = harness();
  for (const event of [{ type: 'sold', coins: 5, count: 3 }, { type: 'purchased' }, { type: 'reward' }, { type: 'hatched', tier: 2, auto: false }, { type: 'hatched', tier: 0, auto: true }, { type: 'unlocked' }, { type: 'denied', reason: 'full' }]) h.emit(event);
  h.collect([{ itemId: 'journey.rock.0', count: 3 }, { itemId: 'journey.emerald', count: 1 }]);
  h.collect([{ itemId: 'not-a-real-item', count: 1 }]);
  assert.deepEqual(h.cues, [
    { type: 'sell' }, { type: 'purchase' }, { type: 'reward' }, { type: 'hatch', tier: 2, auto: false }, { type: 'hatch', tier: 0, auto: true },
    { type: 'unlock' }, { type: 'denied' }, { type: 'pickup', tier: 2 }, { type: 'pickup', tier: 0 },
  ]);
  h.feedback.dispose();
  h.emit({ type: 'sold', coins: 1, count: 1 });
  assert.equal(h.cues.length, 9, 'disposed feedback stops listening');
});

test('命中材质与拾取音高按矿物属性划分', () => {
  // World 1's rock and its dense rock, coal (vein), copper (metal) and emerald (gem).
  assert.equal(hitMaterial(64), 'rock'); assert.equal(hitMaterial(65), 'rock');
  assert.equal(hitMaterial(66), 'ore'); assert.equal(hitMaterial(67), 'ore'); assert.equal(hitMaterial(74), 'gem');
  assert.equal(hitMaterial(9999), 'rock', 'unknown kinds fall back instead of throwing');
  assert.deepEqual(['journey.rock.0', 'journey.rock.0.deep', 'journey.copper', 'journey.emerald', 'journey.diamond', 'unknown'].map(pickupTier), [0, 0, 1, 2, 2, 0]);
});

test('碎屑从朝向玩家且露在空气里的面飞出，不会埋进相邻方块', () => {
  const fx = new HitEffects(), colors = { host: new Color('#888'), ore: null };
  // Floor block at the origin cell, player standing two cells away horizontally: the dominant
  // direction is sideways, but only the top face is open.
  fx.hit([0, -1, 0], [5, 1.1, 0], colors, n => n.y === 1);
  const chips = fx['particles'];
  assert.ok(chips.length > 0);
  for (const chip of chips) assert.ok(chip.position.y >= -0.01, `chip starts on the open top face: ${chip.position.y}`);
  // With the pick tip known, chips start right under it (clamped to the face).
  fx.update(5);
  fx.hit([0, -1, 0], [5, 1.1, 0], colors, n => n.y === 1, [0.4, 0.3, 1.5]);
  for (const chip of fx['particles']) { assert.ok(Math.abs(chip.position.x - 0.4) < 1e-6 && Math.abs(chip.position.z - 1.5) < 1e-6, 'under the pick tip'); }
  fx.dispose();
});

test('碎屑寿命有限、数量有上限，闪光很快消失', () => {
  const fx = new HitEffects(), colors = { host: new Color('#888'), ore: new Color('#d88651') };
  for (let i = 0; i < 40; i++) fx.burst([i, 0, 0], colors);
  assert.ok(fx.diagnostics().particles <= 192, 'bounded');
  fx.update(0.2);
  assert.equal(fx.diagnostics().flashing, false);
  for (let i = 0; i < 60; i++) fx.update(1 / 60);
  assert.equal(fx.diagnostics().particles, 0, 'all gone within a second');
  fx.dispose();
});

test('会话发出出售、购买、余额不足和满包拒绝事件', () => {
  let now = 0;
  const session = new GameSession(SESSION_CONTENT, undefined, () => now), events = [];
  session.attach({ cell: () => 64, pending: () => false, mine: () => true, cancelMining: () => {} });
  session.onFeedback(e => events.push(e));
  // The richer ore of world 1's surface: enough for the first bag without filling the starting one.
  const [first, second] = JOURNEY_BACKPACKS, ore = resourceByKind(67), count = Math.ceil(first.price / ore.price);
  session.collected(Array.from({ length: count }, () => ({ kind: ore.kind })));
  session.updatePosition([SELL_ZONE.x, SELL_ZONE.y, SELL_ZONE.z], true); session.resetPosition();
  assert.deepEqual(events.shift(), { type: 'sold', coins: count * ore.price, count });
  assert.equal(session.upgradeBackpack(first.id).status, 'upgraded');
  assert.deepEqual(events.shift(), { type: 'purchased' });
  assert.equal(session.upgradeBackpack(second.id).status, 'insufficient');
  assert.deepEqual(events.shift(), { type: 'denied', reason: 'coins' });
  session.collected(Array.from({ length: first.capacity }, () => ({ kind: 64 })));
  assert.deepEqual(events.shift(), { type: 'denied', reason: 'full' }, 'the moment the bag fills');
  now = 0.5; assert.equal(session.requestMine([[0, -1, 0]]), false);
  assert.deepEqual(events, [], 'holding on a block does not buzz again right away');
  now = 2; assert.equal(session.requestMine([[0, -1, 0]]), false);
  assert.deepEqual(events.shift(), { type: 'denied', reason: 'full' }, 'a later try is refused audibly');
});

test('脚步声按脚下材质出声：地下岩石是石头，地表广场是沙地，传到声音里的是这一步的力度', () => {
  const rock = harness(() => 1);
  rock.feedback.update(1 / 60, null, { ...rock.still, step: 1 }, [0, -40, 6]);
  assert.deepEqual(rock.cues, [{ type: 'step', surface: 'stone', strength: 1 }]);
  rock.feedback.dispose();
  // World 1's surface floor (protected kind 7) takes the hub's ground plan: the plaza is sand.
  const hub = harness(c => (c[1] === -1 ? 7 : 0));
  hub.feedback.update(1 / 60, null, { ...hub.still, step: 0.5 }, [3, 0.02, 20]);
  hub.feedback.update(1 / 60, null, hub.still, [3, 0.02, 20]);
  assert.deepEqual(hub.cues, [{ type: 'step', surface: 'sand', strength: 0.5 }], 'one cue per step');
  hub.feedback.dispose();
});

test('每帧报告所在位置：地表是山谷的曲子和风声，下到矿井变成闷住的曲子和洞穴声；退出后静音', () => {
  const h = harness();
  h.feedback.place({ theme: 'meadow_mine', surfaceLight: 1, daylight: 1 });
  assert.equal(h.scenes.at(-1).song, 'meadow');
  assert.equal(h.scenes.at(-1).ambience, 'meadow');
  h.feedback.place({ theme: 'meadow_mine', surfaceLight: 0, daylight: 1 });
  assert.equal(h.scenes.at(-1).ambience, 'shallow');
  assert.equal(h.scenes.at(-1).muffle, 1);
  h.feedback.place({ theme: 'lava_cave', surfaceLight: 0, daylight: 1 });
  assert.deepEqual([h.scenes.at(-1).song, h.scenes.at(-1).ambience], ['lava', 'lava']);
  h.feedback.dispose();
  assert.equal(h.scenes.at(-1).song, null);
  assert.equal(h.scenes.at(-1).ambience, null);
});

test('在河里走：每一步溅起水花，跳进水里水花更大，刚踩进水里也溅一下；岸上不溅', async () => {
  const { PROTECTED_FLOOR } = await import('../../src/game/world/entrance.ts');
  const { PINEWIND_CREEK } = await import('../../src/game/content/pinewind/hubLayout.ts');
  const audio = { play: () => true, setScene: () => {} }, none = () => () => {};
  const feedback = new MiningFeedback({ onFeedback: none, onOreCollected: none }, { cell: () => PROTECTED_FLOOR, layers: () => LAYERS, hub: f => f[1] > -1.3 }, audio);
  const still = { contact: null, jump: false, land: null }, bank = [-20, -.2, 39], water = [-20, -.93, 41.2];
  feedback.update(1 / 60, null, { ...still, step: .5 }, bank);
  assert.equal(feedback.splash.diagnostics().splashes, 0, 'no splash on the bank');
  feedback.update(1 / 60, null, still, water);
  assert.equal(feedback.splash.diagnostics().splashes, 1, 'stepping into the water');
  const entered = feedback.splash.diagnostics().drops;
  feedback.update(1 / 60, null, { ...still, step: .5 }, water);
  assert.equal(feedback.splash.diagnostics().splashes, 2, 'a footstep in the water');
  assert.ok(feedback.splash.diagnostics().drops > entered && feedback.splash.diagnostics().ripples >= 2);
  feedback.splash.random = () => .5;
  const before = feedback.splash.diagnostics().drops;
  feedback.update(1 / 60, null, { ...still, land: .8 }, water);
  assert.ok(feedback.splash.diagnostics().drops - before >= 18, 'a landing throws up a big splash');
  for (let i = 0; i < 180; i++) feedback.update(1 / 60, null, still, water);
  assert.deepEqual(feedback.splash.diagnostics().drops, 0, 'droplets fall back into the water');
  assert.ok(PINEWIND_CREEK.water > water[1]);
  feedback.dispose();
});
