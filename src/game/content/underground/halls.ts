import type { Solid } from '../../world/sceneryKit.ts';
import type { HallDefinition } from './hall.ts';
import { OLD_MINE_HALL } from './oldMineHall.ts';
import { FUNGAL_HALL } from './fungalHall.ts';
import { CRYSTAL_HALL } from './crystalHall.ts';
import { RUINS_HALL } from './ruinsHall.ts';
import { FROZEN_HALL } from './frozenHall.ts';
import { VOLCANIC_HALL } from './volcanicHall.ts';
import oldMineSolids from './old-mine-hall.json' with { type: 'json' };
import fungalSolids from './fungal-hall.json' with { type: 'json' };
import crystalSolids from './crystal-hall.json' with { type: 'json' };
import ruinsSolids from './ruins-hall.json' with { type: 'json' };
import frozenSolids from './frozen-hall.json' with { type: 'json' };
import volcanicSolids from './volcanic-hall.json' with { type: 'json' };

/** Authored underground halls (the surface pipeline taken below ground): their definition and the colliders
 *  the offline build exported, in hall metres (origin at the room's floor centre). World 1's six rest layers. */
const HALLS: readonly (readonly [HallDefinition, { solids: unknown[] }])[] = [
  [OLD_MINE_HALL, oldMineSolids], [FUNGAL_HALL, fungalSolids], [CRYSTAL_HALL, crystalSolids],
  [RUINS_HALL, ruinsSolids], [FROZEN_HALL, frozenSolids], [VOLCANIC_HALL, volcanicSolids],
];
const UNDERGROUND_HALLS: Readonly<Record<string, { hall: HallDefinition; solids: Solid[] }>> =
  Object.fromEntries(HALLS.map(([hall, data]) => [hall.asset, { hall, solids: data.solids as Solid[] }]));
export function undergroundHall(id: string) {
  const entry = UNDERGROUND_HALLS[id];
  if (!entry) throw Error(`未知地下大厅: ${id}`);
  return entry;
}
/** The hall whose layer spans this depth (rooms by their layer id), if it has one. */
export const HALL_BY_LAYER: Readonly<Record<string, string>> = Object.fromEntries(HALLS.map(([hall]) => [hall.id, hall.asset]));
