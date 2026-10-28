import { ECONOMY, type CurrencyId, type TicketEconomy } from './economy.ts';
// Each world's ticket, paid at a world portal: the previous world's currency, a pickaxe level (the new world's
// first gate) and minerals from earlier worlds (economy.json). `currency` is what the world's own ore sells for.
export type WorldId = 1 | 2 | 3;
/** `name` is the world's number (第一世界), `title` its place name shown on arrival (松风矿谷). */
type WorldRequirement = Readonly<{ id: WorldId; name: string; title: string; z: number; currency: CurrencyId; ticket: TicketEconomy | null;
  /** The ticket's minerals (none for world 1). */
  materials: TicketEconomy['materials'] }>;
const PLACES: Readonly<Record<WorldId, { name: string; title: string; z: number }>> = {
  1: { name: '第一世界', title: '松风矿谷', z: 0 }, 2: { name: '第二世界', title: '沙海基地', z: 224 }, 3: { name: '第三世界', title: '星陨秘境', z: 448 } };
export const WORLD_REQUIREMENTS: readonly WorldRequirement[] = Object.freeze(ECONOMY.worlds.map(w =>
  Object.freeze({ id: w.id, ...PLACES[w.id], currency: w.currency, ticket: w.ticket, materials: w.ticket?.materials ?? [] })));
export function worldRequirement(id: WorldId) {
  const world = WORLD_REQUIREMENTS.find(w => w.id === id);
  if (!world) throw Error('未知世界');
  return world;
}
export function worldAtZ(z: number): WorldId { return z > 336 ? 3 : z > 112 ? 2 : 1; }
export const worldSpawn = (id: WorldId) => [0, .1, worldRequirement(id).z + 46] as const;
// The worlds lie side by side along Z; on the surface each one ends this far past its spawn (world 1's ends at
// the old gate in the south ridge, now its world portal). Walls close every boundary: worlds are reached only
// by their portals.
export const worldGateZ = (id: 2 | 3) => worldRequirement((id-1) as WorldId).z + 69;
export function worldAtFeet(feet: readonly number[]): WorldId {
  if(feet[1]<-.1)return worldAtZ(feet[2]);
  return feet[2]>worldGateZ(3)?3:feet[2]>worldGateZ(2)?2:1;
}
/** Each world's teleport station: on the surface west of the spawn, facing it. Walking onto its pad opens
 *  that world's layers. */
export const STATION_LOCAL = { x: -10, z: 55 } as const;
export function worldStation(id: WorldId) {
  const z0 = worldRequirement(id).z, x = STATION_LOCAL.x, z = z0 + STATION_LOCAL.z;
  const spawn = worldSpawn(id), yaw = Math.atan2(spawn[0] - x, spawn[2] - z);
  const pad = { x: x + Math.sin(yaw) * 2.8, z: z + Math.cos(yaw) * 2.8 };
  return { x, z, yaw, zone: { ...pad, y: 0, radius: 1.8, heightTolerance: .3, hysteresis: .3, lookAt: [x, 2.2, z] as const } };
}
/** Each world's portal to the other worlds: world 1's stands in the gate of its south ridge; the later worlds' at
 *  the far end of the plaza behind their spawn, facing it and the mine beyond (world 2's up on a dais, `y` its
 *  floor). Stepping into the zone in front opens the world list (unlock and travel). */
const PORTAL_FLOOR: Partial<Record<WorldId, number>> = { 2: .9 };
export function worldPortal(id: WorldId) {
  const z0 = worldRequirement(id).z;
  if (id === 1) { const z = worldGateZ(2); return { x: 0, y: 0, z, yaw: Math.PI, zone: { x: 0, z: z - 3.2, y: 0, radius: 2.2, heightTolerance: .3, hysteresis: .3, lookAt: [0, 4, z] as const } }; }
  const x = 0, y = PORTAL_FLOOR[id] ?? 0, z = z0 + 62, spawn = worldSpawn(id), yaw = Math.atan2(spawn[0] - x, spawn[2] - z);
  return { x, y, z, yaw, zone: { x: x + Math.sin(yaw) * 2.8, z: z + Math.cos(yaw) * 2.8, y, radius: 1.8, heightTolerance: .3, hysteresis: .3, lookAt: [x, y + 2.6, z] as const } };
}
