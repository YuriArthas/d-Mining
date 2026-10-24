import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { worldPortal, worldSpawn, worldStation } from '../../src/game/content/worldJourney.ts';

test('传送站：站上去打开本世界的层列表；世界传送门：站到门前打开世界列表，只能在这里跨世界传送', () => {
  const session = new GameSession(GAME_CONTENT.session); let trip = null;
  session.attach({ cell: () => 0, pending: () => false, mine: () => false, cancelMining() {}, travelTo: (feet, look) => { trip = { feet, look }; } });
  const st = worldStation(1);
  session.updatePosition([0, .1, 46], true);
  assert.equal(session.getSnapshot().atStation, false);
  session.updatePosition([st.zone.x, .1, st.zone.z], true);
  assert.equal(session.getSnapshot().atStation, true, 'on the pad');
  session.updatePosition([0, .1, 46], true);
  assert.equal(session.getSnapshot().atStation, false, 'stepped off');
  // The world portal in world 1's south gate.
  const portal = worldPortal(1).zone;
  assert.equal(session.travelWorld(1), 'away', 'away from the portal');
  session.updatePosition([portal.x, .1, portal.z], true);
  assert.equal(session.getSnapshot().atPortal, true, 'in front of the portal');
  assert.equal(session.travelWorld(2), 'locked', 'worlds that are not open stay closed');
  assert.equal(session.travelWorld(1), 'travelling'); assert.deepEqual(trip.feet, worldSpawn(1));
});
