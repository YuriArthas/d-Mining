import { SURFACE_HOME, SURFACE_SALE } from './surfaceLayout.ts';
import { LAYERS, layerAtDepth, type Layer } from '../content/layers.ts';
import { CELL } from '../terrain/grid.ts';
import type { ZoneConfig } from '../logic/ZoneDetector.ts';

const zone = (x: number, y: number, z: number): ZoneConfig => ({ x, y, z, radius: 1.7, heightTolerance: 0.25, hysteresis: 0.25 });
function room(id: string, name: string, depth: number, x: number, z: number, shop: boolean) {
  return Object.freeze({ id, name, depth, x, z, width: 20, height: 10,
    spawn: [x, -depth + 0.1, z + 11] as const,
    sell: zone(x - 12, -depth, z + 12), shop: shop ? zone(x + 12, -depth, z + 12) : null });
}
export function roomsFor(layers: readonly Layer[]) { return Object.freeze(layers.slice(1).map(l => Object.freeze({ ...room(l.id, l.name, l.from, 0, 0, l.shop), theme: l.theme }))); }
export const ROOMS = roomsFor(LAYERS);
export type RestRoom = typeof ROOMS[number];
export const HOME_ZONE: ZoneConfig = SURFACE_HOME;
// Query only procedural occupancy. No voxel allocation or excavation records.
// A floor bounds the air just above it. Look up the layer 10 cells below the sample;
// this avoids scanning all rooms on every procedural voxel query.
export function roomAir(x: number, y: number, z: number, layers: readonly Layer[] = LAYERS) {
  if(x < -10 || x >= 10 || z < -10 || z >= 10) return false;
  const l = layerAtDepth(-y * CELL + 20, layers), floor = -l.from / CELL;
  return l.from > 0 && y >= floor && y < floor + 10;
}
export function onRoomFloor(x: number, y: number, z: number, layers: readonly Layer[] = LAYERS) {
  if(x < -10 || x >= 10 || z < -10 || z >= 10) return false;
  const l = layerAtDepth(-(y+1)*CELL, layers);
  return l.from > 0 && y === -l.from / CELL - 1;
}

export const SURFACE_SELL = Object.freeze(SURFACE_SALE);
