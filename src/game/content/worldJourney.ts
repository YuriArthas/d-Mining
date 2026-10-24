// Gameplay requirements; world entry and mine ownership are separate permanent facts.
export type WorldId = 1 | 2 | 3;
export type WorldRequirement = Readonly<{
  id: WorldId; name: string; z: number; mined: number; coins: number;
  materials: readonly Readonly<{ itemId: string; count: number; layer: number }>[];
}>;
export const WORLD_REQUIREMENTS: readonly WorldRequirement[] = Object.freeze([
  { id: 1, name: '第一世界', z: 0, mined: 0, coins: 0, materials: [] },
  { id: 2, name: '第二世界', z: 224, mined: 1_000_000, coins: 10_000_000, materials: [
    { itemId: 'journey.emerald', count: 50, layer: 2 }, { itemId: 'journey.amethyst', count: 50, layer: 3 },
    { itemId: 'journey.ruby', count: 40, layer: 4 }, { itemId: 'journey.diamond', count: 30, layer: 5 },
    { itemId: 'journey.obsidian', count: 30, layer: 6 },
  ] },
  { id: 3, name: '第三世界', z: 448, mined: 100_000_000, coins: 10_000_000_000, materials: [
    { itemId: 'journey.titanium', count: 60, layer: 2 }, { itemId: 'journey.platinum', count: 50, layer: 3 },
    { itemId: 'journey.tourmaline', count: 40, layer: 4 }, { itemId: 'journey.opal', count: 30, layer: 5 },
    { itemId: 'journey.energy', count: 30, layer: 6 },
  ] },
]);
export function worldRequirement(id: WorldId) {
  const world = WORLD_REQUIREMENTS.find(w => w.id === id);
  if (!world) throw Error('未知世界');
  return world;
}
export function worldAtZ(z: number): WorldId { return z > 336 ? 3 : z > 112 ? 2 : 1; }
export const worldSpawn = (id: WorldId) => [0, .1, worldRequirement(id).z + 46] as const;
// Players face their mine (-Z) at spawn. The next world's gate is behind them,
// on the plaza side (+Z), so its approach never crosses the current mine.
export const worldGateZ = (id: 2 | 3) => worldRequirement((id-1) as WorldId).z + 69;
export function worldAtFeet(feet: readonly number[]): WorldId {
  if(feet[1]<-.1)return worldAtZ(feet[2]);
  return feet[2]>worldGateZ(3)?3:feet[2]>worldGateZ(2)?2:1;
}
/** Each world's teleport station: on the surface west of the spawn, facing it. Walking onto its pad opens
 *  that world's layers; travelling to a world from anywhere arrives here. */
export const STATION_LOCAL = { x: -10, z: 55 } as const;
export function worldStation(id: WorldId) {
  const z0 = worldRequirement(id).z, x = STATION_LOCAL.x, z = z0 + STATION_LOCAL.z;
  const spawn = worldSpawn(id), yaw = Math.atan2(spawn[0] - x, spawn[2] - z);
  const pad = { x: x + Math.sin(yaw) * 2.8, z: z + Math.cos(yaw) * 2.8 };
  return { x, z, yaw, zone: { ...pad, y: 0, radius: 1.8, heightTolerance: .3, hysteresis: .3, lookAt: [x, 2.2, z] as const } };
}
