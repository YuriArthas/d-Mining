/** An authored underground rest hall, in hall metres: origin at the room's floor centre, +X east, +Z toward the
 *  spawn side. The voxel room it fills is 40 x 40 m and 20 m high; the 16 m mine pit in the middle stays open
 *  voxel floor to dig down from. One source for the offline art build (tools/build-underground.mjs) and the
 *  game (placement, lights, colliders, mood). */
type V3 = readonly [number, number, number];
export type HallLight = Readonly<{ at: V3; color: string; intensity: number; distance: number }>;
/** The mood: sky/ground fill, a soft top light, and the fog the far walls sink into. */
export type HallLook = Readonly<{ sky: string; ground: string; ambient: number; key: string; keyIntensity: number; fog: string }>;
/** A service stall against the south wall, its counter facing the hall (-Z); the ring sits in front. */
type HallStall = Readonly<{ at: V3; ring: V3 }>;
export type HallDefinition = Readonly<{
  id: string;
  asset: string;
  size: V3;
  /** Half width of the open mine pit (matches the shaft, ENTRANCE_WORLD). */
  pit: number;
  spawn: V3;
  stalls: Readonly<{ sell: HallStall; shop?: HallStall }>;
  /** The layer's name board hangs on the north wall, facing the spawn across the pit. */
  board: V3;
  /** Real-time lights (a fixed pool of six in the game). */
  lights: readonly HallLight[];
  look: HallLook;
}>;
