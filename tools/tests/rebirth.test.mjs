import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { REBIRTH, RebirthRecord, rebirthCost, rebirthMultiplier } from '../../src/game/logic/Rebirth.ts';

const content = GAME_CONTENT.session;
function session(edit) { const data = new GameSession(content).exportProgress(); edit(data); return GameSession.fromData(data, content); }

test('重生价格按阶乘涨（400M、800M、24亿、96亿……），倍率 ×1 → ×10 → ×20 → ×30；超出安全整数就停', () => {
  assert.deepEqual([0, 1, 2, 3].map(rebirthCost), [4e8, 8e8, 2.4e9, 9.6e9]);
  assert.deepEqual([0, 1, 2, 3].map(rebirthMultiplier), [1, 10, 20, 30]);
  assert.equal(REBIRTH.firstCost, 400_000_000);
  assert.equal(rebirthCost(30), null);
  assert.throws(() => new RebirthRecord({ version: 2, count: 1 }));
  assert.deepEqual(new RebirthRecord().exportData(), { version: 1, count: 0, offered: false });
});

test('重生：扣光全部金币，工具和背包回到第一级，背包里的矿清空，回到第一世界；宠物、世界和地下层保留；之后卖矿乘倍率', () => {
  const s = session(d => {
    d.wallet.coins = 427_000_000; d.pickaxe.level = 12; d.inventory.capacity = 2500; d.equipment = { version: 1, toolLevel: 12, backpackCapacity: 2500 };
    d.inventory.items = { 'journey.coal': 5 }; d.worldProgress = { version: 2, openWorlds: [1, 2] };
  });
  const before = s.getSnapshot();
  assert.equal(before.rebirth.canAfford, true); assert.equal(before.rebirth.shown, true);
  const pets = JSON.stringify(s.exportProgress().pets);
  let commits = 0, events = []; s.onProgressCommitted(() => commits++); s.onFeedback(e => events.push(e.type));
  assert.equal(s.rebirth(1).status, 'stale', 'a stale panel cannot rebirth twice');
  assert.deepEqual(s.rebirth(0), { status: 'reborn', count: 1, multiplier: 10 });
  const after = s.getSnapshot();
  assert.equal(after.coins, 0, 'every coin goes, including the 27M above the price');
  assert.equal(after.pickaxe.level, 1); assert.equal(after.inventory.capacity, 50); assert.equal(after.inventory.used, 0);
  assert.deepEqual(after.equipment, { version: 1, toolLevel: 1, backpackCapacity: 50 });
  assert.deepEqual(after.rebirth, { count: 1, multiplier: 10, nextMultiplier: 20, cost: 8e8, canAfford: false, shown: true });
  assert.equal(after.worlds.find(w => w.id === 2).open, true, 'open worlds stay open');
  assert.equal(JSON.stringify(s.exportProgress().pets), pets, 'pets stay');
  assert.equal(commits, 1); assert.deepEqual(events, ['reborn']);
  // The multiplier applies to every sale, and survives a reload.
  const saved = s.exportProgress(); saved.inventory.items = { 'journey.coal': 4 };
  const back = GameSession.fromData(saved, content);
  const plain = session(d => { d.inventory.items = { 'journey.coal': 4 }; });
  assert.equal(back.getSnapshot().sale.coins, plain.getSnapshot().sale.coins * 10);
  assert.equal(back.getSnapshot().rebirth.count, 1);
});

test('重生按钮：金币第一次到价格一半时出现，之后一直在；钱不够时拒绝且什么都不扣', () => {
  const s = session(d => { d.wallet.coins = 150_000_000; });
  assert.equal(s.getSnapshot().rebirth.shown, false);
  assert.equal(s.rebirth(0).status, 'insufficient'); assert.equal(s.getSnapshot().coins, 150_000_000);
  const rich = session(d => { d.wallet.coins = 200_000_000; });
  assert.equal(rich.getSnapshot().rebirth.shown, true);
  const spent = rich.exportProgress(); spent.wallet.coins = 0;
  assert.equal(GameSession.fromData(spent, content).getSnapshot().rebirth.shown, true, 'stays once offered');
});
