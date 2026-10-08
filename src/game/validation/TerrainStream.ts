import { ORE_SAMPLES } from '../terrain/minerals.ts';
import { type CharacterPhysics } from './physics.ts';
import { SparseWorld, WORLD_GENERATION, type WorldGeneration, CELL, RENDER_SIZE, COLLISION_SIZE, regionOf, chunkKey, validRegion, inBounds, type Coord } from '../terrain/SparseWorld.ts';
import { RenderTerrain, CollisionTerrain } from '../terrain/TerrainLayers.ts';
import { Measurements, type WorkerFactory } from '../terrain/RegionPipeline.ts';
export type ExcavatedCell = Readonly<{ cell: Coord; kind: number }>;
export class TerrainStream {
  readonly world: SparseWorld;
  readonly measurements = new Measurements();
  readonly render: RenderTerrain;
  readonly collision: CollisionTerrain;
  private readonly waiting = new Map<string, Coord>();
  private readonly groups: Coord[][] = [];
  private readonly acceptedAt = new Map<string, number>();
  private transaction: { id: number; cells: Coord[]; started: number } | null = null;
  private serial = 0;
  private lastCenter = '';
  disposed = false;
  error: string | null = null;
  private readonly physics: CharacterPhysics;
  private onExcavated: (resources: readonly ExcavatedCell[]) => void;
  constructor(physics: CharacterPhysics, factory: WorkerFactory = () => new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' }), onExcavated: (resources: readonly ExcavatedCell[]) => void = () => {}, generation: WorldGeneration = WORLD_GENERATION, restoredWorld?: SparseWorld) {
    this.world = restoredWorld ?? new SparseWorld(generation);
    this.onExcavated = onExcavated;
    this.physics = physics;
    this.render = new RenderTerrain(this.world, this.measurements, factory);
    this.collision = new CollisionTerrain(this.world, physics, this.measurements, factory);
  }
  get group() { return this.render.group; }
  recenter(feet: readonly number[], force = false) {
    // Reconsider the physical window every 4 m, independently of either mesh grid.
    const key = feet.map(v => Math.floor(v / 4)).join(',');
    if (!force && key === this.lastCenter) return;
    this.lastCenter = key; this.render.pipeline.recenter(feet); this.collision.pipeline.recenter(feet);
  }
  process() {
    if (this.disposed || this.error) return;
    const start = performance.now(), deadline = start + 2;
    if (!this.transaction && this.waiting.size) {
      // A multi-target request is indivisible; the 8-cell scheduling target is
      // not a limit on one collection. Workers still build at most 8 regions/job.
      const cells = this.groups.shift()!;
      while (this.groups.length && cells.length + this.groups[0].length <= 8) cells.push(...this.groups.shift()!);
      for (const c of cells) this.waiting.delete(chunkKey(c));
      this.transaction = { id: ++this.serial, cells, started: start };
      this.render.pipeline.stage(this.serial, cells); this.collision.pipeline.stage(this.serial, cells);
    }
    // Near physics takes priority; rendering has a separate worker/queue/cache.
    this.collision.pipeline.process(deadline); this.render.pipeline.process(deadline);
    this.error = this.collision.pipeline.error ?? this.render.pipeline.error;
    if (this.error) return;
    const txn = this.transaction;
    if (txn && this.collision.pipeline.stageReady && this.render.pipeline.stageReady) {
      // No world.step or draw occurs inside this synchronous committed-version switch.
      const resources = new Map(txn.cells.map(cell => [chunkKey(cell), { cell, kind: this.world.cell(cell) }]));
      const removed = this.world.remove(txn.cells);
      this.collision.pipeline.commit(txn.cells); this.render.pipeline.commit(txn.cells);
      this.measurements.add('batchBuildCommitMs', performance.now() - txn.started);
      for (const c of txn.cells) { const key = chunkKey(c); this.measurements.add('editLatencyMs', performance.now() - this.acceptedAt.get(key)!); this.acceptedAt.delete(key); }
      this.transaction = null;
      if (removed.length) this.onExcavated(removed.map(cell => resources.get(chunkKey(cell))!));
    }
    this.measurements.add('terrainMainMs', performance.now() - start);
  }
  cell(c: Coord): number | null {
    if (!c.every(Number.isInteger)) return null;
    if (c[1] >= 0 && c[0] >= -48 && c[0] <= 51 && c[2] >= -48 && c[2] <= 51) return 0;
    return inBounds(c) ? this.world.cell(c) : null;
  }
  canMine(c: Coord) { return c.every(Number.isInteger) && inBounds(c) && this.world.canMine(c); }
  ready(feet: readonly number[]) {
    // Covers the 10.5 m camera boom, capsule sweep and downward lookahead.
    const side = COLLISION_SIZE * CELL;
    const min = feet.map((v, i) => Math.floor((v - 12) / side));
    const max = feet.map(v => Math.floor((v + 12) / side));
    for (let z = min[2]; z <= max[2]; z++) for (let y = min[1]; y <= max[1]; y++) for (let x = min[0]; x <= max[0]; x++) {
      const c: Coord = [x, y, z]; if (validRegion(c, COLLISION_SIZE) && !this.collision.pipeline.has(c)) return false;
    }
    return !this.error;
  }
  pending(cell: Coord) { return this.waiting.has(chunkKey(cell)) || !!this.transaction?.cells.some(c => chunkKey(c) === chunkKey(cell)); }
  mine(cell: Coord) {
    return this.mineMany([cell]);
  }
  mineMany(targets: readonly Coord[]) {
    if (this.disposed || this.error) return false;
    const unique = new Map<string, Coord>();
    for (const cell of targets) {
      if (cell.length !== 3 || !cell.every(Number.isInteger)) return false;
      const key = chunkKey(cell);
      if (this.canMine(cell) && !this.waiting.has(key) && !this.transaction?.cells.some(c => chunkKey(c) === key)) unique.set(key, [...cell]);
    }
    if (!unique.size || this.waiting.size + unique.size > 32) return false;
    const now = performance.now(), cells = [...unique.values()];
    for (const cell of cells) { const key = chunkKey(cell); this.waiting.set(key, cell); this.acceptedAt.set(key, now); }
    this.groups.push(cells); return true;
  }
  cancelPending() {
    this.waiting.clear(); this.groups.length = 0; this.acceptedAt.clear(); this.transaction = null;
    this.render.pipeline.cancelStage(); this.collision.pipeline.cancelStage();
  }
  relocate(feet: readonly number[]) {
    this.cancelPending();
    this.render.pipeline.relocate(feet); this.collision.pipeline.relocate(feet); this.lastCenter = ''; this.recenter(feet, true);
  }
  sampleStats() {
    return ORE_SAMPLES.map(sample => {
      const render = this.render.pipeline.residents.get(chunkKey([sample.x / 16, -1, sample.z / 16]));
      const physical = [0, 1, 2, 3].map(i => this.collision.pipeline.residents.get(chunkKey([sample.x / 8 + (i % 2), -1, sample.z / 8 + Math.floor(i / 2)])));
      return { name: sample.name, renderTriangles: render?.resource.triangles ?? null,
        collisionTriangles: physical.every(Boolean) ? physical.reduce((n, r) => n + r!.resource.triangles, 0) : null };
    });
  }
  snapshot() {
    const r = this.render.pipeline, p = this.collision.pipeline, visuals = [...r.residents.values()].map(v => v.resource), physical = [...p.residents.values()].map(v => v.resource);
    return { generation: this.world.generation, logicalCells: 20_000_000, cellBytes: 0, ...this.world.stats(), revision: this.world.revision, committedEdits: this.world.removed,
      chunks: r.residents.size, meshes: visuals.filter(v => v.mesh).length, physicsRegions: p.residents.size, terrainColliders: this.collision.handles.size,
      worldColliders: this.physics.world.colliders.len(), meshBytes: visuals.reduce((n, v) => n + v.bytes, 0), collisionGeometryBytes: physical.reduce((n, v) => n + v.bytes, 0),
      triangles: visuals.reduce((n, v) => n + v.triangles, 0), collisionTriangles: physical.reduce((n, v) => n + v.triangles, 0),
      renderQueue: r.queueLength, physicsQueue: p.queueLength, queue: r.queueLength + p.queueLength,
      inFlight: r.busy || p.busy, pendingEdit: !!this.transaction || this.waiting.size > 0, pendingCells: this.waiting.size + (this.transaction?.cells.length ?? 0),
      loaded: r.loaded, unloaded: r.unloaded, physicsUnloaded: p.unloaded, collidersCreated: this.collision.created, collidersRemoved: this.collision.removed,
      staleResults: r.staleResults + p.staleResults, error: this.error, timings: this.measurements.snapshot() };
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.cancelPending(); this.render.dispose(); this.collision.dispose(); this.onExcavated = () => {};
  }
}
