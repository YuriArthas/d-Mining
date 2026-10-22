import { CELL } from '../terrain/grid.ts';
import { MOVEMENT } from '../movement.ts';

// Depth is measured from the player's feet, in world metres. Keep the entrance
// fully lit; both ends of the fade have zero slope, including the lights-off edge.
export const SURFACE_LIGHT_FADE = { start: 2 * CELL, end: 15 * CELL } as const;
export function surfaceLightStrength(depth: number): number {
  const t = Math.max(0, Math.min(1,
    (depth - SURFACE_LIGHT_FADE.start) / (SURFACE_LIGHT_FADE.end - SURFACE_LIGHT_FADE.start),
  ));
  return 1 - t * t * (3 - 2 * t);
}

// Rapier keeps the feet slightly above the floor. Account for that contact gap
// so standing on the 15th block actually removes the lights, rather than keeping
// 12 almost-zero lights in the render list. The epsilon covers float32 rounding.
export function surfaceLightStrengthAtFeet(feetY: number): number {
  return surfaceLightStrength(-feetY + MOVEMENT.skin + MOVEMENT.contactSlack + 1e-5);
}
