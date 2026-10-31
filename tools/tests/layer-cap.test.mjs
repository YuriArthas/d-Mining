import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONTENT, GAME_GENERATION } from '../../src/game/content/gameContent.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { resourceByKind } from '../../src/game/content/resources.ts';
import { SparseWorld } from '../../src/game/terrain/SparseWorld.ts';
import { worldRequirement } from '../../src/game/content/worldJourney.ts';

// Each layer's way down ends in a cap (2026-10-29: the first layer was dug through in half a minute with the first
// pickaxe, its dense rock lying inside the hall below): hard rock right over the next hall's ceiling. 2026-10-31: any
// pickaxe digs it at its own damage (the levels gate only the ores); its health is what makes it slow.

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
    assert.equal(resourceByKind(layer.deepKind).requiredLevel, 0, 'any pickaxe digs the cap');
  }
});

test('the first pickaxe digs a cap and a deeper layer\'s rock at its whole damage, with no line under the plate', () => {
  const content = GAME_CONTENT.session, deeper = GAME_CONTENT.worlds[0].layers[3];
  const play = (level, kind) => {
    const d = new GameSession(content).exportProgress(); d.pickaxe = { version: 1, level, enhance: 0 }; d.equipment = { ...d.equipment, toolLevel: level };
    const s = GameSession.fromData(d, content); let now = 0;
    s.attach({ cell: () => kind, pending: () => false, mine: () => true, cancelMining() {} });
    s.selectTarget([0, -13, 0]);
    return { hit: s.hit([0, -13, 0]), target: s.getSnapshot().target, power: s.getSnapshot().pickaxe.power, now };
  };
  for (const [level, kind] of [[1, 65], [2, 65], [1, 64], [1, deeper.base], [1, deeper.deepKind]]) {
    const { hit, target, power } = play(level, kind);
    assert.equal(hit.damage, power, `Lv.${level} on kind ${kind}: the whole hit`);
    assert.equal(target.locked, false); assert.equal('underLevel' in target, false);
  }
});
