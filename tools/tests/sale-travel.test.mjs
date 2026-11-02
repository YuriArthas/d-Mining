import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';

for (const world of GAME_CONTENT.worlds) test(`world ${world.id}: Sell goes to the first sale floor above the current position, including after ascending`, () => {
  const session = new GameSession(GAME_CONTENT.session), trips = [];
  session.devUnlockWorld(world.id);
  session.attach({ cell: () => 64, pending: () => false, mine: () => true, cancelMining() {}, travelTo: feet => trips.push(feet) });
  const surface = GAME_CONTENT.session.sales.find(s => s.y === 0 && Math.abs(s.z - world.z) < 100);
  const sellFrom = (feet, grounded, zone) => {
    session.updatePosition(feet, grounded);
    assert.equal(session.goTo('sale'), 'travelling');
    assert.deepEqual(trips.at(-1), [zone.x, zone.y + .1, zone.z]);
  };
  sellFrom([0, -1, world.z], false, surface);
  world.rooms.forEach((room, i) => {
    const above = i ? world.rooms[i - 1].sell : surface;
    sellFrom([room.x, -room.depth - 2, room.z], false, room.sell);
    // Physics leaves the feet slightly above a hall's supporting floor.
    sellFrom(room.spawn, true, room.sell);
    // Anywhere inside the hall is its floor (2026-11-02: on a step or a crate, or in a jump, Sell went up a floor).
    sellFrom([room.spawn[0], room.spawn[1] + 1.5, room.spawn[2]], true, room.sell);
    sellFrom([room.x, -room.depth + room.height, room.z], false, room.sell);
    sellFrom([room.x, -room.depth + .01, room.z], false, room.sell);
    // In the rock over its ceiling the player is still on the floor above.
    sellFrom([room.x, -room.depth + room.height * 2 + 1, room.z], false, above);
  });
  sellFrom([0, .1, world.z + 46], true, surface);
  assert.equal(session.getSnapshot().destinations.filter(d => d.unlocked).length, world.rooms.length);
});
