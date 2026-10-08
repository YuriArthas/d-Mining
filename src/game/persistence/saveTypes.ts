import { record } from "../logic/data.ts";
import { integer } from "../logic/numbers.ts";
import type { ProgressDataV1 } from "../application/SessionProgress.ts";
export type { ProgressDataV1 } from "../application/SessionProgress.ts";
import type { RegionDataV1 } from "../terrain/WorldSaveCodec.ts";
export type WorldIdentity = {
  generationVersion: number;
  seed: number;
  regionEncoding: 1;
};
export type SaveHeadV1 = {
  formatVersion: 1;
  revision: number;
  savedAt: number;
  world: WorldIdentity;
  regionCount: number;
};
export type SaveBatchV1 = {
  expectedRevision: number | null;
  head: SaveHeadV1;
  progress: ProgressDataV1;
  regions: readonly RegionDataV1[];
};
export type SaveRead =
  | { kind: "missing" }
  | { kind: "found"; head: unknown; progress: unknown; regions: unknown[] };
export type SaveStatus = Readonly<{
  state: "idle" | "dirty" | "saving" | "failed" | "conflicted";
  revision: number;
  savedAt: number | null;
  error: string | null;
}>;
export class SaveConflict extends Error {
  constructor() {
    super("存档已被其他会话修改，请重新进入游戏");
  }
}
export function readHead(value: unknown): SaveHeadV1 {
  const data = record(value),
    world = record(data.world);
  if (data.formatVersion !== 1)
    throw Error("不支持的存档版本，请使用兼容的游戏版本");
  const revision = integer(data.revision as number, "存档序号");
  if (
    !revision ||
    !Number.isSafeInteger(data.savedAt) ||
    (data.savedAt as number) < 0
  )
    throw Error("存档头错误");
  if (
    world.regionEncoding !== 1 ||
    !Number.isSafeInteger(world.seed) ||
    !Number.isSafeInteger(world.generationVersion)
  )
    throw Error("世界标识错误");
  const regionCount = integer(data.regionCount as number, "区域数量");
  if (regionCount > 6125) throw Error("矿坑区域数量超出世界范围");
  return {
    formatVersion: 1,
    revision,
    savedAt: data.savedAt as number,
    regionCount,
    world: {
      generationVersion: world.generationVersion as number,
      seed: world.seed as number,
      regionEncoding: 1,
    },
  };
}
