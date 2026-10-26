import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';
import { RebirthRecord, rebirthMultiplier } from '../../src/game/logic/Rebirth.ts';

const content = GAME_CONTENT.session;
function session(edit) { const data = new GameSession(content).exportProgress(); edit(data); return GameSession.fromData(data, content); }
const world3 = content.destinations.filter(d => d.worldId === 3), final = world3.at(-1);
/** A player who has walked the whole journey: world 3's last rest room reached with the last pickaxe. */
function finished(d) {
  d.wallet.balances = { gold: 5, tech: 6, star: 7 }; d.pickaxe.level = 30; d.inventory.capacity = 500;
  d.equipment = { version: 1, toolLevel: 30, backpackCapacity: 500 };
  d.inventory.items = { 'journey.coal': 5 }; d.worldProgress = { version: 2, openWorlds: [1, 2, 3] };
  d.worldExploration = { ...d.worldExploration, 3: { version: 1, maxDepth: final.depth, unlockedDestinationIds: world3.map(r => r.id) } };
  d.pets.inventory.pets = [{ id: 'kept', speciesId: 'moss-slime', level: 1 }];
  d.materials = { version: 1, items: { 'journey.coal': 2 } };
}

test('重生倍率每次 +0.5：×1 → ×1.5 → ×2 → ×2.5；只读第二版记录', () => {
  assert.equal(ECONOMY.rebirth.stepPct, 50);
  assert.deepEqual([0, 1, 2, 3].map(rebirthMultiplier), [1, 1.5, 2, 2.5]);
  assert.throws(() => new RebirthRecord({ version: 1, count: 1, offered: true }));
  assert.deepEqual(new RebirthRecord().exportData(), { version: 2, count: 0 });
});

test('重生要走完旅程：到达第三世界最后一层并拥有最后一把镐子；按钮在第三世界开放后出现', () => {
  const fresh = new GameSession(content);
  assert.equal(fresh.getSnapshot().rebirth.shown, false);
  assert.equal(fresh.rebirth(0).status, 'locked');
  const noTool = session(d => { finished(d); d.pickaxe.level = 29; d.equipment.toolLevel = 29; });
  assert.equal(noTool.getSnapshot().rebirth.shown, true);
  assert.deepEqual([noTool.getSnapshot().rebirth.reached, noTool.getSnapshot().rebirth.level, noTool.getSnapshot().rebirth.ready], [true, false, false]);
  const before = noTool.exportProgress();
  assert.equal(noTool.rebirth(0).status, 'locked'); assert.deepEqual(noTool.exportProgress(), before, 'a refusal changes nothing');
  const notThere = session(d => { finished(d); d.worldExploration[3] = { version: 1, maxDepth: 0, unlockedDestinationIds: [] }; });
  assert.equal(notThere.getSnapshot().rebirth.ready, false);
});

test('重生：三种货币、镐子（含强化）、背包、材料仓、世界和地下层全部重置，回到第一世界；宠物保留；之后每种货币卖矿都乘倍率', () => {
  const s = session(finished);
  assert.equal(s.getSnapshot().rebirth.ready, true);
  const pets = JSON.stringify(s.exportProgress().pets);
  let commits = 0, events = []; s.onProgressCommitted(() => commits++); s.onFeedback(e => events.push(e.type));
  assert.equal(s.rebirth(1).status, 'stale', 'a stale panel cannot rebirth twice');
  assert.deepEqual(s.rebirth(0), { status: 'reborn', count: 1, multiplier: 1.5 });
  const after = s.getSnapshot(), starter = ECONOMY.bags[0].capacity;
  assert.deepEqual(after.balances, { gold: 0, tech: 0, star: 0 });
  assert.equal(after.pickaxe.level, 1); assert.equal(after.inventory.capacity, starter); assert.equal(after.inventory.used, 0);
  assert.deepEqual(after.equipment, { version: 1, toolLevel: 1, backpackCapacity: starter, enhance: 0 });
  assert.deepEqual(after.worlds.map(w => w.open), [true, false, false]);
  assert.equal(after.currentWorld, 1);
  assert.ok(s.devUnlocks().every(w => w.layers.every(l => !l.unlocked)), 'every layer is to be reached again');
  assert.equal(after.rebirth.count, 1); assert.equal(after.rebirth.ready, false); assert.equal(after.rebirth.shown, true);
  assert.equal(JSON.stringify(s.exportProgress().pets), pets, 'pets stay');
  assert.deepEqual(s.exportProgress().materials.items, {}, 'the material store empties');
  assert.equal(commits, 1); assert.deepEqual(events, ['reborn']);
  // The multiplier applies to every sale, and survives a reload.
  const saved = s.exportProgress(); saved.inventory.items = { 'journey.coal': 4 };
  const back = GameSession.fromData(saved, content);
  const plain = session(d => { d.inventory.items = { 'journey.coal': 4 }; });
  assert.equal(back.getSnapshot().sale.coins, Math.round(plain.getSnapshot().sale.coins * 1.5));
  assert.equal(back.getSnapshot().rebirth.count, 1);
});
