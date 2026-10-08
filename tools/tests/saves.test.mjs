import test from "node:test";
import assert from "node:assert/strict";
import { GameSession } from "../../src/game/application/GameSession.ts";
import { PetCommands } from "../../src/game/application/PetCommands.ts";
import { SESSION_CONTENT } from "../../src/game/world/sessionContent.ts";
import { withInitialAccess } from "../../src/game/content/initialAccess.ts";
import {
  SparseWorld,
  WORLD_GENERATION,
} from "../../src/game/terrain/SparseWorld.ts";
import { readRegion } from "../../src/game/terrain/WorldSaveCodec.ts";
import { SaveCoordinator } from "../../src/game/persistence/SaveCoordinator.ts";
import {
  readHead,
  SaveConflict,
} from "../../src/game/persistence/saveTypes.ts";
import { compatibleHead } from "../../src/game/persistence/saveMigrations.ts";
import { saveNamespace } from "../../src/game/persistence/SaveBootstrap.ts";
const head = () => ({
  formatVersion: 1,
  revision: 1,
  savedAt: 1,
  world: { generationVersion: 8, seed: 0, regionEncoding: 1 },
  regionCount: 0,
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const cells = [
  [-10, -30, -10],
  [-9, -30, -10],
  [-8, -30, -10],
];
function fixture(commit = async () => {}) {
  const session = GameSession.createNew(SESSION_CONTENT),
    world = new SparseWorld();
  const batches = [];
  const store = {
    commit: async (batch) => {
      batches.push(structuredClone(batch));
      await commit(batch);
    },
    close() {},
    read: async () => ({ kind: "missing" }),
  };
  const saves = new SaveCoordinator(
    store,
    head(),
    () => session.exportProgress(),
    world,
  );
  const unsub = session.onProgressCommitted(({ urgent }) =>
    saves.requestSave(urgent),
  );
  return {
    session,
    world,
    saves,
    batches,
    async dispose() {
      unsub();
      await saves.stop();
    },
  };
}
test("session round-trip restores resources and equipment without granting starting coins again", () => {
  const s = GameSession.createNew(SESSION_CONTENT);
  const pet = s.pets.hatch("meadow-egg").pet;
  s.pets.equip(pet.id);
  s.collected(Array.from({ length: 60 }, () => ({ kind: 8 })));
  s.upgradePickaxe(1);
  s.updatePosition([0, -123.5, 0], false);
  const data = s.exportProgress(),
    restored = GameSession.fromData(data, SESSION_CONTENT);
  assert.deepEqual(restored.exportProgress(), data);
  assert.ok(restored.getSnapshot().coins < 200);
  assert.equal(restored.getSnapshot().inventory.used, 60);
  assert.equal(restored.getSnapshot().inventory.isFull, true);
  assert.equal(restored.pets.getSnapshot().slots[0], pet.id);
  assert.deepEqual(
    restored.getSnapshot().miningStats,
    s.getSnapshot().miningStats,
  );
  data.inventory.items["ore.soil"] = 1;
  assert.equal(restored.getSnapshot().inventory.used, 60);
});
test("restore rejects missing/unknown/partial data, never creates a new player", () => {
  const good = GameSession.createNew(SESSION_CONTENT).exportProgress();
  for (const value of [
    undefined,
    null,
    {},
    { ...good, version: 2 },
    { ...good, wallet: { version: 1, coins: -1 } },
    { ...good, pets: undefined },
    {
      ...good,
      exploration: {
        version: 1,
        maxDepth: 2,
        unlockedDestinationIds: ["missing"],
      },
    },
  ])
    assert.throws(() => GameSession.fromData(value, SESSION_CONTENT));
  assert.equal(GameSession.createNew(SESSION_CONTENT).getSnapshot().coins, 200);
});
test("preview access is not earned; actual depth changes notify without a new unlock", () => {
  const s = GameSession.createNew(withInitialAccess(SESSION_CONTENT)),
    notifications = [];
  s.onProgressCommitted((c) => notifications.push(c));
  assert.ok(s.getSnapshot().destinations.every((d) => d.unlocked));
  assert.deepEqual(s.exportProgress().exploration.unlockedDestinationIds, []);
  s.updatePosition([0, -10.2, 0], false);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].urgent, false);
  s.updatePosition([0, -10.21, 0], false);
  assert.equal(notifications.length, 2);
  s.updatePosition([0, -9, 0], false);
  assert.equal(notifications.length, 2);
  s.selectTarget(null);
  s.resetPosition();
  assert.equal(notifications.length, 2);
  const first = SESSION_CONTENT.destinations[0];
  s.updatePosition([0, -first.depth, 0], false);
  assert.ok(
    s.exportProgress().exploration.unlockedDestinationIds.includes(first.id),
  );
  assert.equal(notifications.at(-1).urgent, true);
  const restored = GameSession.fromData(s.exportProgress(), SESSION_CONTENT);
  assert.equal(
    restored.getSnapshot().destinations.find((d) => d.id === first.id).unlocked,
    true,
  );
  assert.ok(restored.getSnapshot().destinations.some((d) => !d.unlocked));
});
test("pet commands settle first, notify once, and rejected commands do not dirty progress", () => {
  const s = GameSession.createNew(SESSION_CONTENT),
    states = [];
  s.onProgressCommitted(() => states.push(s.exportProgress()));
  s.pets.hatch("unknown");
  assert.equal(states.length, 0);
  const r = s.pets.hatch("meadow-egg");
  assert.equal(states.length, 1);
  assert.equal(states[0].wallet.coins, 190);
  assert.equal(states[0].pets.inventory.pets.length, 1);
  s.pets.equip(r.pet.id);
  s.pets.equip(r.pet.id);
  assert.equal(states.length, 2);
  s.setSuspended(true);
  assert.throws(() => s.pets.hatch("meadow-egg"));
  assert.equal(s.getSnapshot().coins, 190);
});
test("world captures independent sparse data and restores negative coordinates", () => {
  const world = new SparseWorld();
  assert.equal(world.remove(cells).length, 3);
  const capture = world.captureChanges();
  assert.equal(capture.regions.length, 1);
  const restored = new SparseWorld();
  for (const region of capture.regions) restored.restoreRegion(region);
  for (const cell of cells) assert.equal(restored.cell(cell), 0);
  assert.equal(restored.removed, 3);
  assert.equal(restored.saveChanges.pending, false);
  const baseline = restored.cell([-7, -30, -10]);
  capture.regions[0].removed.fill(0);
  assert.equal(restored.cell([-7, -30, -10]), baseline);
});
test("world capture acknowledgment does not clear a later edit in the same region", () => {
  const w = new SparseWorld();
  w.remove([cells[0]]);
  const a = w.captureChanges();
  w.remove([cells[1]]);
  w.saveChanges.acknowledge(a.token);
  assert.equal(w.saveChanges.pending, true);
  const b = w.captureChanges();
  w.saveChanges.acknowledge(b.token);
  assert.equal(w.saveChanges.pending, false);
  assert.equal(a.regions[0].removed[1] - a.regions[0].removed[0], 0);
  assert.equal(b.regions[0].removed[1] - b.regions[0].removed[0], 1);
});
test("world codec rejects malformed ranges, protected floors, duplicates, and out-of-bounds full regions", () => {
  for (const removed of [
    new Uint16Array([]),
    new Uint16Array([2]),
    new Uint16Array([5, 4]),
    new Uint16Array([2, 2, 3, 3]),
    new Uint16Array([0, 4096]),
    [0, 1],
  ]) {
    assert.throws(() =>
      readRegion({ region: [0, -2, 0], removed }, () => true),
    );
  }
  assert.throws(() =>
    readRegion({ region: [0, -1, 0], removed: null }, () => false),
  );
  assert.throws(() =>
    new SparseWorld().restoreRegion({ region: [3, -2, 0], removed: null }),
  );
  const w = new SparseWorld();
  w.remove([cells[0]]);
  const data = w.captureChanges().regions[0],
    restored = new SparseWorld();
  restored.restoreRegion(data);
  assert.throws(() => restored.restoreRegion(data));
  assert.throws(() => w.restoreRegion(data));
});
test("fully removed region restores compactly without allocating voxel objects", () => {
  const w = new SparseWorld();
  w.restoreRegion({ region: [0, -3, 0], removed: null });
  assert.equal(w.removed, 4096);
  assert.equal(w.stats().editBytes, 0);
  assert.equal(w.cell([0, -48, 0]), 0);
  assert.equal(w.cell([15, -33, 15]), 0);
});
test("one write in flight; edit B survives acknowledgment of A and saves a coherent second batch", async () => {
  const gate = deferred();
  let n = 0;
  const f = fixture(async () => {
    if (!n++) await gate.promise;
  });
  try {
    f.world.remove([cells[0]]);
    f.session.collected([{ kind: 8 }]);
    const flushing = f.saves.flush();
    assert.equal(f.batches.length, 1);
    f.world.remove([cells[1]]);
    f.session.collected([{ kind: 8 }]);
    assert.equal(f.batches.length, 1);
    assert.equal(f.batches[0].progress.inventory.items["ore.soil"], 1);
    gate.resolve();
    await flushing;
    assert.equal(f.batches.length, 2);
    assert.equal(f.batches[1].progress.inventory.items["ore.soil"], 2);
    assert.equal(f.batches[1].expectedRevision, 2);
    assert.equal(f.batches[1].head.revision, 3);
    assert.equal(f.world.saveChanges.pending, false);
    assert.equal(f.saves.getStatus().state, "idle");
  } finally {
    gate.resolve();
    await f.dispose();
  }
});
test("failed commit retains dirty world and economy; retry does not duplicate rewards", async () => {
  let fail = true;
  const f = fixture(async () => {
    if (fail) throw Error("quota");
  });
  try {
    f.world.remove([cells[0]]);
    f.session.collected([{ kind: 8 }]);
    await assert.rejects(f.saves.flush(), /quota/);
    assert.equal(f.saves.getStatus().revision, 1);
    assert.equal(f.world.saveChanges.pending, true);
    assert.equal(f.saves.getStatus().state, "failed");
    fail = false;
    await f.saves.flush();
    assert.equal(f.session.exportProgress().inventory.items["ore.soil"], 1);
    assert.equal(f.batches[1].expectedRevision, 1);
    assert.equal(f.saves.getStatus().revision, 2);
  } finally {
    await f.dispose();
  }
});
test("a conflict stops automatic overwrite and a fatal error cannot be marked saved by an older completion", async () => {
  const gate = deferred();
  const f = fixture(() => gate.promise);
  try {
    f.session.pets.hatch("meadow-egg");
    const work = f.saves.flush();
    f.saves.invalidate(Error("partial settlement"));
    gate.resolve();
    await assert.rejects(work, /partial/);
    assert.equal(f.saves.getStatus().state, "conflicted");
    await assert.rejects(f.saves.flush(), /partial/);
  } finally {
    gate.resolve();
    await f.dispose();
  }
  const g = fixture(async () => {
    throw new SaveConflict();
  });
  try {
    g.session.pets.hatch("meadow-egg");
    await assert.rejects(g.saves.flush(), SaveConflict);
    assert.equal(g.saves.getStatus().state, "conflicted");
  } finally {
    await g.dispose();
  }
});
test("idle flush performs no write, and unrelated pet save does not rewrite acknowledged terrain", async () => {
  const f = fixture();
  try {
    await f.saves.flush();
    assert.equal(f.batches.length, 0);
    f.world.remove([cells[0]]);
    f.session.collected([{ kind: 8 }]);
    await f.saves.flush();
    f.session.pets.hatch("meadow-egg");
    await f.saves.flush();
    assert.equal(f.batches[1].regions.length, 0);
    assert.equal(f.batches[1].head.regionCount, 1);
  } finally {
    await f.dispose();
  }
});
test("database namespaces are stable and separate production, preview, acceptance, and sample worlds", () => {
  assert.equal(
    saveNamespace({ pathname: "/games/mining/index.html", search: "" }).name,
    "mining:production",
  );
  assert.equal(
    saveNamespace({ pathname: "/games/mining-test/index.html", search: "" })
      .name,
    "mining:test",
  );
  assert.equal(
    saveNamespace({
      pathname: "/games/mining-test/index.html",
      search: "?debug=1&saveTest=case-1",
    }).name,
    "mining:acceptance:case-1",
  );
  assert.equal(
    saveNamespace({
      pathname: "/games/mining/index.html",
      search: "?debug=1&samples=1",
    }).name,
    "mining:production:samples",
  );
  assert.throws(() =>
    saveNamespace({ pathname: "/", search: "?debug=1&saveTest=../../bad" }),
  );
});
test("unknown formats and changed terrain generations are rejected without silently resetting", () => {
  assert.throws(() => readHead({ ...head(), formatVersion: 2 }));
  assert.throws(() =>
    compatibleHead(
      { ...head(), world: { ...head().world, generationVersion: 7 } },
      WORLD_GENERATION,
    ),
  );
  assert.throws(() => readHead({ ...head(), regionCount: 7000 }));
  assert.equal(compatibleHead(head(), WORLD_GENERATION).revision, 1);
});

test("continuous normal changes keep the original two-second deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  try {
    f.session.collected([{ kind: 8 }]);
    for (let i = 0; i < 3; i++) {
      t.mock.timers.tick(500);
      f.session.collected([{ kind: 8 }]);
    }
    assert.equal(f.batches.length, 0);
    t.mock.timers.tick(500);
    assert.equal(f.batches.length, 1);
    assert.equal(f.batches[0].progress.inventory.items["ore.soil"], 4);
    await f.saves.flush();
    t.mock.timers.tick(10000);
    assert.equal(f.batches.length, 1);
  } finally {
    await f.dispose();
  }
});
test("urgent request shortens a normal save deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  try {
    f.session.collected([{ kind: 8 }]);
    t.mock.timers.tick(100);
    f.session.pets.hatch("meadow-egg");
    t.mock.timers.tick(0);
    assert.equal(f.batches.length, 1);
    assert.equal(f.batches[0].progress.wallet.coins, 190);
    await f.saves.flush();
  } finally {
    await f.dispose();
  }
});

test("ordinary edits during a slow write do not turn autosave into continuous writes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gate = deferred();
  let writes = 0;
  const f = fixture(async () => {
    if (!writes++) await gate.promise;
  });
  try {
    f.session.collected([{ kind: 8 }]);
    t.mock.timers.tick(2000);
    assert.equal(f.batches.length, 1);
    f.session.collected([{ kind: 8 }]);
    gate.resolve();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    t.mock.timers.tick(1500);
    assert.equal(f.batches.length, 1);
    t.mock.timers.tick(600);
    assert.equal(f.batches.length, 2);
    await f.saves.flush();
  } finally {
    gate.resolve();
    await f.dispose();
  }
});

test("a saving-status subscriber can flush without starting a reentrant transaction", async () => {
  const f = fixture();
  let nested;
  const off = f.saves.subscribe(() => {
    if (f.saves.getStatus().state === "saving") nested = f.saves.flush();
  });
  try {
    f.session.collected([{ kind: 8 }]);
    await f.saves.flush();
    await nested;
    assert.equal(f.batches.length, 1);
  } finally {
    off();
    await f.dispose();
  }
});
