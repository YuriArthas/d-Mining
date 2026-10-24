import type { RestRoom } from './rooms.ts';
import type { SceneryPlan } from './sceneryKit.ts';
import { authoredRoomPlan } from './authoredRoomPlan.ts';
export type { V3, Shape, Solid, Sign, SceneryPlan } from './sceneryKit.ts';
/** A rest room's props, colliders and signs: its authored hall, or its scene kit scaled to the room. */
export function roomPlan(room:RestRoom):SceneryPlan {
 if(!room.scene)throw Error(`休整层缺少场景: ${room.id}`);
 return authoredRoomPlan(room);
}
