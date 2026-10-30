// Offline: a later world's hatchery, shared by its base's builder (techBaseHall.ts, starBaseHall.ts): a round pad
// with a coloured rim and a ring at the centre where the player stands to look the eggs over, and the world's egg
// stands (Egg_<stand id> props from build_egg_stands.py, kept as their own nodes, colliders included) round its arc. Stand positions and the arc come from src/game/content/eggStands.ts.
import * as THREE from 'three';
import type { EggStand, Hatchery } from '../../../src/game/content/eggStands.ts';

type Kit = {
  place(name: string, at: readonly number[], yaw: number): unknown;
  /** Paints a flat geometry with one colour, split for the per-vertex bake (no edge longer than `max` metres). */
  paint(g: THREE.BufferGeometry, hex: string, name: string, max: number): unknown;
};
export type HatcheryLook = Readonly<{ pad: string; rim: string; mark: string }>;

const flatRing = (inner: number, outer: number, y: number, [cx, cz]: readonly [number, number]) => {
  const g = (inner > 0 ? new THREE.RingGeometry(inner, outer, 64) : new THREE.CircleGeometry(outer, 64)).rotateX(-Math.PI / 2).toNonIndexed();
  g.deleteAttribute('uv'); g.translate(cx, y, cz); g.computeVertexNormals();
  return g;
};
export function buildHatchery(hatchery: Hatchery, stands: readonly EggStand[], look: HatcheryLook, kit: Kit) {
  // Fine enough that the stands' baked shadows fall on the pad as soft shapes, not smeared over whole triangles.
  kit.paint(flatRing(0, hatchery.pad - .45, .035, hatchery.centre), look.pad, 'Hatchery pad', .6);
  kit.paint(flatRing(hatchery.pad - .45, hatchery.pad, .04, hatchery.centre), look.rim, 'Hatchery rim', .6);
  kit.paint(flatRing(1.7, 2.1, .045, hatchery.centre), look.mark, 'Hatchery mark', .6);
  for (const stand of stands) kit.place('Egg_' + stand.id, [stand.x, 0, stand.z], stand.yaw);
}
