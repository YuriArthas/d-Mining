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
  id: string;
  name: string;
  depth: number;
  spawn: Coord;
}>;
export type SessionContent = Readonly<{
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
