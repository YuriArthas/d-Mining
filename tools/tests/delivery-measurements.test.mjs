import test from 'node:test';
import assert from 'node:assert/strict';
import { Measurements } from '../../src/game/terrain/RegionPipeline.ts';

test('disabled timing collection retains no samples; explicit collection stays bounded and reports the real maximum', () => {
  const ordinary = new Measurements(false), debug = new Measurements(true);
  for (let i = 0; i < 400; i++) { ordinary.add('frame', i); debug.add('frame', i); }
  assert.deepEqual(ordinary.snapshot(), {});
  assert.deepEqual(debug.snapshot().frame, { samples: 256, p95: 386, max: 399 });
});
