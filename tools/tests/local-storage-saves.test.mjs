import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStorageSaveStore } from '../../src/game/persistence/LocalStorageSaveStore.ts';
import { SaveCoordinator } from '../../src/game/persistence/SaveCoordinator.ts';
import { openSavedGame, saveNamespace } from '../../src/game/persistence/SaveBootstrap.ts';
import { SaveConflict } from '../../src/game/persistence/saveTypes.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { SparseWorld } from '../../src/game/terrain/SparseWorld.ts';
import { GAME_CONTENT, GAME_GENERATION } from '../../src/game/content/gameContent.ts';

class StorageFixture {
  values = new Map();
  writes = 0;
  failure = null;
  getItem(key) { if (this.failure?.name === 'SecurityError') throw this.failure; return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (this.failure) throw this.failure;
    this.writes++;
    this.values.set(key, String(value));
  }
}
const head = (revision = 1, regionCount = 0) => ({
  formatVersion: 1, revision, savedAt: 1, regionCount,
  world: { generationVersion: GAME_GENERATION.version, seed: GAME_GENERATION.seed, regionEncoding: 1 },
});
const progress = () => GameSession.createNew(GAME_CONTENT.session).exportProgress();
const batch = (revision, regions = [], regionCount = regions.length) => ({
  expectedRevision: revision === 1 ? null : revision - 1,
  head: head(revision, regionCount), progress: progress(), regions,
});
const cell = [-10, -50, -10];

test('one localStorage value round-trips player progress and real sparse terrain after reopen', async () => {
  const storage = new StorageFixture();
  const store = await LocalStorageSaveStore.open('player', storage);
  assert.deepEqual(await store.read(), { kind: 'missing' });
  const world = new SparseWorld(GAME_GENERATION);
  assert.equal(world.remove([cell]).length, 1);
  const regions = world.captureChanges().regions;
  const write = batch(1, regions);
  const session = GameSession.createNew(GAME_CONTENT.session);
  session.devGrantCoins(123);
  session.collected([{ kind: 64 }]);
  write.progress = session.exportProgress();
  await store.commit(write);
  assert.equal(storage.values.size, 1);
  assert.equal(storage.writes, 1);
  store.close();
  const reopened = await LocalStorageSaveStore.open('player', storage);
  const read = await reopened.read();
  assert.equal(read.kind, 'found');
  assert.deepEqual(GameSession.fromData(read.progress, GAME_CONTENT.session).exportProgress(), write.progress);
  assert.deepEqual(read.regions, regions);
  const restored = new SparseWorld(GAME_GENERATION);
  for (const region of read.regions) restored.restoreRegion(region);
  assert.equal(restored.cell(cell), 0);
  assert.equal(restored.removed, 1);
  reopened.close();
});

test('incremental commits preserve untouched regions, full regions and negative world coordinates', async () => {
  const storage = new StorageFixture(), store = await LocalStorageSaveStore.open('player', storage);
  const first = { region: [0, -3, -14], removed: null };
  const second = { region: [-1, -4, -1], removed: new Uint16Array([1, 3, 1024, 1024]) };
  await store.commit(batch(1, [first]));
  await store.commit(batch(2, [second], 2));
  second.removed.fill(0);
  const read = await store.read();
  assert.deepEqual(read.regions, [first, { region: [-1, -4, -1], removed: new Uint16Array([1, 3, 1024, 1024]) }]);
  read.regions[0].region[0] = 3;
  read.progress.wallet.balances.gold = -1;
  assert.equal((await store.read()).regions[0].region[0], 0);
  assert.notEqual((await store.read()).progress.wallet.balances.gold, -1);
  store.close();
});

test('fragmented regions use at most 512 binary bytes and restore canonical runs', async () => {
  const storage = new StorageFixture(), store = await LocalStorageSaveStore.open('player', storage);
  const runs = new Uint16Array(4096);
  for (let i = 0; i < runs.length; i += 2) runs[i] = runs[i + 1] = i;
  await store.commit(batch(1, [{ region: [0, -3, 0], removed: runs }]));
  const raw = storage.getItem('player');
  assert.equal(JSON.parse(raw).regions[0][3][0], 'b');
  assert.ok(raw.length < JSON.stringify(progress()).length + 1000);
  store.close();
  const reopened = await LocalStorageSaveStore.open('player', storage);
  assert.deepEqual((await reopened.read()).regions[0].removed, runs);
  const world = new SparseWorld(GAME_GENERATION);
  world.restoreRegion((await reopened.read()).regions[0]);
  assert.equal(world.removed, 2048);
  reopened.close();
});

test('stale revisions and missing region records cannot overwrite the last committed snapshot', async () => {
  const storage = new StorageFixture(), first = await LocalStorageSaveStore.open('player', storage);
  const other = await LocalStorageSaveStore.open('player', storage);
  await first.commit(batch(1));
  await other.read();
  await first.commit(batch(2));
  const before = storage.getItem('player');
  await assert.rejects(other.commit(batch(2)), SaveConflict);
  await assert.rejects(first.commit(batch(3, [], 1)), /不完整/);
  assert.equal(storage.getItem('player'), before);
  first.close(); other.close();
});

test('corrupt and unknown localStorage snapshots fail without replacing or clearing them', async () => {
  const valid = { storageVersion: 1, head: head(), progress: progress(), regions: [] };
  const cases = ['{broken', JSON.stringify({ ...valid, storageVersion: 99 }),
    JSON.stringify({ ...valid, head: head(1, 1) }),
    JSON.stringify({ ...valid, head: head(1, 1), regions: [[0, -3, 0, 'r' + btoa(String.fromCharCode(2, 0, 1, 0))]] }),
    JSON.stringify({ ...valid, head: head(1, 1), regions: [[0, -3, 0, 'b' + btoa('\0'.repeat(512))]] }),
    JSON.stringify({ ...valid, head: head(1, 2), regions: [[0, -3, 0, null], [0, -3, 0, null]] })];
  for (const raw of cases) {
    const storage = new StorageFixture(); storage.values.set('player', raw);
    const store = await LocalStorageSaveStore.open('player', storage);
    await assert.rejects(store.read());
    await assert.rejects(store.commit(batch(1)));
    assert.equal(storage.getItem('player'), raw);
    assert.equal(storage.writes, 0);
    store.close();
  }
});

test('quota failure preserves the exact previous save and dirty terrain; retry commits both together', async () => {
  const storage = new StorageFixture(), store = await LocalStorageSaveStore.open('player', storage);
  const session = GameSession.createNew(GAME_CONTENT.session), world = new SparseWorld(GAME_GENERATION);
  await store.commit({ ...batch(1), progress: session.exportProgress() });
  const before = storage.getItem('player');
  const saves = new SaveCoordinator(store, head(), () => session.exportProgress(), world);
  try {
    world.remove([cell]); session.devGrantCoins(123); saves.requestSave(false);
    storage.failure = new DOMException('Storage quota reached', 'QuotaExceededError');
    await assert.rejects(saves.flush(), { name: 'QuotaExceededError' });
    assert.equal(saves.getStatus().state, 'failed');
    assert.equal(saves.getStatus().revision, 1);
    assert.equal(world.hasUnsavedChanges(), true);
    assert.equal(storage.getItem('player'), before);
    storage.failure = null;
    await saves.flush();
    assert.equal(saves.getStatus().state, 'idle');
    assert.equal(world.hasUnsavedChanges(), false);
    const restored = await store.read();
    assert.equal(restored.head.revision, 2);
    assert.deepEqual(restored.progress, session.exportProgress());
    assert.equal(restored.regions.length, 1);
  } finally { await saves.stop(); store.close(); }
});

test('denied localStorage access propagates and a closed store rejects reads and writes', async () => {
  const storage = new StorageFixture(), store = await LocalStorageSaveStore.open('player', storage);
  storage.failure = new DOMException('Storage denied', 'SecurityError');
  await assert.rejects(store.read(), { name: 'SecurityError' });
  await assert.rejects(store.commit(batch(1)), { name: 'SecurityError' });
  storage.failure = null; store.close();
  await assert.rejects(store.read(), /已关闭/);
  await assert.rejects(store.commit(batch(1)), /已关闭/);
  assert.equal(storage.writes, 0);
});

test('ordinary and explicit acceptance bootstrap persist and reopen using separate localStorage keys', async () => {
  const storage = new StorageFixture();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_key, _options, callback) => callback({}) } });
  try {
    for (const search of ['', '?debug=1&saveTest=local-roundtrip']) {
      const target = saveNamespace({ pathname: '/games/mining/index.html', search });
      const signal = new AbortController().signal;
      const game = await openSavedGame(target.name, GAME_CONTENT.session, GAME_GENERATION, signal);
      const initial = game.session.getSnapshot().coins;
      game.session.devGrantCoins(123);
      await game.saves.flush();
      await game.close();
      assert.ok(storage.getItem(target.name));
      const restored = await openSavedGame(target.name, GAME_CONTENT.session, GAME_GENERATION, signal);
      try { assert.equal(restored.session.getSnapshot().coins, initial + 123); }
      finally { await restored.close(); }
    }
    assert.equal(storage.values.size, 2);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
    if (previousLocks) Object.defineProperty(navigator, 'locks', previousLocks);
    else delete navigator.locks;
  }
});
