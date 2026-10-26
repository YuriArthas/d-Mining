// Offline: 第三世界's authored surface part, the hatchery east of the spawn (the rest of the world's surface is the
// game's planned plaza for now): a round navy pad with a gold rim and a violet ring at its centre, and world 3's
// twelve egg stands round its arc (build_egg_stands.py). Placed from src/game/content/world3/starBase.ts, local
// metres round the mine shaft (world z 448). Baked with the daytime sun, so the stands' shadows fall on the pad.
import * as THREE from 'three';
import { colour, matte, type GetProp, type HallSolid } from './caveKit.ts';
import { tessellate } from './techBaseHall.ts';
import { buildHatchery } from './hatchery.ts';
import { STAR_BASE as BASE } from '../../../src/game/content/world3/starBase.ts';

export const ASSET = BASE.asset;
export const SUN = true;
export const PROPS = ['egg-stands'];

export function buildHall(getProp: GetProp) {
  const group = new THREE.Group(); group.name = 'star base';
  const solids: HallSolid[] = [], paintMaterial = matte('Base paint');
  const add = (mesh: THREE.Object3D, name: string) => { mesh.name = name; group.add(mesh); return mesh; };
  buildHatchery(BASE.hatchery, BASE.stands, { pad: '#323a5e', rim: '#f2be36', mark: '#8462dc' }, {
    place: (name, at, yaw) => { const p = getProp(name); p.position.set(at[0], at[1], at[2]); p.rotation.y = yaw; group.add(p);
      p.traverse(o => { if (o instanceof THREE.Mesh) o.geometry = tessellate(o.geometry, 1.8); }); return p; },
    paint: (g, hex, name, max) => add(new THREE.Mesh(tessellate(colour(g, () => new THREE.Color(hex)), max), paintMaterial), name),
    box: (at, half, yaw = 0) => solids.push({ at: [...at], half: [...half], yaw }),
  });
  return { group, solids, lights: [] };
}
