import fungalSolids from './fungal-hall.json' with { type: 'json' };
import { FUNGAL_HALL } from './fungalHall.ts';
import type { Solid } from '../../world/sceneryKit.ts';

/** Authored underground halls (the surface pipeline taken below ground): their definition and the colliders
 *  the offline build exported, in hall metres (origin at the room's floor centre). */
export const UNDERGROUND_HALLS = {
  'fungal-hall': { hall: FUNGAL_HALL, solids: fungalSolids.solids as Solid[] },
} as const;
export type HallId = keyof typeof UNDERGROUND_HALLS;
export function undergroundHall(id: string) {
  const entry = (UNDERGROUND_HALLS as Record<string, (typeof UNDERGROUND_HALLS)[HallId]>)[id];
  if (!entry) throw Error(`未知地下大厅: ${id}`);
  return entry;
}
/** The hall whose layer spans this depth (rooms by their layer id), if it has one. */
export const HALL_BY_LAYER: Readonly<Record<string, HallId>> = { fungal: 'fungal-hall' };
