// The game without rendering (P6, docs/phase-economy-calibration-20261029.md): the real session, terrain stream,
// character physics, scenery colliders and world borders, assembled the way startGame.ts does, on a simulated clock
// at 60 frames a second. Terrain jobs run synchronously in place of the workers (results arrive the next frame). A
// bot drives it through GameInput (movement, jump) and aims like the pointer does: a ray through selectCell, here
// from the eye straight at the cell it wants. Used by measure-headless.mts.
import { Group } from 'three';
import { GAME_CONTENT, GAME_GENERATION } from '../../src/game/content/gameContent.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { TerrainStream } from '../../src/game/validation/TerrainStream.ts';
import { CharacterPhysics, initPhysics } from '../../src/game/validation/physics.ts';
import { GameInput } from '../../src/game/GameInput.ts';
import { PlayerController } from '../../src/game/runtime/PlayerController.ts';
import { SceneryCollision } from '../../src/game/presentation/SceneryCollision.ts';
import { WorldBorders, journeySurfacePlan } from '../../src/game/presentation/WorldBorders.ts';
import { createScenerySites } from '../../src/game/world/createScenerySites.ts';
import { FEEDBACK_COLLISION_SITE } from '../../src/game/content/feedbackFacilities.ts';
import { buildRegion } from '../../src/game/terrain/meshing.ts';
import { selectCell } from '../../src/game/terrain/selection.ts';
import { CELL, type Coord } from '../../src/game/terrain/SparseWorld.ts';

export const FRAME = 1 / 60;
type Job = { id: number; epoch: number; transaction: number; kind: string; size: number; generation: unknown; regions: { coord: Coord; version: number; edits: unknown }[] };
/** A terrain worker that builds on the main thread when flushed. */
class InlineWorker {
  requests: Job[] = []; onmessage: ((e: { data: unknown }) => void) | null = null; onerror = null; onmessageerror = null;
  postMessage(job: Job) { this.requests.push(job); }
  flush() {
    let any = false;
    for (let job = this.requests.shift(); job; job = this.requests.shift()) {
      any = true;
      const results = job.regions.map(r => ({ version: r.version, data: buildRegion(job.kind as 'collision', r.coord, job.size, r.edits as never, job.generation as never) }));
      this.onmessage?.({ data: { id: job.id, epoch: job.epoch, transaction: job.transaction, results } });
    }
    return any;
  }
  terminate() {}
}

export async function createHeadlessGame(saved?: unknown) {
  await initPhysics();
  const content = GAME_CONTENT;
  const clock = { now: 0 };
  const session = new GameSession(content.session, undefined, () => clock.now, {}, saved);
  const physics = new CharacterPhysics();
  const workers: InlineWorker[] = [];
  const terrain = new TerrainStream(physics, GAME_GENERATION, () => { const w = new InlineWorker(); workers.push(w); return w as unknown as Worker; }, session.collected);
  const input = new GameInput();
  const player = new PlayerController(physics, terrain, input, session);
  const sites = [...createScenerySites(content.rooms, content.surface.plan), FEEDBACK_COLLISION_SITE, ...content.extraSites,
    ...content.worlds.slice(1).map(w => ({ id: `world${w.id}.surface`, depth: 0, plan: journeySurfacePlan(w.z) }))];
  const scenery = new SceneryCollision(physics, sites);
  const borders = new WorldBorders(physics, new Group());
  const detach = session.attach({
    cell: c => terrain.cell(c), canMine: c => terrain.canMine(c), pending: c => terrain.pending(c), pendingCount: () => terrain.pendingCount(),
    mine: targets => terrain.mineMany(targets), cancelMining: () => terrain.cancelPending(), travelTo: feet => player.travelTo(feet),
  });
  let yaw = 0, aimAt: Coord | null = null, mining = false;
  const flush = () => { for (let i = 0; i < 50; i++) if (!workers.map(w => w.flush()).some(Boolean)) break; };
  const game = {
    session, physics, terrain, input, player, clock,
    feet: () => physics.feet() as unknown as [number, number, number],
    get travelling() { return !!player.travelling; },
    /** Face this way (camera yaw: 0 looks toward -Z) and walk forward, or stop. */
    walk(towards: readonly number[] | null) {
      if (!towards) { input.move(0, 0); return; }
      const f = physics.feet(); yaw = Math.atan2(f[0] - towards[0], f[2] - towards[2]); input.move(0, 1);
    },
    jump() { input.jump('bot', true); input.jump('bot', false); },
    /** Hold the pick on this cell (null: let go). */
    aim(cell: Coord | null, hold = true) { aimAt = cell; mining = hold && !!cell; },
    /** The cell the pointer would select aiming at `cell` from the eye, if any. */
    select(cell: Coord): Coord | null {
      const f = physics.feet(), eye: Coord = [f[0], f[1] + 1.6, f[2]], c = cell.map(v => (v + .5) * CELL), d = c.map((v, i) => v - eye[i]), n = Math.hypot(...d);
      const hit = selectCell(eye, d.map(v => v / n) as Coord, [f[0], f[1] + 1, f[2]], x => terrain.cell(x));
      return hit && terrain.canMine(hit) ? hit : null;
    },
    /** One frame: physics at its fixed step, zones, the pick, terrain jobs. */
    frame() {
      clock.now += FRAME;
      session.advanceOnline(FRAME);
      scenery.sync(player.travelling ?? physics.feet());
      player.step(FRAME, yaw, () => {});
      const selected = aimAt && !player.travelling && terrain.ready(physics.feet()) ? game.select(aimAt) : null;
      session.selectTarget(selected);
      if (selected && mining) session.hit(selected);
      flush();
    },
    run(seconds: number, each?: () => boolean | void) { const end = clock.now + seconds; while (clock.now < end) { if (each?.() === true) return true; game.frame(); } return false; },
    /** Frames until the stream has the collision around the feet and any travel has landed. */
    settle(limit = 30) { return game.run(limit, () => !player.travelling && terrain.ready(physics.feet()) && physics.grounded); },
    dispose() { detach(); borders.dispose(); scenery.dispose(); terrain.dispose(); physics.dispose(); },
  };
  physics.teleport(content.returnPoint);
  terrain.recenter(physics.feet(), true);
  return game;
}
