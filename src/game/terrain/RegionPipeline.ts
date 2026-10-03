import { SparseWorld, CELL, chunkKey, validRegion, affectedRegions, type Coord } from './SparseWorld.ts';
import type { LayerKind, BuildJob, BuildReply, RegionData } from './meshing.ts';
export interface WorkerPort {
  onmessage: ((event: MessageEvent<BuildReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(job: BuildJob): void;
  terminate(): void;
}
export type WorkerFactory = () => WorkerPort;
export class Measurements {
  private values = new Map<string, number[]>();
  add(name: string, value: number) { const list = this.values.get(name) ?? []; list.push(value); if (list.length > 256) list.shift(); this.values.set(name, list); }
  snapshot() { return Object.fromEntries([...this.values].map(([key, values]) => { const sorted = [...values].sort((a, b) => a - b); return [key, { samples: values.length, p95: sorted[Math.floor((sorted.length - 1) * 0.95)], max: sorted.at(-1) }]; })); }
}
export type Resident<T> = { coord: Coord; version: number; resource: T };
type Stage<T> = { coord: Coord; version: number; resource?: T };
export interface RegionAdapter<T> {
  prepare(data: RegionData): T;
  activate(resource: T): void;
  dispose(resource: T): void;
}
export class RegionPipeline<T> {
  readonly residents = new Map<string, Resident<T>>();
  readonly desired = new Map<string, Coord>();
  readonly versions = new Map<string, number>();
  readonly staged = new Map<string, Stage<T>>();
  error: string | null = null;
  loaded = 0; unloaded = 0; staleResults = 0;
  private feet: readonly number[] = [0, 0, 0];
  private serial = 0; private epoch = 1;
  private inFlight: BuildJob | null = null;
  private replies: BuildReply[] = [];
  private results: { data: RegionData; version: number; transaction: number }[] = [];
  private transaction = 0;
  private edits: readonly Coord[] = [];
  private disposed = false;
  private readonly worker: WorkerPort;
  readonly kind: LayerKind;
  readonly size: number;
  private readonly loadRadius: number;
  private readonly unloadRadius: number;
  private readonly downAhead: number;
  private readonly world: SparseWorld;
  private readonly adapter: RegionAdapter<T>;
  private readonly metrics: Measurements;
  constructor(kind: LayerKind, size: number, loadRadius: number, unloadRadius: number, downAhead: number, world: SparseWorld, adapter: RegionAdapter<T>, metrics: Measurements, factory: WorkerFactory) {
    this.kind = kind; this.size = size; this.loadRadius = loadRadius; this.unloadRadius = unloadRadius; this.downAhead = downAhead;
    this.world = world; this.adapter = adapter; this.metrics = metrics;
    this.worker = factory();
    this.worker.onmessage = event => { if (!this.disposed) this.replies.push(event.data); };
    this.worker.onerror = event => { this.error = `${kind} Worker 失败：${event.message}`; };
    this.worker.onmessageerror = () => { this.error = `${kind} Worker 消息无法解码`; };
  }
  private version(key: string) { return this.versions.get(key) ?? 0; }
  private distance(c: Coord) {
    const side = this.size * CELL;
    return Math.max(...c.map((v, i) => Math.max(v * side - this.feet[i], this.feet[i] - (v + 1) * side, 0)));
  }
  recenter(feet: readonly number[]) {
    this.feet = [...feet]; this.desired.clear();
    const side = this.size * CELL, r = this.loadRadius;
    const min = feet.map((v, i) => Math.floor((v - r - (i === 1 ? this.downAhead : 0)) / side));
    const max = feet.map(v => Math.floor((v + r) / side));
    for (let z = min[2]; z <= max[2]; z++) for (let y = min[1]; y <= max[1]; y++) for (let x = min[0]; x <= max[0]; x++) {
      const c: Coord = [x, y, z]; if (validRegion(c, this.size)) this.desired.set(chunkKey(c), c);
    }
    for (const [key, item] of this.residents) if (this.distance(item.coord) > this.unloadRadius) {
      this.adapter.dispose(item.resource); this.residents.delete(key); this.unloaded++;
    }
    if (this.transaction) this.addStageTargets();
  }
  private affected(cells: readonly Coord[]) {
    return new Map(cells.flatMap(c => affectedRegions(c, this.size)).map(c => [chunkKey(c), c]));
  }
  private addStageTargets() {
    for (const [key, coord] of this.affected(this.edits)) if ((this.residents.has(key) || this.desired.has(key)) && !this.staged.has(key)) this.staged.set(key, { coord, version: this.version(key) });
  }
  stage(id: number, cells: readonly Coord[]) {
    this.cancelStage(); this.transaction = id; this.edits = cells; this.addStageTargets();
  }
  get stageReady() { return [...this.staged.values()].every(v => v.resource !== undefined); }
  commit(cells: readonly Coord[]) {
    // Called by the coordinator between physics steps after BOTH independent layers prepare.
    for (const [key] of this.affected(cells)) this.versions.set(key, this.version(key) + 1);
    for (const [key, item] of this.staged) {
      if (item.resource === undefined) throw new Error('提交了尚未准备的区域');
      if (this.residents.has(key) || this.desired.has(key)) this.install(key, item.coord, this.version(key), item.resource);
      else this.adapter.dispose(item.resource);
    }
    this.staged.clear(); this.transaction = 0; this.edits = [];
  }
  cancelStage() {
    for (const item of this.staged.values()) if (item.resource !== undefined) this.adapter.dispose(item.resource);
    this.staged.clear(); this.transaction = 0; this.edits = [];
  }
  relocate(feet: readonly number[]) {
    this.epoch++; this.cancelStage(); this.results = []; this.recenter(feet);
    // Keep the old request marked in flight until its reply; never queue unbounded worker work.
  }
  private install(key: string, coord: Coord, version: number, resource: T) {
    const old = this.residents.get(key);
    if (old) this.adapter.dispose(old.resource);
    this.adapter.activate(resource); this.residents.set(key, { coord, version, resource }); this.loaded++;
  }
  private validResult(result: { data: RegionData; version: number; transaction: number }) {
    const key = chunkKey(result.data.coord);
    return result.version === this.version(key) && (result.transaction
      ? result.transaction === this.transaction && this.staged.has(key)
      : this.desired.has(key) && !this.residents.has(key));
  }
  process(deadline: number) {
    for (const reply of this.replies.splice(0)) {
      const job = this.inFlight;
      if (!job || reply.id !== job.id) { this.staleResults++; continue; }
      this.inFlight = null;
      if (reply.epoch !== this.epoch || (reply.transaction && reply.transaction !== this.transaction)) { this.staleResults++; continue; }
      if (reply.error || !reply.results) { this.error = reply.error ?? `${this.kind} 缺少结果`; continue; }
      for (const result of reply.results) {
        this.metrics.add(`${this.kind}BuildMs`, result.data.buildMs);
        this.results.push({ ...result, transaction: reply.transaction });
      }
    }
    // Resource creation itself is indivisible. Stop starting more work after the budget;
    // measure single-operation overruns instead of claiming a hard latency guarantee.
    while (this.results.length && performance.now() < deadline) {
      const result = this.results.shift()!, key = chunkKey(result.data.coord);
      if (!this.validResult(result)) { this.staleResults++; continue; }
      const start = performance.now(), resource = this.adapter.prepare(result.data);
      this.metrics.add(`${this.kind}PrepareMs`, performance.now() - start);
      if (result.transaction) this.staged.get(key)!.resource = resource;
      else this.install(key, result.data.coord, result.version, resource);
    }
    this.dispatch();
  }
  private dispatch() {
    if (this.inFlight || this.results.length || this.error || this.disposed) return;
    const stage = [...this.staged.values()].filter(v => v.resource === undefined);
    const ordinary = [...this.desired].filter(([key]) => !this.residents.has(key)).map(([, coord]) => ({ coord }));
    const targets = stage.length ? stage : ordinary.sort((a, b) => this.distance(a.coord) - this.distance(b.coord));
    if (!targets.length) return;
    const transaction = stage.length ? this.transaction : 0;
    const job: BuildJob = { id: ++this.serial, epoch: this.epoch, transaction, kind: this.kind, size: this.size,
      regions: targets.slice(0, 8).map(({ coord }) => ({ coord, version: this.version(chunkKey(coord)), edits: this.world.snapshot(coord, this.size, transaction ? this.edits : []) })) };
    this.inFlight = job; this.worker.postMessage(job);
  }
  get busy() { return !!this.inFlight || !!this.results.length || !!this.replies.length; }
  get queueLength() { return [...this.desired.keys()].filter(key => !this.residents.has(key)).length + [...this.staged.values()].filter(v => v.resource === undefined).length; }
  has(coord: Coord) { const key = chunkKey(coord), item = this.residents.get(key); return !!item && item.version === this.version(key); }
  dispose() {
    this.disposed = true; this.worker.onmessage = null; this.worker.onerror = null; this.worker.onmessageerror = null; this.worker.terminate();
    this.cancelStage(); for (const item of this.residents.values()) this.adapter.dispose(item.resource);
    this.residents.clear(); this.desired.clear(); this.versions.clear(); this.replies = []; this.results = []; this.inFlight = null;
  }
}
