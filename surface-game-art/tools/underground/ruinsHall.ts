// Offline: the 地下遗迹 rest hall on the shared cave shell (caveKit.ts): pale sandstone rock, colonnades with jade
// glyph bands, the temple gate round the name board with guardian heads and braziers, broad vine curtains on the
// walls, moss with jade specks; props from build_ruins.py.
import * as THREE from 'three';
import { caveKit, glow, matte, type GetProp } from './caveKit.ts';
import { RUINS_HALL as HALL } from '../../../src/game/content/underground/ruinsHall.ts';

export function buildHall(getProp: GetProp) {
  const kit = caveKit(HALL, 160001, {
    rock: ['#a68e6c', '#d0b88e'], upper: ['#bca47e', '#8a7452'], ceiling: ['#705c40', '#977e5a'],
    stalactite: ['#9c8464', '#ccb288'], joint: '#54452f', stones: ['#d8c49a', '#e0cca4', '#ccb68c', '#d4c09c'], curb: '#c2aa80',
  }, [
    ...HALL.columns.map(c => ({ x: c.at[0], z: c.at[2], radius: 1.6 })),
    ...HALL.guardians.map(([x, z]) => ({ x, z, radius: 2 })),
    { x: -6.1, z: HALL.board[2], radius: 1.6 }, { x: 6.1, z: HALL.board[2], radius: 1.6 },
  ]);
  const { r, box, place, group } = kit;
  kit.useProps(getProp);
  const jade = glow('Cave glow jade', '#6ff0c0', 1.1), flame = glow('Cave glow flame', '#ffb45c', 1.1), moss = matte('Cave moss');

  kit.walls();
  kit.ceiling(56, [jade, flame], .15);
  kit.floor();
  kit.patches(kit.wallSpots(18, HALL.columns.map(c => [c.at[0], c.at[2], 1.7] as const)), moss, '#5f8e40', 'Cave moss', [jade], .6, 2);
  kit.pitRim();

  // VINE CURTAINS hung where a level ray from inside the hall meets the rock, facing back in.
  const rocks: THREE.Mesh[] = []; group.updateMatrixWorld(true);
  group.traverse(o => { if (o instanceof THREE.Mesh && o.material === kit.M.rock) rocks.push(o); });
  const ray = new THREE.Raycaster();
  for (const [x, z, dx, dz] of [[-13.5, -10, 0, -1], [13.8, -10, 0, -1], [-10, -7.5, -1, 0], [-10, 9.5, -1, 0], [10, .8, 1, 0], [10, -15, 1, 0], [-6.5, 10, 0, 1], [6.8, 10, 0, 1]]) {
    const y = 11 + r() * 1.5;
    ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(dx, 0, dz)); ray.far = 20;
    const hit = ray.intersectObjects(rocks, false)[0]; if (!hit) continue;
    place('Vine_Curtain', [hit.point.x - dx * .25, y, hit.point.z - dz * .25], Math.atan2(-dx, -dz), .95 + r() * .3);
  }

  // LANDMARKS with their colliders.
  place('Temple_Gate', [HALL.board[0], 0, HALL.board[2]], 0);
  for (const side of [-1, 1]) box([HALL.board[0] + side * 6.1, 4.5, HALL.board[2] - .3], [1.25, 4.5, 1.2]);
  for (const c of HALL.columns) {
    place(c.broken ? 'Column_Broken' : 'Column_Whole', c.at, c.yaw);
    box([c.at[0], .4, c.at[2]], [1.3, .4, 1.3]);
    box([c.at[0], c.broken ? 2.4 : 4.5, c.at[2]], [.85, c.broken ? 2.4 : 4.5, .85]);
  }
  for (const [x, z, yaw] of HALL.drums) { place('Column_Drum', [x, 0, z], yaw); box([x, .8, z], [.9, .8, .9], yaw); }
  for (const [x, z, yaw] of HALL.guardians) { place('Guardian_Head', [x, 0, z], yaw); box([x, 2.4, z], [1.55, 2.4, 1.4], yaw); }
  for (const [x, z] of HALL.braziers) { place('Brazier', [x, 0, z], r() * 6); box([x, .75, z], [.5, .75, .5]); }

  kit.services([[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-9.6, 1.6, 0], [9.6, 1.6, Math.PI]]);
  kit.wallFoot(30, () => r() < .55
    ? { name: 'Rubble', scale: () => .9 + r() * .6 }
    : { name: 'Glyph_Block', scale: () => .9 + r() * .4, solid: [.6, .5] });
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
