// Offline: the 冰封矿洞 rest hall on the shared cave shell (caveKit.ts): pale blue rock frosted white on its upper
// faces, icicles with glinting tips, snow drifts along the walls, glowing ice formations, a frozen waterfall
// pouring down the east wall into a frozen pond, a campfire by the sale stall and an igloo in the south-east.
// Props from build_frozen.py.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { caveKit, colour, glow, matte, rockMass, smooth, type GetProp } from './caveKit.ts';
import { FROZEN_HALL as HALL } from '../../../src/game/content/underground/frozenHall.ts';

const FROST = new THREE.Color('#eef6fc');

export function buildHall(getProp: GetProp) {
  const { waterfall, pond } = HALL;
  const kit = caveKit(HALL, 200001, {
    rock: ['#7493b2', '#a8c4de'], upper: ['#8aa8c8', '#6482a4'], ceiling: ['#4e6888', '#6e8cae'],
    stalactite: ['#a4c8e8', '#e4f6ff'], joint: '#dcecf6', stones: ['#94adc4', '#9fb7cc', '#8aa3bb', '#9ab0c2', '#8299b2'], curb: '#a2b8cc',
  }, [
    ...HALL.spires.slice(0, 4).map(s => ({ x: s.at[0], z: s.at[2], radius: s.height * .3 })),
    { x: 17.5, z: waterfall.z, radius: waterfall.width / 2 },
    { x: HALL.igloo[0], z: HALL.igloo[2], radius: 3.2 },
    { x: HALL.campfire[0], z: HALL.campfire[2], radius: 2.2 },
  ]);
  const { r, box, add, place, hull, HALF } = kit;
  kit.useProps(getProp);
  const snow = matte('Cave snow'), ice = glow('Cave glow ice', '#8fe8ff', 1.1), frost = glow('Cave glow frost', '#c8f4ff', .9);

  kit.walls();
  // Frost: every upward-facing facet of the wall and corner masses turns snow white.
  for (const mesh of kit.group.children) {
    if (!(mesh instanceof THREE.Mesh) || !/wall|corner/.test(mesh.name)) continue;
    const g = mesh.geometry as THREE.BufferGeometry, c = g.getAttribute('color'), n = g.getAttribute('normal'), v = new THREE.Vector3();
    for (let i = 0; i < c.count; i += 3) {
      v.fromBufferAttribute(n, i); const k = smooth(.35, .75, v.y);
      if (k <= 0) continue;
      const tint = new THREE.Color().fromBufferAttribute(c, i).lerp(FROST, k * .85);
      for (let j = 0; j < 3; j++) c.setXYZ(i + j, tint.r, tint.g, tint.b);
    }
  }
  kit.ceiling(80, [ice, frost], .28);
  // Big ice plates with frost-white cracks between them.
  kit.floor({ kind: 'shards', size: 3.4, gap: .12, height: [.04, .06] });
  kit.patches(kit.wallSpots(20, HALL.spires.map(s => [s.at[0], s.at[2], s.height * .32] as const)), snow, '#e2eef8', 'Cave snow', [ice], 1, 1.4);
  kit.pitRim();

  // SNOW DRIFTS: soft white mounds hugging the wall feet, clear of the stalls, board and landmarks.
  const driftTint = (f: number) => new THREE.Color('#d6e6f2').lerp(new THREE.Color('#f6fbff'), f);
  for (let i = 0; i < 18; i++) {
    const side = Math.floor(r() * 4), d = (r() - .5) * 32, inset = HALF - 3 - r() * 1.2;
    const [x, z] = kit.alongWall(side, d, inset), radius = 1.5 + r() * 1.2;
    if (!kit.clearOf(x, z, radius * .8)) continue;
    const m = rockMass(r, x, z, radius, -.3, .55 + r() * .6, [[0, 1], [.45, .82], [1, .3]], driftTint, 8);
    add(new THREE.Mesh(m.geometry, snow), 'Cave snow drift'); hull(m.points);
  }

  // FROZEN WATERFALL: broad stepped ice slabs down the east wall, each tier further out and wider toward the
  // floor, glowing from within; it spills into the pond.
  const iceTint = (f: number) => new THREE.Color('#78c8ea').lerp(new THREE.Color('#c4eefc'), f);
  const tiers = 6, fall = glow('Cave glow waterfall', '#5fd2f4', .5);
  for (let k = 0; k < tiers; k++) {
    const y1 = waterfall.top - k * (waterfall.top / tiers) + .4, y0 = Math.max(-.2, y1 - waterfall.top / tiers - 1.2);
    const front = HALF - 2.2 - k * .42, half = waterfall.width / 2 * (.7 + k * .07), back = HALF + 1;
    const pts: THREE.Vector3[] = [];
    for (const y of [y0, (y0 + y1) / 2, y1]) for (const [x, zz] of [[back, -half], [front + .4, -half * .96], [front, -half * .5], [front - .1, 0], [front, half * .5], [front + .4, half * .96], [back, half]])
      pts.push(new THREE.Vector3(x + (r() - .5) * .3 - (y === y0 ? .25 : 0), y, waterfall.z + zz + (r() - .5) * .3));
    const g = new ConvexGeometry(pts);
    colour(g, y => iceTint(smooth(y0, y1, y)));
    add(new THREE.Mesh(g, fall), 'Cave glow waterfall');
    if (y0 < 2) hull(pts);
  }
  // A crust of clear ice where it meets the floor.
  const foot = rockMass(r, HALF - 3.2, waterfall.z, 2.6, -.2, .9, [[0, 1], [.5, .85], [1, .4]], iceTint, 9);
  add(new THREE.Mesh(foot.geometry, fall), 'Cave glow waterfall foot'); hull(foot.points);

  // FROZEN POND: snowy rim stones round a glowing ice sheet.
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2 + r() * .2;
    place('Pool_Stone', [pond.at[0] + Math.cos(a) * pond.radius, 0, pond.at[2] + Math.sin(a) * pond.radius], -a + Math.PI / 2, .95 + r() * .25);
  }
  const sheet = new THREE.CircleGeometry(pond.radius - .25, 28).rotateX(-Math.PI / 2).toNonIndexed(); sheet.translate(pond.at[0], .3, pond.at[2]); sheet.computeVertexNormals();
  add(new THREE.Mesh(colour(sheet, () => new THREE.Color('#a8e6fa')), glow('Cave glow pond', '#5fd2f4', .5)), 'Cave glow pond');
  box([pond.at[0], .25, pond.at[2]], [pond.radius * .8, .25, pond.radius * .8]);

  // ICE FORMATIONS.
  for (const s of HALL.spires) {
    place('Ice_Spire', s.at, s.yaw, s.height);
    box([s.at[0], s.height * .3, s.at[2]], [s.height * .16, s.height * .3, s.height * .16]);
  }
  kit.services();

  // CAMPFIRE with log seats east and west of it.
  const [cx, , cz] = HALL.campfire;
  place('Campfire', HALL.campfire, 0, 1.35);
  box([cx, .45, cz], [1.25, .45, 1.25]);
  for (const side of [-1, 1]) box([cx + side * 2.3, .27, cz], [.3, .27, 1]);
  // IGLOO, its tunnel facing the hall, and the ore sled parked beside it.
  const [ix, , iz] = HALL.igloo;
  place('Igloo', HALL.igloo, Math.PI);
  box([ix, 1.3, iz], [2.3, 1.3, 2.3]); box([ix, .85, iz - 2.7], [.95, .85, .8]);
  box([ix + 1.9 * -1, .5, iz - 1.6], [.33, .5, .33]); box([ix + 2.1, .3, iz - 1.4], [.33, .3, .33]);
  place('Ore_Sled', [ix - 4.4, 0, iz - .4], .35);
  box([ix - 4.4, .5, iz - .4], [.75, .5, 1.2], .35);

  kit.wallFoot(32, () => r() < .45
    ? { name: 'Ice_Cluster', scale: () => .8 + r() * .8, solid: [.45, .6] }
    : { name: 'Frost_Rock', scale: () => .8 + r() * .9, solid: [.5, .4] });
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
