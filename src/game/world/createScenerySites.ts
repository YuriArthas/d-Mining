import type { RestRoom } from "./rooms.ts";
import type { SceneryPlan } from "./sceneryKit.ts";
import { roomPlan } from "./scenery.ts";
import type { ScenerySite } from "../presentation/SceneryCollision.ts";

// Composition of this camp's content; render and physics consume the same derived plans.
export function createScenerySites(
  rooms: readonly RestRoom[],
  surface: SceneryPlan,
): readonly ScenerySite[] {
  return [
    { id: "surface", depth: 0, plan: surface },
    ...rooms.map((room) => ({
      id: room.id,
      depth: room.depth,
      plan: roomPlan(room),
    })),
  ];
}
