import test from 'node:test';
import assert from 'node:assert/strict';
import { debugOptions } from '../../src/game/runtime/debugOptions.ts';
import { openSavedGame, saveNamespace } from '../../src/game/persistence/SaveBootstrap.ts';
import { LocalStorageSaveStore } from '../../src/game/persistence/LocalStorageSaveStore.ts';
import { GAME_CONTENT, GAME_GENERATION } from '../../src/game/content/gameContent.ts';

const switches = '&kit=1&layer=layer-2&gpuTiming=1&framesInFlight=1&submission=fenced&textGroups=0';
test('ordinary startup ignores all diagnostic switches unless debug is exactly 1', () => {
  const ordinary = debugOptions('');
  for (const query of ['', '?debug=0', '?debug=false', '?debug=true', '?debug=01', '?debug=', '?debug=0&debug=1'])
    assert.deepEqual(debugOptions(query + switches), ordinary, query);
  assert.deepEqual(debugOptions('?debug=1' + switches), {
    enabled: true, kit: true, previewLayer: 'layer-2', gpuTiming: true,
    framesInFlight: 1, submission: 'fenced', mergeTextGroups: false,
  });
});

test('debug uses an ephemeral save; explicit acceptance saves stay separate from player slots', () => {
  for (const pathname of ['/games/mining/index.html', '/games/mining-test/index.html', '/index.html']) {
    const normal = saveNamespace({ pathname, search: '' });
    const debug = saveNamespace({ pathname, search: '?debug=1' });
    assert.equal(normal.transient, false);
    assert.equal(debug.transient, true);
    assert.notEqual(normal.name, debug.name);
    for (const search of ['?debug=0&saveTest=review', '?debug=true&saveTest=review', '?saveTest=review'])
      assert.deepEqual(saveNamespace({ pathname, search }), normal);
    assert.deepEqual(saveNamespace({ pathname, search: '?debug=1&saveTest=review' }), { name: 'mining:acceptance:review', transient: false });
  }
});

test('granting and saving debug coins never opens persistent storage, and reopening starts fresh', async t => {
  let storageOpens = 0;
  t.mock.method(LocalStorageSaveStore, 'open', () => { storageOpens++; throw Error('Persistent save accessed'); });
  const content = GAME_CONTENT.session;
  const generation = GAME_GENERATION;
  const controller = new AbortController();
  const target = saveNamespace({ pathname: '/games/mining/index.html', search: '?debug=1' });
  const first = await openSavedGame(target.name, content, generation, controller.signal, undefined, target.transient);
  const coins = first.session.getSnapshot().coins;
  try {
    assert.equal(first.transient, true);
    assert.equal(first.session.devGrantCoins(100), true);
    await first.saves.flush();
    assert.equal(first.session.getSnapshot().coins, coins + 100);
  } finally { await first.close(); }
  const reopened = await openSavedGame(target.name, content, generation, controller.signal, undefined, target.transient);
  try { assert.equal(reopened.session.getSnapshot().coins, coins); }
  finally { await reopened.close(); }
  assert.equal(storageOpens, 0);
});

test('cancelled ephemeral bootstrap does not return a session', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(openSavedGame('mining:debug:test', GAME_CONTENT.session, GAME_GENERATION, controller.signal, undefined, true), { name: 'AbortError' });
});
