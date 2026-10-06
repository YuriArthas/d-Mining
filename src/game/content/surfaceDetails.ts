import { planGrass } from '../world/GrassLayout.ts';
import { CURB, CURB_BLOCKS, CURB_SOLIDS } from '../world/SurfaceRoads.ts';
import { WALL_TORCHES, WALL_TORCH_LEVEL } from '../world/WallTorches.ts';
import { SURFACE_PONDS, POND, POND_DISTANCE_GLSL } from '../world/SurfacePonds.ts';
import { SURFACE_ROADS } from '../world/surfaceLayout.ts';
import { BOUNDARY_TIERS } from '../world/BoundaryProfile.ts';

// Derived, serializable scene data. Presentation never looks up the current map.
export function createSurfaceDetailContent() {
  return {
    grass: planGrass(),
    curbs: { style: CURB, blocks: CURB_BLOCKS, collisionEdges: CURB_SOLIDS.length },
    torches: { fixtures: WALL_TORCHES, level: WALL_TORCH_LEVEL },
    ponds: { placements: SURFACE_PONDS, shape: POND },
    ground: { roads: SURFACE_ROADS, pondDistanceGLSL: POND_DISTANCE_GLSL },
    boundary: BOUNDARY_TIERS,
  };
}
export type SurfaceDetailContent = ReturnType<typeof createSurfaceDetailContent>;
