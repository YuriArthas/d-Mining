import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireSaveOwnership } from '../../src/game/persistence/SaveOwnership.ts';

test('HTTP skips Web Locks even on trustworthy localhost, and HTTPS without the API remains usable', async () => {
  const manager = { request() { throw Error('HTTP must not request a lock'); } };
  const signal = new AbortController().signal;
  for (const protocol of ['http:', 'file:']) {
    const release = await acquireSaveOwnership('player', signal, manager, protocol);
    release();
  }
  (await acquireSaveOwnership('player', signal, undefined, 'https:'))();
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(acquireSaveOwnership('player', aborted.signal, manager, 'http:'), { name: 'AbortError' });
});

test('HTTPS ownership rejects a competing session and releases ownership when the session closes', async () => {
  let held = false;
  const manager = {
    async request(name, options, callback) {
      assert.equal(name, 'player');
      assert.deepEqual(options, { ifAvailable: true });
      if (held) return callback(null);
      held = true;
      try { return await callback({}); }
      finally { held = false; }
    },
  };
  const signal = new AbortController().signal;
  const release = await acquireSaveOwnership('player', signal, manager, 'https:');
  try {
    assert.equal(held, true);
    await assert.rejects(acquireSaveOwnership('player', signal, manager, 'https:'), /其他标签页/);
  } finally { release(); }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(held, false);
  (await acquireSaveOwnership('player', signal, manager, 'https:'))();
});
