import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { PINEWIND_CAMP } from '../../src/game/content/pinewindSurface.ts';
import { worldStation } from '../../src/game/content/worldJourney.ts';

test('传送站：站上去打开本世界的层列表；去传送站从哪都到站台前面，面朝传送站', () => {
  const session = new GameSession(PINEWIND_CAMP.session); let trip = null;
  session.attach({ cell: () => 0, pending: () => false, mine: () => false, cancelMining() {}, returnToSurface() {}, travelTo: (feet, look) => { trip = { feet, look }; } });
  const st = worldStation(1);
  session.updatePosition([0, .1, 46], true);
  assert.equal(session.getSnapshot().atStation, false);
  session.updatePosition([st.zone.x, .1, st.zone.z], true);
  assert.equal(session.getSnapshot().atStation, true, 'on the pad');
  session.updatePosition([0, .1, 46], true);
  assert.equal(session.getSnapshot().atStation, false, 'stepped off');
  // From the mine: travelling to the current world lands on the station pad.
  session.updatePosition([4, -420, 4], false);
  assert.equal(session.travelWorld(1), 'travelling');
  assert.deepEqual(trip.feet, [st.zone.x, .1, st.zone.z]); assert.deepEqual(trip.look, st.zone.lookAt);
  assert.equal(session.travelWorld(2), 'locked', 'worlds that are not open stay closed');
});
