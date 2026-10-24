// Offline: the 水晶洞穴 rest hall on the shared cave shell (caveKit.ts): a pale blue geode cavern, giant crystal
// spires in the corners, crystals bursting from the walls and hanging from the ceiling, crystal-sand patches with
// sparkles, a raised geode pool in the north-east and an open geode in the south-east; props from build_crystal.py.
import * as THREE from 'three';
import { caveKit, colour, gem, glow, matte, type GetProp } from './caveKit.ts';
import { CRYSTAL_HALL as HALL } from '../../../src/game/content/underground/crystalHall.ts';

const TINTS = { cyan: ['#5ad8f2', '#8ceaff'], pink: ['#f27ccf', '#ffb2e8'], violet: ['#a886f6', '#cbb4ff'] } as const;

export function buildHall(getProp: GetProp) {
  const big = HALL.spires.slice(0, 4).map(s => ({ x: s.at[0], z: s.at[2], radius: s.height * .3 }));
  const kit = caveKit(HALL, 120001, {
    rock: ['#5c6aa4', '#8c98d4'], upper: ['#6c78b8', '#4a5290'], ceiling: ['#3c4480', '#5a64a6'],
    stalactite: ['#6c78b6', '#aab6f2'], joint: '#2a3054', stones: ['#8a96c0', '#949fc6', '#808cb6', '#8e98bc'], curb: '#96a0c8',
  }, [...big, { x: HALL.geode.at[0], z: HALL.geode.at[2], radius: 3.2 }]);
  const { r, box, add, place, HALF, PIT } = kit;
  kit.useProps(getProp);
  const sand = matte('Cave crystal sand'), body = matte('Cave crystal');
  const G = { cyan: glow('Cave glow cyan', '#63e8ff', 1.25), pink: glow('Cave glow pink', '#ff7ad8', 1.15), violet: glow('Cave glow violet', '#b48cff', 1.1) };
  const glows = [G.cyan, G.pink, G.violet];
  const tintOf = (k: number) => (['cyan', 'pink', 'violet'] as const)[k % 3];

  /** A faceted crystal from `base` along `dir`: a hexagonal body, a glowing point. */
  const up = new THREE.Vector3(0, 1, 0);
  function crystal(base: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, tint: keyof typeof TINTS) {
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()), spin = r() * Math.PI;
    const shaft = new THREE.CylinderGeometry(radius * 1.04, radius, length * .72, 6, 1).toNonIndexed(); shaft.rotateY(spin); shaft.translate(0, length * .36, 0);
    const tip = new THREE.ConeGeometry(radius * 1.04, length * .28, 6, 1).toNonIndexed(); tip.rotateY(spin); tip.translate(0, length * .86, 0);
    for (const g of [shaft, tip]) { g.applyQuaternion(q); g.translate(base.x, base.y, base.z); g.computeVertexNormals(); }
    const [a, b] = TINTS[tint];
    colour(shaft, (_y, i) => new THREE.Color(i % 6 < 3 ? a : b));
    add(new THREE.Mesh(shaft, body), 'Cave crystal');
    add(new THREE.Mesh(colour(tip, () => new THREE.Color('#ffffff')), G[tint]), 'Cave crystal glow');
  }

  kit.walls();
  kit.ceiling(56, glows, .3);
  kit.floor();
  kit.patches(kit.wallSpots(22, HALL.spires.map(s => [s.at[0], s.at[2], 1.2 + s.height * .16] as const)), sand, '#6c7cc0', 'Cave crystal sand', [G.cyan, G.pink], .55, 4);
  kit.pitRim();

  // GEODE POOL: pale geode stones with crystal teeth round a still, glowing pool.
  const { at: poolAt, radius: poolR } = HALL.pool;
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2 + r() * .2;
    place('Geode_Stone', [poolAt[0] + Math.cos(a) * poolR, 0, poolAt[2] + Math.sin(a) * poolR], -a - Math.PI / 2, .95 + r() * .25);
  }
  const water = new THREE.CircleGeometry(poolR - .3, 28).rotateX(-Math.PI / 2).toNonIndexed(); water.translate(poolAt[0], .32, poolAt[2]); water.computeVertexNormals();
  add(new THREE.Mesh(colour(water, () => new THREE.Color('#bff6ff')), glow('Cave glow pool', '#58e2ff', .95)), 'Cave glow pool');
  box([poolAt[0], .26, poolAt[2]], [poolR * .8, .26, poolR * .8]);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + .4, d = .6 + (i % 2) * .5;
    crystal(new THREE.Vector3(poolAt[0] + Math.cos(a) * d, .2, poolAt[2] + Math.sin(a) * d), new THREE.Vector3(Math.cos(a) * .3, 1, Math.sin(a) * .3), .9 + i * .25, .14 + i * .02, tintOf(i));
  }

  // CRYSTALS IN THE ROCK: clumps bursting from the wall masses (found by casting rays out from the hall) and
  // hanging from the ceiling slabs (rays up).
  const rocks: THREE.Mesh[] = []; kit.group.updateMatrixWorld(true);
  kit.group.traverse(o => { if (o instanceof THREE.Mesh && (o.material === kit.M.rock || o.material === kit.M.ceiling)) rocks.push(o); });
  const ray = new THREE.Raycaster();
  const sprout = (hit: THREE.Intersection, out: THREE.Vector3, size: number, k: number) => {
    const n = (hit.face?.normal.clone() ?? out.clone().negate()).lerp(out.clone().negate(), .35).normalize();
    for (let j = 0; j < 3; j++) {
      const d = n.clone().add(new THREE.Vector3((r() - .5) * .9, (r() - .5) * .7, (r() - .5) * .9)).normalize();
      crystal(hit.point.clone().addScaledVector(n, -.25), d, size * (j === 0 ? 1 : .55 + r() * .3), size * .16 * (j === 0 ? 1 : .75), tintOf(k + j));
    }
  };
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, y = 2.5 + r() * 9, dir = new THREE.Vector3(Math.cos(a), (r() - .3) * .3, Math.sin(a)).normalize();
    ray.set(new THREE.Vector3(Math.cos(a) * 9, y, Math.sin(a) * 9), dir); ray.far = 20;
    const hit = ray.intersectObjects(rocks, false)[0]; if (!hit) continue;
    const p = hit.point;
    if (p.y < 4 && !kit.clearOf(p.x, p.z, 1.2)) continue;
    if (Math.abs(p.x - HALL.board[0]) < 5.5 && p.z < -14 && p.y > 3) continue; // keep the board readable
    sprout(hit, dir, 1.4 + r() * 1.6, i);
  }
  for (let i = 0; i < 14; i++) {
    const x = (r() - .5) * 34, z = (r() - .5) * 34;
    if (Math.abs(x) < PIT && Math.abs(z) < PIT && r() < .6) continue;
    ray.set(new THREE.Vector3(x, 8, z), up); ray.far = 20;
    const hit = ray.intersectObjects(rocks, false)[0]; if (!hit) continue;
    sprout(hit, up, 2 + r() * 1.8, i);
  }

  // SPIRES: the landmarks, with colliders round the core and the foot.
  for (const s of HALL.spires) {
    place(s.tint === 'cyan' ? 'Spire_Cyan' : s.tint === 'pink' ? 'Spire_Pink' : 'Spire_Violet', s.at, s.yaw, s.height);
    box([s.at[0], s.height * .45, s.at[2]], [s.height * .09, s.height * .45, s.height * .09]);
    box([s.at[0], s.height * .06, s.at[2]], [s.height * .17, s.height * .06, s.height * .17]);
  }
  // OPEN GEODE in the south-east, its back to the wall; crystal sand at its mouth.
  place('Geode_Open', HALL.geode.at, HALL.geode.yaw);
  box([HALL.geode.at[0], 1.7, HALL.geode.at[2] + 1.2], [2.6, 1.7, 1.2]);
  for (const side of [-1, 1]) box([HALL.geode.at[0] + side * 2.3, 1.2, HALL.geode.at[2] - .2], [.35, 1.2, .5]);
  kit.patches([[HALL.geode.at[0], HALL.geode.at[2] - 2.6, 2.2]], sand, '#7a88cc', 'Cave crystal sand', [G.pink, G.cyan], .6, 5);

  kit.services();
  kit.wallFoot(30, () => r() < .5
    ? { name: r() < .5 ? 'Cluster_Cyan' : 'Cluster_Pink', scale: () => .8 + r() * .9, solid: [.4, .55] }
    : { name: 'Cluster_Pink', scale: () => .5 + r() * .4 });
  // Loose glints on the floor ring near the walls.
  for (let i = 0; i < 40; i++) {
    const x = (r() - .5) * (HALF * 2 - 6), z = (r() - .5) * (HALF * 2 - 6);
    if (kit.inPit(x, z, 1.5)) continue;
    add(new THREE.Mesh(gem(.06 + r() * .05, x, .1, z), glows[i % 3]), 'Cave floor glint');
  }
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
