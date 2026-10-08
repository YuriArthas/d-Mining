import type { WorldGeneration } from "../terrain/SparseWorld.ts";
import { readHead } from "./saveTypes.ts";
// v1 has no historical migrations. Never reinterpret old holes against new terrain.
export function compatibleHead(value: unknown, generation: WorldGeneration) {
  const head = readHead(value);
  if (
    head.world.generationVersion !== generation.version ||
    head.world.regionEncoding !== 1
  )
    throw Error("存档地图版本与当前游戏不兼容，原进度已保留");
  return head;
}
