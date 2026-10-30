import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONTENT, GAME_GENERATION } from '../../src/game/content/gameContent.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { resourceByKind } from '../../src/game/content/resources.ts';
import { SparseWorld } from '../../src/game/terrain/SparseWorld.ts';
import { worldRequirement } from '../../src/game/content/worldJourney.ts';

// Each layer's way down ends in a cap (2026-10-29: the first layer was dug through in half a minute with the first
// pickaxe, its dense rock lying inside the hall below): hard rock right over the next hall's ceiling, the next
// layer's pickaxe recommended, and below it a hit does only part of its damage.

test('every layer\'s cap is solid rock right over the next hall\'s ceiling, all through the pit\'s column', () => {
  const world = new SparseWorld(GAME_GENERATION);
  for (const w of GAME_CONTENT.worlds) for (let k = 0; k < 6; k++) {
    const layer = w.layers[k], next = w.layers[k + 1], hall = w.rooms[k], z = worldRequirement(w.id).z / 2;
    const ceiling = next.from - hall.height * 2, top = layer.from + layer.deepAt;
    assert.ok(top < ceiling, `world ${w.id} layer ${k}: the cap stands above the hall (${top} m over ${ceiling} m)`);
    assert.equal((ceiling - top) / 2, 8, `world ${w.id} layer ${k}: eight cells thick`);
    for (let depth = top; depth < ceiling; depth += 2) for (const [x, dz] of [[-4, -4], [0, 0], [3, 3]]) {
      const cell = [x, -depth / 2 - 1, z + dz];
      assert.equal(world.cell(cell), layer.deepKind, `world ${w.id} layer ${k}: cap at ${depth} m (${cell})`);
      assert.ok(world.canMine(cell), `world ${w.id} layer ${k}: the cap can be mined at ${cell}`);
    }
    const cap = resourceByKind(layer.deepKind);
    assert.equal(cap.recommendedLevel, next.gate ?? ECONOMY.layers[(w.id - 1) * 7 + k + 1].gate);
    assert.equal(cap.requiredLevel, ECONOMY.layers[(w.id - 1) * 7 + k].gate, 'the cap itself needs only its own layer\'s pickaxe');
  }
});

test('below its recommended pickaxe a cap takes capPenalty of each hit; at it, the whole hit; plain rock never', () => {
  const content = GAME_CONTENT.session, cap = resourceByKind(65), rock = resourceByKind(64);
  assert.equal(cap.recommendedLevel, 2); assert.equal(rock.recommendedLevel, 0);
  const play = (level, kind) => {
    const d = new GameSession(content).exportProgress(); d.pickaxe = { version: 1, level, enhance: 0 }; d.equipment = { ...d.equipment, toolLevel: level };
    const s = GameSession.fromData(d, content); let now = 0;
    s.attach({ cell: () => kind, pending: () => false, mine: () => true, cancelMining() {} });
    s.selectTarget([0, -13, 0]);
    return { hit: s.hit([0, -13, 0]), target: s.getSnapshot().target, power: s.getSnapshot().pickaxe.power, now };
  };
  const under = play(1, 65), at = play(2, 65), plain = play(1, 64);
  assert.equal(under.hit.damage, Math.max(1, Math.floor(under.power * ECONOMY.capPenalty)));
  assert.ok(under.target.underLevel && !under.target.locked && under.target.recommendedLevel === 2, 'the plate says which pickaxe');
  assert.equal(at.hit.damage, at.power); assert.equal(at.target.underLevel, false);
  assert.equal(plain.hit.damage, plain.power); assert.equal(plain.target.underLevel, false);
});
