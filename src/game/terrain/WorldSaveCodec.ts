import { record } from "../logic/data.ts";
import type { Coord } from "./SparseWorld.ts";
export type RegionDataV1 = {
  region: [number, number, number];
  removed: Uint16Array | null;
};
export function readRegion(
  value: unknown,
  canDelete: (cell: Coord) => boolean,
): RegionDataV1 {
  const data = record(value),
    region = data.region,
    removed = data.removed;
  if (
    !Array.isArray(region) ||
    region.length !== 3 ||
    !region.every(Number.isSafeInteger) ||
    region[0] < -3 ||
    region[0] > 3 ||
    region[2] < -3 ||
    region[2] > 3 ||
    region[1] < -125 ||
    region[1] > -1
  )
    throw Error("矿坑区域坐标错误");
  if (
    removed !== null &&
    (!(removed instanceof Uint16Array) ||
      !removed.length ||
      removed.length % 2 ||
      removed.length > 4096)
  )
    throw Error("矿坑删除区间错误");
  const runs = removed === null ? [0, 4095] : removed;
  let last = -2;
  for (let i = 0; i < runs.length; i += 2) {
    const start = runs[i],
      end = runs[i + 1];
    if (start <= last + 1 || end < start || end > 4095)
      throw Error("矿坑删除区间未规范化");
    for (let index = start; index <= end; index++) {
      const cell: Coord = [
        region[0] * 16 + (index % 16),
        region[1] * 16 + (Math.floor(index / 16) % 16),
        region[2] * 16 + Math.floor(index / 256),
      ];
      if (!canDelete(cell)) throw Error("存档包含不可挖格子的删除记录");
    }
    last = end;
  }
  return {
    region: [...region] as [number, number, number],
    removed: removed === null ? null : removed.slice(),
  };
}
