import test from 'node:test';
import assert from 'node:assert/strict';
import { DayNightCycle } from '../../src/game/logic/DayNightCycle.ts';
import { blendedCameraLook, CAMERA_LOOKS } from '../../src/game/content/cameraLook.ts';

test('a fresh cycle starts at night and blends over the final twelve seconds of each 7.5 minute period', () => {
  const cycle = new DayNightCycle();
  assert.deepEqual(cycle.getSnapshot(), { phase: 'night', phaseElapsed: 0, daylight: 0 });
  assert.equal(cycle.advance(438).daylight, 0);
  assert.equal(cycle.advance(6).daylight, .5);
  assert.deepEqual(cycle.advance(6), { phase: 'day', phaseElapsed: 0, daylight: 1 });
  assert.equal(cycle.advance(438).daylight, 1);
  assert.equal(cycle.advance(6).daylight, .5);
  assert.deepEqual(cycle.advance(6), { phase: 'night', phaseElapsed: 0, daylight: 0 });
});

test('time advances only by the supplied foreground interval, including across multiple cycles', () => {
  const cycle = new DayNightCycle();
  cycle.advance(300);
  assert.deepEqual(cycle.advance(0), cycle.getSnapshot());
  assert.equal(cycle.advance(450 * 20 + 144).daylight, .5);
  for (const value of [-1, NaN, Infinity]) assert.throws(() => cycle.advance(value), /非负有限数/);
});

test('camera grading preserves authored endpoints and blends every channel in between', () => {
  assert.equal(blendedCameraLook(0), CAMERA_LOOKS.night);
  assert.equal(blendedCameraLook(1), CAMERA_LOOKS.day);
  const look = blendedCameraLook(.5);
  for (const key of ['contrast', 'saturation', 'greenSaturation', 'tintStrength']) {
    assert.equal(look[key], (CAMERA_LOOKS.night[key] + CAMERA_LOOKS.day[key]) / 2);
  }
  for (const key of ['shadowTint', 'highlightTint']) {
    assert.deepEqual(look[key], CAMERA_LOOKS.night[key].map((value, i) => (value + CAMERA_LOOKS.day[key][i]) / 2));
  }
});
