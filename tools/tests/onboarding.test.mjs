import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { TIP_GAP, TIP_SECONDS, selectDepthGoal } from '../../src/game/application/Tips.ts';
import { Onboarding, TIP_IDS, BASIC_TIP_IDS } from '../../src/game/logic/Onboarding.ts';
const SESSION_CONTENT = GAME_CONTENT.session;

// One-time tips: a handful of hints, each shown once, never a task chain.
let now = 0;
const world = { cell: () => 64, pending: () => false, mine: () => true, cancelMining() {} };
const fresh = () => { now = 0; const s = new GameSession(SESSION_CONTENT, 25, () => now); s.attach(world); return s; };
const restore = data => { const s = new GameSession(SESSION_CONTENT, 25, () => now, {}, data); s.attach(world); return s; };
const tip = s => s.getSnapshot().tip;
const area = SESSION_CONTENT.onboarding.mineArea, atMine = [(area.minX + area.maxX) / 2, 0, (area.minZ + area.maxZ) / 2];
const sale = SESSION_CONTENT.sales[0], farFromMine = [0, 0, 46];
const tick = (s, seconds) => { now += seconds; s.advanceOnline(Math.max(1, seconds)); };
const fill = (s, count = 50) => s.collected(Array.from({ length: count }, () => ({ kind: 64 })));
const sell = s => { s.updatePosition([sale.x, sale.y, sale.z], true); s.resetPosition(); };
const learnedSave = (change = () => {}) => {
  const data = new GameSession(SESSION_CONTENT).exportProgress();
  data.onboarding = { ...data.onboarding, minedOnce: true, soldOnce: true, seen: ['dig', 'sell'] };
  change(data);
  return data;
};

test('新玩家只有一个提示：先指向矿坑，到了矿坑点亮一块方块；挖到第一块就结束，之后不再出现', () => {
  const s = fresh();
  s.updatePosition(farFromMine, true);
  assert.deepEqual(tip(s), { id: 'dig', anchor: 'mine' });
  assert.deepEqual(s.getSnapshot().tipAnchor, SESSION_CONTENT.onboarding.entrance);
  s.updatePosition(atMine, true);
  assert.deepEqual(tip(s), { id: 'dig', anchor: 'dig' });
  assert.equal(s.getSnapshot().tipAnchor, null);
  s.collected([{ kind: 64 }]);
  assert.equal(tip(s), null);
  assert.deepEqual(s.getSnapshot().onboarding.seen, ['dig']);
  const again = restore(s.exportProgress());
  again.updatePosition(farFromMine, true);
  assert.equal(tip(again), null, 'never shown twice');
});

test('出售提示只在第一次装满背包时出现：卖掉或几秒后自动收起，以后装满不再提示', () => {
  const s = fresh();
  s.updatePosition(atMine, true); s.collected([{ kind: 64 }]);
  now = TIP_GAP + 1; fill(s, 49);
  assert.equal(tip(s)?.id, 'sell');
  sell(s);
  assert.equal(tip(s), null);
  assert.ok(s.getSnapshot().onboarding.seen.includes('sell'));
  now += 100; s.updatePosition(atMine, true); fill(s, 50);
  assert.notEqual(tip(s)?.id, 'sell', 'a full bag later on gets no sell tip');

  const ignored = fresh();
  ignored.updatePosition(atMine, true); ignored.collected([{ kind: 64 }]);
  now = TIP_GAP + 1; fill(ignored, 49);
  assert.equal(tip(ignored)?.id, 'sell');
  tick(ignored, TIP_SECONDS.sell + 1);
  assert.equal(tip(ignored), null, 'times out without selling');
  assert.ok(ignored.getSnapshot().onboarding.seen.includes('sell'), 'and still counts as shown');
});

test('镐子和宠物提示各一次、一次只显示一个、中间留出安静时间；点掉或用到对应按钮就结束', () => {
  const upgrade = new GameSession(SESSION_CONTENT).getSnapshot().pickaxeUpgrade.price;
  const egg = SESSION_CONTENT.petContent.eggs.find(e => e.id === 'meadow-egg').price;
  now = 0;
  const s = restore(learnedSave(data => { data.wallet.balances.gold = Math.max(upgrade, egg) + 10; }));
  s.updatePosition(farFromMine, true);
  assert.equal(tip(s)?.id, 'shop', 'the pickaxe comes before pets');
  s.dismissTip('pets');
  assert.equal(tip(s)?.id, 'shop', 'tapping another control does not end it');
  s.dismissTip('shop');
  assert.equal(tip(s), null);
  now += TIP_GAP / 2; s.updatePosition(atMine, true);
  assert.equal(tip(s), null, 'quiet time between tips');
  now += TIP_GAP; s.updatePosition(farFromMine, true);
  assert.equal(tip(s)?.id, 'pets');
  s.dismissTip();
  assert.deepEqual(s.getSnapshot().onboarding.seen, ['dig', 'sell', 'shop', 'pets']);
  assert.equal(s.getSnapshot().onboarding.status, 'completed', 'older builds sharing the save stay quiet too');
  now += 100; s.updatePosition(atMine, true);
  assert.equal(tip(s), null);
});

// 2026-10-31: 商店 ended its tip as the shop opened, so the quiet time ran out inside the shop and the 宠物 tip came
// the moment the shop closed.
test('面板或加载画面盖住游戏时不出新提示、提示不计时；安静时间里打开的面板，关掉后重新安静一整段，关掉商店不会马上接下一条', () => {
  const upgrade = new GameSession(SESSION_CONTENT).getSnapshot().pickaxeUpgrade.price;
  const egg = SESSION_CONTENT.petContent.eggs.find(e => e.id === 'meadow-egg').price;
  now = 0;
  const s = restore(learnedSave(data => { data.wallet.balances.gold = Math.max(upgrade, egg) + 10; }));
  s.coverTips(true);
  s.updatePosition(farFromMine, true);
  assert.equal(tip(s), null, 'nothing under the loading screen');
  now += 30; s.coverTips(false);
  assert.equal(tip(s)?.id, 'shop', 'it comes when the game shows');
  s.coverTips(true); now += TIP_SECONDS.shop + 5; s.updatePosition(atMine, true);
  assert.equal(tip(s)?.id, 'shop', 'a covered tip does not run out');
  s.coverTips(false);
  // 商店 ends the tip, then the trip there takes a few seconds in view before the shop opens.
  s.dismissTip('shop'); now += TIP_GAP - 1; s.updatePosition(atMine, true); s.coverTips(true);
  now += 60; s.updatePosition(farFromMine, true);
  assert.equal(tip(s), null, 'nothing while in the shop');
  s.coverTips(false); now += TIP_GAP - .1; s.updatePosition(atMine, true);
  assert.equal(tip(s), null, 'a whole quiet after the shop closes');
  now += .2; s.updatePosition(farFromMine, true);
  assert.equal(tip(s)?.id, 'pets');
});

test('玩家已经做过的事不再提示：先升级了镐子或已有宠物，就直接记为已提示', () => {
  now = 0;
  const s = restore(learnedSave(data => { data.wallet.balances.gold = 1e6; data.pickaxe.level = 3; delete data.equipment; }));
  s.updatePosition(farFromMine, true);
  assert.equal(tip(s)?.id, 'pets');
  assert.ok(s.getSnapshot().onboarding.seen.includes('shop'));
  const stand = SESSION_CONTENT.eggStations.find(station => station.eggId === 'meadow-egg').zone;
  s.updatePosition([stand.x, stand.y, stand.z], true);
  const hatched = s.pets.hatch('meadow-egg');
  assert.equal(hatched.status, 'hatched');
  s.updatePosition(atMine, true);
  assert.equal(tip(s), null);
  assert.deepEqual(s.getSnapshot().onboarding.seen, [...BASIC_TIP_IDS]);
});

test('卖出和采集才记录事实，空卖、失败和锁定方块都不算', () => {
  const s = fresh(), captures = [];
  s.onProgressCommitted(() => captures.push(s.exportProgress()));
  s.updatePosition(farFromMine, true); s.hit([0, -5, 0]);
  assert.equal(s.exportProgress().onboarding.minedOnce, false);
  s.collected([{ kind: 64 }]);
  assert.equal(captures.at(-1).onboarding.minedOnce, true);
  assert.equal(captures.at(-1).onboarding.minedCount, 1);
  sell(s);
  assert.equal(captures.at(-1).onboarding.soldOnce, true);

  const empty = fresh();
  sell(empty);
  assert.equal(empty.exportProgress().onboarding.soldOnce, false);
  empty.attach({ ...world, cell: () => 94, mine: () => false });
  empty.updatePosition([0, 0, 0], true);
  assert.equal(empty.hit([0, -201, 0]).status, 'locked');
  // The blow that would break the block cannot queue its removal: nothing was mined.
  empty.attach({ ...world, mine: () => false });
  let blow; do { now += 1; blow = empty.hit([0, -5, 0]); } while (blow.status === 'hit');
  assert.equal(blow.status, 'unavailable');
  assert.equal(empty.exportProgress().onboarding.minedOnce, false);
});

test('旧存档：跳过或早于引导的存档保持安静；四条已完成不会吞掉新增功能提示；坏数据报错', () => {
  const evidence = { level: 1, pets: 0, equipped: false };
  const old = { version: 1, status: 'active', minedOnce: true, soldOnce: false, equippedOnce: false, longTaskIntroduced: true, minedCount: 12 };
  assert.deepEqual(new Onboarding(old, true, evidence).getSnapshot().seen, ['dig']);
  assert.deepEqual(new Onboarding(old, true, { ...evidence, level: 2, pets: 1 }).getSnapshot().seen, ['dig', 'shop', 'pets']);
  for (const status of ['skipped', 'legacy']) {
    assert.deepEqual(new Onboarding({ ...old, status }, true, evidence).getSnapshot().seen, [...TIP_IDS]);
    assert.deepEqual(new Onboarding({ ...old, status, seen: ['dig'] }, true, evidence).getSnapshot().seen, [...TIP_IDS], 'an older build skipped it');
  }
  assert.deepEqual(new Onboarding({ ...old, status: 'completed' }, true, evidence).getSnapshot().seen, [...BASIC_TIP_IDS]);
  assert.deepEqual(new Onboarding({ ...old, status: 'completed', seen: [...BASIC_TIP_IDS, 'station'] }, true, evidence).getSnapshot().seen, [...BASIC_TIP_IDS, 'station']);
  assert.deepEqual(new Onboarding(undefined, true, evidence).getSnapshot().seen, [...TIP_IDS], 'saves from before tutorials');
  assert.deepEqual(new Onboarding(undefined, false, evidence).getSnapshot().seen, [], 'brand-new player');
  assert.deepEqual(new Onboarding({ ...old, seen: ['sell', 'from-a-newer-build'] }, true, evidence).getSnapshot().seen, ['sell']);
  for (const bad of [null, {}, { version: 2 }, { ...old, minedOnce: 'yes' }, { ...old, seen: 'dig' }, { ...old, seen: [1] }]) assert.throws(() => new Onboarding(bad, true, evidence));

  const data = new GameSession(SESSION_CONTENT).exportProgress();
  data.onboarding = { ...old };
  const s = GameSession.fromData(data, SESSION_CONTENT), saved = s.exportProgress().onboarding;
  assert.deepEqual(saved.seen, ['dig']);
  // Older test builds share this save and still require these fields.
  for (const key of ['status', 'minedOnce', 'soldOnce', 'equippedOnce', 'longTaskIntroduced', 'minedCount']) assert.equal(saved[key], old[key], key);
  assert.deepEqual(GameSession.fromData(s.exportProgress(), SESSION_CONTENT).exportProgress(), s.exportProgress());
});

test('下一层目标按历史最深计算，跳过旧存档里已开放的层', () => {
  const destinations = [
    { id: 'deep', name: '深层', depth: 800, unlocked: false },
    { id: 'early', name: '浅层', depth: 100, unlocked: false },
    { id: 'legacy', name: '旧档已开层', depth: 400, unlocked: true },
  ];
  assert.deepEqual(selectDepthGoal(20, destinations), { id: 'early', name: '浅层', depth: 100, currentDepth: 20, remainingDepth: 80 });
  assert.equal(selectDepthGoal(100, destinations.map(d => d.id === 'early' ? { ...d, unlocked: true } : d)).id, 'deep');
  assert.equal(selectDepthGoal(800, destinations.map(d => ({ ...d, unlocked: true }))), null);
  assert.equal(selectDepthGoal(0, []), null);
});
