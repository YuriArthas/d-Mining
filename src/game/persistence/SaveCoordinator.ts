import type { WorldSaveSource } from "./WorldSaveSource.ts";
import type { SaveStore } from "./SaveStore.ts";
import {
  SaveConflict,
  type SaveHeadV1,
  type ProgressDataV1,
  type SaveStatus,
} from "./saveTypes.ts";
export class SaveCoordinator {
  private status: SaveStatus;
  private changes = 0;
  private acknowledged = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | null = null;
  private disposed = false;
  private blocked = false;
  private failures = 0;
  private dueAt = Infinity;
  private listeners = new Set<() => void>();
  private readonly store: SaveStore;
  private readonly progress: () => ProgressDataV1;
  private readonly world: WorldSaveSource;
  private head: SaveHeadV1;
  readonly metrics = {
    writes: 0,
    captureMs: 0,
    transactionMs: 0,
    regionWrites: 0,
    regionBytes: 0,
  };
  constructor(
    store: SaveStore,
    head: SaveHeadV1,
    progress: () => ProgressDataV1,
    world: WorldSaveSource,
  ) {
    this.store = store;
    this.head = head;
    this.progress = progress;
    this.world = world;
    this.status = {
      state: "idle",
      revision: head.revision,
      savedAt: head.savedAt,
      error: null,
    };
  }
  getStatus = () => this.status;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(status: SaveStatus) {
    this.status = Object.freeze(status);
    for (const listener of this.listeners) listener();
  }
  private get dirty() {
    return this.changes !== this.acknowledged || this.world.hasUnsavedChanges();
  }
  requestSave(urgent: boolean) {
    if (this.disposed || this.blocked) return;
    this.changes++;
    this.dueAt = Math.min(this.dueAt, performance.now() + (urgent ? 0 : 2000));
    if (this.status.state === "idle")
      this.publish({ ...this.status, state: "dirty" });
    if (!this.inFlight && !this.failures)
      this.schedule(Math.max(0, this.dueAt - performance.now()), urgent);
  }
  private schedule(delay: number, replace = false) {
    if (this.disposed || this.blocked) return;
    if (this.timer !== undefined && !replace) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.write().catch(() => {});
    }, delay);
  }
  private write(): Promise<void> {
    if (this.disposed || this.blocked)
      return Promise.reject(Error(this.status.error ?? "存档会话已关闭"));
    if (this.inFlight) return this.inFlight;
    if (!this.dirty) return Promise.resolve();
    const start = performance.now();
    this.dueAt = Infinity;
    // No await between the player and world captures. Notifications schedule work;
    // they never capture from inside a terrain removal or a sale's partial update.
    let progress: ProgressDataV1,
      world: ReturnType<WorldSaveSource["captureChanges"]>;
    try {
      progress = this.progress();
      world = this.world.captureChanges();
    } catch (error) {
      this.invalidate(error);
      return Promise.reject(error);
    }
    const token = this.changes,
      head: SaveHeadV1 = {
        ...this.head,
        revision: this.head.revision + 1,
        savedAt: Date.now(),
        regionCount: world.totalRegionCount,
      };
    this.metrics.captureMs = performance.now() - start;
    const submittedAt = performance.now();
    this.inFlight = this.store
      .commit({
        expectedRevision: this.head.revision,
        head,
        progress,
        regions: world.regions,
      })
      .then(() => {
        this.head = head;
        this.acknowledged = token;
        this.world.acknowledgeChanges(world.token);
        this.failures = 0;
        this.metrics.writes++;
        this.metrics.regionWrites = world.regions.length;
        this.metrics.regionBytes = world.regions.reduce(
          (n, r) => n + (r.removed?.byteLength ?? 0),
          0,
        );
        this.metrics.transactionMs = performance.now() - submittedAt;
        if (!this.blocked && !this.disposed)
          this.publish({
            state: this.dirty ? "dirty" : "idle",
            revision: head.revision,
            savedAt: head.savedAt,
            error: null,
          });
      })
      .catch((error) => {
        this.failures++;
        if (error instanceof SaveConflict) this.blocked = true;
        if (!this.disposed && !this.blocked)
          this.publish({
            ...this.status,
            state: "failed",
            error: String(error),
          });
        else if (!this.disposed && error instanceof SaveConflict)
          this.publish({
            ...this.status,
            state: "conflicted",
            error: error.message,
          });
        throw error;
      })
      .finally(() => {
        this.inFlight = null;
        if (this.dirty && !this.blocked && !this.disposed && this.failures <= 3)
          this.schedule(
            this.failures
              ? Math.min(30000, 2000 * 2 ** this.failures)
              : Number.isFinite(this.dueAt)
                ? Math.max(0, this.dueAt - performance.now())
                : 2000,
          );
      });
    this.publish({ ...this.status, state: "saving", error: null });
    return this.inFlight;
  }
  async flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    do {
      await this.write();
    } while (this.dirty && !this.disposed && !this.blocked);
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.blocked || this.disposed)
      throw Error(this.status.error ?? "存档会话已关闭");
  }
  invalidate(error: unknown) {
    if (this.blocked || this.disposed) return;
    this.blocked = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.publish({ ...this.status, state: "conflicted", error: String(error) });
  }
  async stop() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.inFlight?.catch(() => {});
    this.listeners.clear();
  }
}
