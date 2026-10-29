import { PINEWIND_BRIDGE } from '../content/pinewind/hubLayout.ts';

export type GuidePoint = readonly [x: number, z: number];

/** The way the first-dig guide shows from the player's feet to the mine (world 1's surface): on foot, and over the
 *  creek by its bridge, ends first (a straight line from the spawn would run through the arched bridge). */
export function guideRoute(feet: readonly number[], target: readonly number[]): GuidePoint[] {
  const b = PINEWIND_BRIDGE, south = b.z + b.halfSpan + 1.5, north = b.z - b.halfSpan - 1.5;
  const from: GuidePoint = [feet[0], feet[2]], to: GuidePoint = [target[0], target[2]];
  const lo = Math.min(from[1], to[1]), hi = Math.max(from[1], to[1]);
  // Only a way from one bank to the other takes the bridge; on it, the rest of it.
  if (hi < north || lo > south) return [from, to];
  if (from[1] > south && to[1] < north) return [from, [b.x, south], [b.x, north], to];
  if (from[1] < north && to[1] > south) return [from, [b.x, north], [b.x, south], to];
  if (from[1] >= north && from[1] <= south) return [from, [b.x, to[1] < from[1] ? north : south], to];
  return [from, to];
}

/** A point `s` metres along a route, with the direction it runs there. */
export function along(route: readonly GuidePoint[], s: number): { x: number; z: number; dx: number; dz: number } {
  let left = Math.max(0, s);
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1], [bx, bz] = route[i], length = Math.hypot(bx - ax, bz - az);
    if (length < 1e-6) continue;
    if (left <= length || i === route.length - 1) {
      const t = Math.min(1, left / length);
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / length, dz: (bz - az) / length };
    }
    left -= length;
  }
  const [x, z] = route[route.length - 1];
  return { x, z, dx: 0, dz: -1 };
}

export const routeLength = (route: readonly GuidePoint[]) =>
  route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - route[i][0], p[1] - route[i][1]), 0);
