import type { PetContent } from "../logic/pets/types.ts";
import type { ZoneConfig } from "../logic/ZoneDetector.ts";
import type { Coord } from "../terrain/SparseWorld.ts";
/** A service zone; `lookAt` is the point a player faces when teleported there. */
export type ServiceZone = ZoneConfig & Readonly<{ lookAt?: readonly [number, number, number] }>;
export type EggStation = Readonly<{
  id: string;
  eggId: string;
  zone: ZoneConfig;
  promptAnchor: readonly [number, number, number];
}>;
export type Destination = Readonly<{
  worldId: import('../content/worldJourney.ts').WorldId;
  id: string;
  name: string;
  depth: number;
  /** The layer's look (themes.ts), which also colours its card. */
  theme?: string;
  /** The hall's upgrade counter (every other layer), if it has one. */
  shop?: object | null;
  spawn: Coord;
  roomBounds?: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number; floor: number; ceiling: number }>;
}>;
export type SessionContent = Readonly<{
  homes: readonly Readonly<{worldId: import('../content/worldJourney.ts').WorldId; zone: ZoneConfig}>[];
  /** Each world's teleport station pad: standing on it opens that world's layers. */
  stations: readonly Readonly<{worldId: import('../content/worldJourney.ts').WorldId; zone: ServiceZone}>[];
  /** Each world's portal to the others (unlock and travel). */
  portals: readonly Readonly<{worldId: import('../content/worldJourney.ts').WorldId; zone: ServiceZone}>[];
  onboarding: Readonly<{ entrance: Coord; eggId: string; mineArea: Readonly<{ minX:number; maxX:number; minZ:number; maxZ:number }> }>;
  /** Surface cells (flattened x,z pairs, 2 m cells) where the authored ground sinks below the floor, down to
   *  1.2 m (world 1's creek): standing there still counts as being on the surface, not in the mine. */
  sunkenSurface: readonly number[];
  initialCoins: number;
  petContent: PetContent;
  eggStations: readonly EggStation[];
  destinations: readonly Destination[];
  sales: readonly ServiceZone[];
  /** Shop counters: each world's surface (layer 0) and its halls of layers 2 and 4, each selling the items of its world
   *  and layer (economy.json `shop`); a hall's opens once the player has reached it. `category` picks the page a
   *  counter opens on (tools when absent). */
  shops: readonly Readonly<{ id: string; zone: ServiceZone; world: 1 | 2 | 3; layer: 0 | 2 | 4; category?: import('../content/shopCatalog.ts').ShopCategory }>[];
}>;
