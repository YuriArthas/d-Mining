// Offline: 第二世界's surface base, props from build_tech_base.py, placed from src/game/content/world2/techBase.ts.
// Local metres round the mine shaft (world z 224). Baked with the daytime sun.
import * as THREE from 'three';
import { colour, matte, type GetProp, type HallSolid } from './caveKit.ts';
import { TECH_BASE as BASE } from '../../../src/game/content/world2/techBase.ts';

export const ASSET = BASE.asset;
export const SUN = true;

export function buildHall(getProp: GetProp) {
  const group = new THREE.Group(); group.name = 'tech base';
  const solids: HallSolid[] = [];
  const ground = matte('Base ground');
  // Plateau ground over the world's surface strip (x +-103, z -155..69), the shaft left open; 2 m cells so the
  // sun bake has vertices to land shadows on.
  for (const [x0, x1, z0, z1] of [[-103, -8, -155, 69], [8, 103, -155, 69], [-8, 8, -155, -8], [-8, 8, 8, 69]]) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / 2), Math.ceil((z1 - z0) / 2)).rotateX(-Math.PI / 2).toNonIndexed();
    g.translate((x0 + x1) / 2, .015, (z0 + z1) / 2); g.computeVertexNormals();
    group.add(Object.assign(new THREE.Mesh(colour(g, () => new THREE.Color('#c4a888')), ground), { name: 'Base ground' }));
  }
  for (const k of [BASE.kiosks.sell, BASE.kiosks.shop]) {
    const p = getProp(k === BASE.kiosks.sell ? 'Kiosk_Sell' : 'Kiosk_Shop'); p.position.set(...k.at); group.add(p);
    solids.push({ at: [k.at[0], 1.6, k.at[2] - .6], half: [2.7, 1.6, 1.3], yaw: 0 });
  }
  return { group, solids, lights: [] };
}
