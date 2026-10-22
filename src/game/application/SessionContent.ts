import type { PetContent } from "../logic/pets/types.ts";
import type { ZoneConfig } from "../logic/ZoneDetector.ts";
import type { Coord } from "../terrain/SparseWorld.ts";
export type EggStation = Readonly<{
  id: string;
  eggId: string;
  zone: ZoneConfig;
  promptAnchor: readonly [number, number, number];
}>;
export type Destination = Readonly<{
  worldId?: import('../content/worldJourney.ts').WorldId;
  id: string;
  name: string;
  depth: number;
  spawn: Coord;
  roomBounds?: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number; floor: number; ceiling: number }>;
}>;
export type SessionContent = Readonly<{
  journey?: boolean;
  homes?: readonly Readonly<{worldId: import('../content/worldJourney.ts').WorldId; zone: ZoneConfig}>[];
  onboarding?: Readonly<{ entrance: Coord; eggId: string; mineArea?: Readonly<{ minX:number; maxX:number; minZ:number; maxZ:number }> }>;
  initialCoins?: number;
  petContent?: PetContent;
  eggStations?: readonly EggStation[];
  initiallyUnlocked?: readonly string[];
  destinations: readonly Destination[];
  sales: readonly ZoneConfig[];
  shops: readonly Readonly<{ id: string; zone: ZoneConfig }>[];
  portals: readonly Readonly<{ id: string; zone: ZoneConfig }>[];
  home: ZoneConfig;
}>;
