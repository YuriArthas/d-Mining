import test from 'node:test';
import assert from 'node:assert/strict';
import { OrePickupQueue } from '../../src/game/ui/OrePickupQueue.ts';

test('collection receipts merge by mineral and restart the visible lifetime', () => {
  const queue = new OrePickupQueue();
  assert.deepEqual(queue.snapshot(), []);
  queue.collect([{ itemId: 'ore.stone', count: 1 }, { itemId: 'ore.stone', count: 2 }], 0);
  assert.equal(queue.snapshot()[0].count, 3);
  const id = queue.snapshot()[0].id;
  queue.collect([{ itemId: 'ore.stone', count: 4 }], 1200);
  assert.equal(queue.snapshot()[0].id, id);
  assert.equal(queue.snapshot()[0].count, 7);
  assert.equal(queue.nextExpiry(), 3400);
  assert.equal(queue.advance(2200).length, 1);
  assert.deepEqual(queue.advance(3400), []);
});

test('wide receipts queue every mineral and merge queued quantities without losing them', () => {
  const queue = new OrePickupQueue();
  queue.collect(Array.from({ length: 7 }, (_, i) => ({ itemId: `mineral-${i}`, count: 1 })), 0);
  assert.deepEqual(queue.snapshot().map(row => row.itemId), ['mineral-0', 'mineral-1', 'mineral-2', 'mineral-3']);
  queue.collect([{ itemId: 'mineral-6', count: 5 }], 500);
  const next = queue.advance(2200);
  assert.deepEqual(next.map(row => row.itemId), ['mineral-4', 'mineral-5', 'mineral-6']);
  assert.equal(next[2].count, 6);
  assert.equal(queue.nextExpiry(), 4400);
  assert.deepEqual(queue.advance(4400), []);
});

test('expired rows never merge into a new acquisition and a new UI queue has no history', () => {
  const queue = new OrePickupQueue();
  const original = queue.collect([{ itemId: 'ore.stone', count: 9 }], 0)[0];
  const acquired = queue.collect([{ itemId: 'ore.stone', count: 1 }], 2200)[0];
  assert.notEqual(acquired.id, original.id);
  assert.equal(acquired.count, 1);
  const remounted = new OrePickupQueue();
  assert.deepEqual(remounted.snapshot(), []);
  assert.equal(remounted.nextExpiry(), null);
});
