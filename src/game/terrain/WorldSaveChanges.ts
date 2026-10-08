import type { Coord, Runs } from "./SparseWorld.ts";
import type { RegionDataV1 } from "./WorldSaveCodec.ts";
export type WorldCaptureToken = ReadonlyMap<string, number>;
export class WorldSaveChanges {
  private serial = 0;
  private dirty = new Map<string, { coord: Coord; serial: number }>();
  mark(coord: Coord) {
    this.dirty.set(coord.join(","), { coord, serial: ++this.serial });
  }
  get pending() {
    return this.dirty.size > 0;
  }
  capture(read: (coord: Coord) => Runs) {
    const token = new Map<string, number>(),
      regions: RegionDataV1[] = [];
    for (const [key, change] of this.dirty) {
      token.set(key, change.serial);
      const runs = read(change.coord);
      regions.push({
        region: [...change.coord],
        removed: runs === null ? null : runs.slice(),
      });
    }
    return { regions, token };
  }
  acknowledge(token: WorldCaptureToken) {
    for (const [key, serial] of token)
      if (this.dirty.get(key)?.serial === serial) this.dirty.delete(key);
  }
}
