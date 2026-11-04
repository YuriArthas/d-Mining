import { record } from "../logic/data.ts";
import type { RegionDataV1 } from "../terrain/WorldSaveCodec.ts";
import type { SaveStore } from "./SaveStore.ts";
import { readHead, SaveConflict, type SaveBatchV1, type SaveRead } from "./saveTypes.ts";

type EncodedRegion = [number, number, number, string | null];
type Snapshot = {
  storageVersion: 1;
  head: SaveBatchV1["head"];
  progress: SaveBatchV1["progress"];
  regions: EncodedRegion[];
};
type StoragePort = Pick<Storage, "getItem" | "setItem">;

function coordinate(value: unknown): asserts value is EncodedRegion {
  if (!Array.isArray(value) || value.length !== 4 ||
    !value.slice(0, 3).every(Number.isSafeInteger) ||
    value[0] < -3 || value[0] > 3 || value[1] < -125 || value[1] > -1 ||
    value[2] < -17 || value[2] > 3)
    throw Error("矿坑区域坐标错误");
}

function validateRuns(runs: Uint16Array) {
  if (!runs.length || runs.length % 2 || runs.length > 4096)
    throw Error("矿坑删除区间错误");
  let last = -2;
  for (let i = 0; i < runs.length; i += 2) {
    if (runs[i] <= last + 1 || runs[i + 1] < runs[i] || runs[i + 1] > 4095)
      throw Error("矿坑删除区间未规范化");
    last = runs[i + 1];
  }
}

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

/** Small edits use little-endian runs; fragmented regions use a bounded 512-byte bitmap. */
function encode(region: RegionDataV1): EncodedRegion {
  const entry: EncodedRegion = [...region.region, null];
  coordinate(entry);
  const runs = region.removed;
  if (runs === null) return entry;
  if (!(runs instanceof Uint16Array)) throw Error("矿坑删除区间错误");
  validateRuns(runs);
  if (runs.byteLength <= 512) {
    const bytes = new Uint8Array(runs.byteLength);
    const view = new DataView(bytes.buffer);
    runs.forEach((value, i) => view.setUint16(i * 2, value, true));
    entry[3] = "r" + base64(bytes);
  } else {
    const bytes = new Uint8Array(512);
    for (let i = 0; i < runs.length; i += 2)
      for (let cell = runs[i]; cell <= runs[i + 1]; cell++)
        bytes[cell >> 3] |= 1 << (cell & 7);
    entry[3] = "b" + base64(bytes);
  }
  return entry;
}

function decode(entry: EncodedRegion): RegionDataV1 {
  const region: RegionDataV1["region"] = [entry[0], entry[1], entry[2]];
  if (entry[3] === null) return { region, removed: null };
  if (typeof entry[3] !== "string" || entry[3].length > 685)
    throw Error("矿坑编码错误");
  const kind = entry[3][0], payload = entry[3].slice(1);
  const binary = atob(payload);
  if (btoa(binary) !== payload) throw Error("矿坑编码错误");
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  let removed: Uint16Array;
  if (kind === "r" && bytes.length > 0 && bytes.length <= 512 && bytes.length % 4 === 0) {
    const view = new DataView(bytes.buffer);
    removed = Uint16Array.from({ length: bytes.length / 2 }, (_, i) => view.getUint16(i * 2, true));
  } else if (kind === "b" && bytes.length === 512) {
    const runs: number[] = [];
    let start = -1;
    for (let cell = 0; cell <= 4096; cell++) {
      const present = cell < 4096 && (bytes[cell >> 3] & (1 << (cell & 7))) !== 0;
      if (present && start < 0) start = cell;
      if (!present && start >= 0) { runs.push(start, cell - 1); start = -1; }
    }
    removed = new Uint16Array(runs);
  } else throw Error("矿坑编码错误");
  validateRuns(removed);
  return { region, removed };
}

const keyOf = (region: EncodedRegion) => region.slice(0, 3).join(",");

function parse(raw: string): Snapshot {
  const data = record(JSON.parse(raw));
  if (data.storageVersion !== 1) throw Error("不支持的本地存档格式");
  const head = readHead(data.head);
  record(data.progress);
  if (!Array.isArray(data.regions) || data.regions.length !== head.regionCount)
    throw Error("存档记录不完整");
  const keys = new Set<string>();
  for (const entry of data.regions) {
    coordinate(entry);
    const key = keyOf(entry);
    if (keys.has(key)) throw Error("矿坑区域重复");
    keys.add(key);
    decode(entry);
  }
  return { storageVersion: 1, head, progress: data.progress as Snapshot["progress"], regions: data.regions };
}

/** One atomic localStorage replacement commits progress and the complete sparse pit together.
 * Web Locks in SaveBootstrap enforce one writer; revision checks reject stale writers.
 * Storage failures propagate without clearing the last snapshot or using another storage API.
 */
export class LocalStorageSaveStore implements SaveStore {
  private closed = false;
  private raw: string | null | undefined;
  private snapshot: Snapshot | null = null;
  private readonly key: string;
  private readonly storage: StoragePort;
  constructor(key: string, storage: StoragePort) { this.key = key; this.storage = storage; }

  static async open(name: string, storage: StoragePort = localStorage) {
    return new LocalStorageSaveStore(name, storage);
  }

  private current() {
    if (this.closed) throw Error("存档会话已关闭");
    const raw = this.storage.getItem(this.key);
    if (raw !== this.raw) {
      const snapshot = raw === null ? null : parse(raw);
      this.raw = raw;
      this.snapshot = snapshot;
    }
    return this.snapshot;
  }

  async read(): Promise<SaveRead> {
    const saved = this.current();
    return saved ? {
      kind: "found", head: structuredClone(saved.head),
      progress: structuredClone(saved.progress), regions: saved.regions.map(decode),
    } : { kind: "missing" };
  }

  async commit(batch: SaveBatchV1): Promise<void> {
    const current = this.current();
    const head = readHead(batch.head);
    if ((current?.head.revision ?? null) !== batch.expectedRevision) throw new SaveConflict();
    if (head.revision !== (batch.expectedRevision ?? 0) + 1) throw Error("存档提交序号错误");
    const regions = new Map(current?.regions.map(region => [keyOf(region), region]));
    for (const region of batch.regions) {
      const entry = encode(region);
      regions.set(keyOf(entry), entry);
    }
    if (regions.size !== head.regionCount) throw Error("存档记录不完整");
    const snapshot: Snapshot = {
      storageVersion: 1, head, progress: structuredClone(batch.progress), regions: [...regions.values()],
    };
    const raw = JSON.stringify(snapshot);
    // setItem is atomic on failure: do not update the cache until it succeeds.
    this.storage.setItem(this.key, raw);
    this.raw = raw;
    this.snapshot = snapshot;
  }

  close() { this.closed = true; this.raw = undefined; this.snapshot = null; }
}
