import test from 'node:test';
import assert from 'node:assert/strict';
import { CaveLights } from '../../src/game/presentation/CaveLights.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { HALL_BY_LAYER, undergroundHall } from '../../src/game/content/underground/halls.ts';

const rooms = GAME_CONTENT.worlds.flatMap(w => w.rooms).map(r => ({ id: r.id, x: r.x, z: r.z, depth: r.depth }));

test('cave lights start hidden so surface materials do not carry point lights', () => {
  const lights = new CaveLights(rooms);
  try {
    assert.equal(lights.group.visible, false);
    assert.equal(lights.group.children.length, 7);
    assert.ok(lights.group.children.every(light => light.userData.caveLight === true));
    lights.update([0, 0, 0], 'surface', 1);
    assert.equal(lights.group.visible, false);
    assert.equal(lights.diagnostics().active, false);
    assert.equal(lights.diagnostics().helmet, 0);
  } finally { lights.dispose(); }
});

test('the group turns on underground and keeps unused pool slots in the scene', () => {
  const lights = new CaveLights(rooms);
  try {
    lights.update([0, -40, 0], 'old_mine', 0);
    assert.equal(lights.group.visible, true);
    assert.equal(lights.diagnostics().active, true);
    assert.equal(lights.diagnostics().helmet, 4.5);
    const hallLights = undergroundHall(HALL_BY_LAYER.old_mine).hall.lights.length;
    assert.equal(lights.diagnostics().lights, hallLights);
    assert.equal(lights.group.children.filter(light => light.visible).length, 7);
    lights.update([0, 0, 0], 'surface', 1);
    assert.equal(lights.group.visible, false);
  } finally { lights.dispose(); }
});
