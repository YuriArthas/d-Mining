import type { FootSurface } from '../audio/sfx.ts';
import { PINEWIND_GROUNDS, PINEWIND_PORTAL_SLOTS, PINEWIND_STAIR_STEPS, PINEWIND_TERRACE } from '../content/pinewind/hubLayout.ts';
import { resourceByKind } from '../content/resources.ts';
import { CELL, type Coord } from '../terrain/SparseWorld.ts';
import { PROTECTED_FLOOR } from '../world/entrance.ts';

/** What a footstep sounds like on each terrain pattern. */
const PATTERN: Readonly<Record<string, FootSurface>> = {
  soil: 'dirt', rock: 'stone', strata: 'stone', chunk: 'stone', vein: 'stone', fossil: 'stone', amber: 'stone',
  core: 'stone', ice: 'ice', metal: 'metal', crystal: 'crystal', gem: 'crystal', star: 'crystal',
};
/** Rest-station floors and decks in each layer theme. */
const FLOOR: Readonly<Record<string, FootSurface>> = {
  meadow_mine: 'grass', timber_mine: 'wood', mushroom_cave: 'dirt', crystal_cave: 'crystal', buried_ruins: 'stone',
  frozen_cave: 'ice', lava_cave: 'stone', fossil_cave: 'sand', ancient_machine: 'metal', core_sanctum: 'stone',
};

export function kindSurface(kind: number): FootSurface {
  try { return PATTERN[resourceByKind(kind).pattern] ?? 'stone'; } catch { return 'stone'; }
}

const BRIDGE = { x: 0, z: 36.5, halfX: 2.4, halfZ: 4.5 } as const;
const PAD_RADIUS = 2.1;
function onPath(x: number, z: number) {
  for (const path of PINEWIND_GROUNDS.paths) {
    for (let i = 1; i < path.points.length; i++) {
      const [ax, az] = path.points[i - 1], [bx, bz] = path.points[i], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) <= path.width / 2) return true;
    }
  }
  return false;
}

/** The hub's ground plan (world 1 surface): paving pads, the bridge, terraces and stairs, the sandy
 *  plazas, packed paths, and grass everywhere else. `raised` means standing on scenery above the
 *  ground voxels. */
export function hubSurface(x: number, z: number, raised: boolean): FootSurface {
  if (Math.abs(x - BRIDGE.x) < BRIDGE.halfX && Math.abs(z - BRIDGE.z) < BRIDGE.halfZ) return 'wood';
  if (PINEWIND_GROUNDS.pads.some(([px, pz]) => Math.hypot(x - px, z - pz) < PAD_RADIUS)) return 'stone';
  if (Object.values(PINEWIND_PORTAL_SLOTS).some(p => Math.hypot(x - p.x, z - p.z) < 1.4)) return 'stone';
  if (raised) {
    const onStairs = PINEWIND_STAIR_STEPS.some(s => Math.abs(x - s.x) <= s.width / 2 && Math.abs(z - s.z) <= s.depth / 2);
    const onTerrace = z >= PINEWIND_TERRACE.minZ && z <= PINEWIND_TERRACE.maxZ && x > 20;
    return onStairs || onTerrace ? 'stone' : 'wood';
  }
  if (PINEWIND_GROUNDS.plazas.some(p => Math.hypot(x - p.x, z - p.z) < p.radius)) return 'sand';
  if (onPath(x, z)) return 'dirt';
  return 'grass';
}

type Ports = Readonly<{
  cell(cell: Coord): number | null;
  /** Theme id of the layer at the feet. */
  theme(feet: readonly number[]): string;
  /** Whether these feet are on world 1's surface hub. */
  hub(feet: readonly number[]): boolean;
}>;

/** The surface under the drawn feet: the voxel below, the hub's ground plan on the surface floor,
 *  or the place's deck when standing on scenery (bridges, terraces, station platforms). */
export function footSurface(feet: readonly number[], ports: Ports): FootSurface {
  const [x, y, z] = feet, cy = Math.floor((y - 0.15) / CELL);
  const kind = ports.cell([Math.floor(x / CELL), cy, Math.floor(z / CELL)]) ?? 0;
  const raised = !kind || y - (cy + 1) * CELL > 0.3;
  if (ports.hub(feet) && (raised || kind === PROTECTED_FLOOR)) return hubSurface(x, z, raised);
  if (raised || kind === PROTECTED_FLOOR) return FLOOR[ports.theme(feet)] ?? 'stone';
  return kindSurface(kind);
}
