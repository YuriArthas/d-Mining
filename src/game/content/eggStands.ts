import { ECONOMY } from './economy.ts';
import { EGG_COLORS } from './petAppearance.ts';

/** An egg stand in its world's own metres (worlds 2 and 3: local to the base, world z added by the caller). */
export type EggStand = Readonly<{ id: string; eggId: string; x: number; z: number; yaw: number; color: string }>;
/** A later world's hatchery: its eggs on an arc of `span` radians round `centre` (radius `radius`), opening west
 *  toward the lanes and the spawn, each egg facing the centre where the player stands to look them over. */
export type Hatchery = Readonly<{ centre: readonly [number, number]; radius: number; span: number; pad: number }>;

const round = (value: number) => Math.round(value * 100) / 100;
/** A world's eggs in economy.json order (cheapest layer first); a table row without an id is not an egg yet. */
export const eggsOfWorld = (world: number) => ECONOMY.eggs.flatMap(egg => egg.world === world && egg.id ? [egg.id] : []);
export function eggColor(eggId: string) {
  const color = EGG_COLORS[eggId];
  if (!color) throw Error(`Missing egg colour: ${eggId}`);
  return color;
}
/** The stands of a hatchery: cheapest at the north end of the arc (toward the shaft), the dearest at the south. */
export function hatcheryStands(hatchery: Hatchery, eggIds: readonly string[]): EggStand[] {
  const [cx, cz] = hatchery.centre, step = eggIds.length > 1 ? hatchery.span / (eggIds.length - 1) : 0;
  return eggIds.map((eggId, i) => {
    const angle = -hatchery.span / 2 + step * i, x = round(cx + Math.cos(angle) * hatchery.radius), z = round(cz + Math.sin(angle) * hatchery.radius);
    return { id: `stand-${eggId}`, eggId, x, z, yaw: Math.atan2(cx - x, cz - z), color: eggColor(eggId) };
  });
}
