// Pure-data fixture; no private playable preview or device FPS claims.
import { writeFileSync, mkdirSync } from "node:fs";
import { GameSession } from "../../src/game/application/GameSession.ts";
import { SESSION_CONTENT } from "../../src/game/world/sessionContent.ts";
import { SparseWorld } from "../../src/game/terrain/SparseWorld.ts";
const world = new SparseWorld(),
  cells = [];
for (let y = -40; y > -1600; y -= 16)
  for (let x = -40; x <= 40; x += 16)
    for (let z = -40; z <= 40; z += 16) {
      if (cells.length >= 100000) break;
      for (let n = 0; n < 32; n++)
        cells.push([x + (n % 8), y - Math.floor(n / 8), z]);
    }
world.remove(cells);
const first = world.captureChanges();
const restored = new SparseWorld(),
  restoreAt = performance.now();
for (const r of first.regions) restored.restoreRegion(r);
const restoreMs = performance.now() - restoreAt;
world.acknowledgeChanges(first.token);
const p = GameSession.createNew(SESSION_CONTENT).exportProgress();
p.pets.inventory.pets = Array.from({ length: 5000 }, (_, n) => ({
  id: `fixture-${n}`,
  speciesId: "moss-slime",
  level: 1,
}));
p.pets.equipment.slots = ["fixture-0", "fixture-1", "fixture-2"];
const session = GameSession.fromData(p, SESSION_CONTENT);
const captures = [];
for (let n = 0; n < 50; n++) {
  const c = [-39, -40, -39 + (n % 2)]; // remove only once; remaining runs also exercise idle captures.
  world.remove([c]);
  const t = performance.now(),
    data = session.exportProgress(),
    regions = world.captureChanges();
  captures.push(performance.now() - t);
  if (n === 0 && regions.regions.length !== 1)
    throw Error("incremental capture scanned unrelated regions");
  structuredClone({ data, regions: regions.regions });
  world.acknowledgeChanges(regions.token);
}
captures.sort((a, b) => a - b);
const report = {
  environment:
    "Node pure-data benchmark; not browser frame or phone acceptance",
  removed: world.removed,
  regions: first.regions.length,
  bytes: world.stats().editBytes,
  pets: 5000,
  restoreMs,
  captureP95Ms: captures[Math.floor(captures.length * 0.95)],
  captureMaxMs: captures.at(-1),
  allRegionsRestored:
    restored.removed ===
    first.regions.reduce(
      (n, r) =>
        n +
        (r.removed === null
          ? 4096
          : Array.from(r.removed).reduce(
              (a, v, i, arr) => (i % 2 ? a + v - arr[i - 1] + 1 : a),
              0,
            )),
      0,
    ),
};
mkdirSync("artifacts/saves", { recursive: true });
writeFileSync(
  "artifacts/saves/data-benchmark.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
