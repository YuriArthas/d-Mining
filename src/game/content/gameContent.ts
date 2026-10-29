import type { SessionContent, ServiceZone } from '../application/SessionContent.ts';
import type { ScenerySite } from '../presentation/SceneryCollision.ts';
import type { SceneryPlan } from '../world/sceneryKit.ts';
import type { AuthoredSurface } from './authoredSurface.ts';
import { roomPlan } from '../world/scenery.ts';
import { ENTRANCE_WORLD } from '../world/entrance.ts';
import { ENVIRONMENT_CONFIG } from '../world/environment.ts';
import { JOURNEY_WORLDS } from './journeyWorlds.ts';
import { WORLD_REQUIREMENTS, worldPortal, worldSpawn, worldStation } from './worldJourney.ts';
import { PET_CONTENT } from './petContent.ts';
import { PINEWIND_EGG_DISPLAYS, PINEWIND_SERVICES } from './pinewind/hubLayout.ts';
import { CREEK_CELLS, pinewindSurface } from './pinewindSurface.ts';
import { TECH_BASE } from './world2/techBase.ts';
import { STAR_BASE } from './world3/starBase.ts';
import type { EggStand } from './eggStands.ts';

/** World 1's surface: authored art and its collision, signs and service rings around the open mine shaft. */
export type SurfaceContent = Readonly<{
  authored: AuthoredSurface;
  plan: SceneryPlan;
  shaft: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
}>;
/** An egg stand on the surface; eggs face the walkway along `yaw`. */
export type HubEgg = Readonly<{ id: string; eggId: string; tier: number; x: number; y: number; z: number; yaw: number; color: string }>;

const zone = (x: number, z: number, radius = 3): ServiceZone => ({ x, y: 0, z, radius, heightTolerance: .3, hysteresis: .3 });
// The later worlds' services stand where their bases put them: before the ore buyer's and the shop's counters.
const serviceZone = (worldZ: number, kind: 'sell' | 'shop') => {
  const base = worldZ === TECH_BASE.worldZ ? TECH_BASE : STAR_BASE;
  return zone(base.kiosks[kind].ring[0], worldZ + base.kiosks[kind].ring[2]);
};
// Each world's eggs stand in it: world 1's on Pinewind's terrace, the later worlds' in their bases' hatcheries.
const inBase = (stands: readonly EggStand[], worldZ: number): HubEgg[] => stands.map(s => ({ ...s, tier: 0, y: 0, z: s.z + worldZ }));
const eggs: readonly HubEgg[] = [...PINEWIND_EGG_DISPLAYS, ...inBase(TECH_BASE.stands, TECH_BASE.worldZ), ...inBase(STAR_BASE.stands, STAR_BASE.worldZ)];
for (const egg of PET_CONTENT.eggs) if (eggs.filter(display => display.eggId === egg.id).length !== 1) throw Error(`蛋没有唯一的蛋台: ${egg.id}`);
const petContent = PET_CONTENT;
const [first, ...later] = JOURNEY_WORLDS;
// Pinewind with world 1's halls loads at start; the later worlds' bases and halls the first time the player goes there.
const pinewind = pinewindSurface(JOURNEY_WORLDS.flatMap(w => w.rooms), PINEWIND_EGG_DISPLAYS);
const base = (asset: string, worldZ: number, world: 2 | 3) => ({ asset, at: [0, 0, worldZ] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number], world });
const surface: SurfaceContent = { ...pinewind, authored: { ...pinewind.authored, instances: [...pinewind.authored.instances,
  base(TECH_BASE.asset, TECH_BASE.worldZ, 2), base(STAR_BASE.asset, STAR_BASE.worldZ, 3)] } };

const session: SessionContent = {
  initialCoins: 0,
  onboarding: { entrance: [(ENTRANCE_WORLD.minX + ENTRANCE_WORLD.maxX) / 2, .4, ENTRANCE_WORLD.maxZ + 2], eggId: 'meadow-egg', mineArea: ENTRANCE_WORLD },
  petContent,
  eggStations: eggs.map(p => ({
    id: p.id, eggId: p.eggId, promptAnchor: [p.x, p.y + 4.85, p.z] as const,
    // Stand in front of the egg (eggs face the plaza along their yaw).
    zone: { x: p.x + Math.sin(p.yaw) * 2, y: p.y, z: p.z + Math.cos(p.yaw) * 2, radius: 1.3, heightTolerance: .35, hysteresis: .3 },
  })),
  destinations: JOURNEY_WORLDS.flatMap(w => w.rooms.map(r => ({
    ...r, worldId: w.id,
    roomBounds: {
      minX: r.x - r.layout.widthCells, maxX: r.x + r.layout.widthCells, minZ: r.z - r.layout.depthCells, maxZ: r.z + r.layout.depthCells,
      floor: -r.depth, ceiling: -r.depth + r.layout.heightCells * 2,
    },
  }))),
  // Each world's surface services first, then its rooms'. Worlds 2 and 3 keep simple counters by their spawns.
  sales: [
    PINEWIND_SERVICES.sale.trigger, ...first.rooms.map(r => r.sell),
    ...later.flatMap(w => [serviceZone(w.z, 'sell'), ...w.rooms.map(r => r.sell)]),
  ],
  shops: [
    { id: 'surface-upgrade', zone: PINEWIND_SERVICES.shop.trigger, category: 'tools' },
    { id: PINEWIND_SERVICES.bags.id, zone: PINEWIND_SERVICES.bags.trigger, category: 'backpacks' },
    ...first.rooms.filter(r => r.shop).map(r => ({ id: r.id, zone: r.shop! })),
    ...later.flatMap(w => [{ id: `world${w.id}.shop`, zone: serviceZone(w.z, 'shop') }, ...w.rooms.filter(r => r.shop).map(r => ({ id: r.id, zone: r.shop! }))]),
  ],
  homes: WORLD_REQUIREMENTS.map(w => ({ worldId: w.id, zone: zone(0, worldSpawn(w.id)[2], 6) })),
  stations: WORLD_REQUIREMENTS.map(w => ({ worldId: w.id, zone: worldStation(w.id).zone })),
  portals: WORLD_REQUIREMENTS.map(w => ({ worldId: w.id, zone: worldPortal(w.id).zone })),
  sunkenSurface: CREEK_CELLS,
};

/** The whole game: three worlds of surface plus six rest layers each; world 1's surface is the Pinewind valley. */
export const GAME_CONTENT = {
  layers: first.layers,
  /** World 1's rest rooms; the later worlds' rooms are `extraSites`. */
  rooms: first.rooms,
  worlds: JOURNEY_WORLDS,
  extraSites: later.flatMap(w => w.localRooms.map(r => ({ id: r.id, depth: r.depth, z: w.z, plan: roomPlan(r) }))) as readonly ScenerySite[],
  session,
  surface,
  eggs,
  returnPoint: worldSpawn(1),
  environment: ENVIRONMENT_CONFIG as import('../presentation/EnvironmentController.ts').EnvironmentConfig,
} as const;
export type GameContent = typeof GAME_CONTENT;

/** Terrain generation: world 1's creek bed is cut out of the voxel floor meshes. Version 12: the economy v2 layer depths
 *  (economy.json); older saves are not read (see saveNamespace). */
export const GAME_GENERATION = Object.freeze({ version: 12, seed: 0, layers: first.layers, worlds: JOURNEY_WORLDS, surfaceCut: CREEK_CELLS });
