// Offline: the 蘑菇洞穴 rest hall around the Blender props. A craggy shell of faceted rock masses hides the voxel
// walls and ceiling of the 40 x 40 x 20 m room, stalactites hang from it, flagstones and moss carpet the floor
// ring round the open 16 m mine pit, a raised glowing pool sits in the north-east, and the props stand where
// src/game/content/underground/fungalHall.ts puts them. Colliders: rock masses as convex hulls, props as boxes.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rng } from '../terrain/kit.ts';
import { FUNGAL_HALL as HALL } from '../../../src/game/content/underground/fungalHall.ts';

export type HallSolid = { at: number[]; half: number[]; yaw: number; hull?: number[] };
type GetProp = (name: string) => THREE.Object3D;

const HALF = HALL.size[0] / 2, TOP = HALL.size[1], PIT = HALL.pit;
const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Vertex-coloured materials (converted to the game's standard material on export). */
const matte = (name: string) => Object.assign(new THREE.MeshLambertMaterial({ vertexColors: true }), { name });
const glow = (name: string, color: string, strength: number) => Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, color: '#ffffff', emissive: color, emissiveIntensity: strength, roughness: .6 }), { name });
const M = {
  rock: matte('Cave rock'), ceiling: matte('Cave ceiling'), floor: matte('Cave flagstones'), moss: matte('Cave moss'),
  glowTeal: glow('Cave glow teal', '#57f0d8', 1.2), glowViolet: glow('Cave glow violet', '#b98bff', 1.1), pool: glow('Cave glow pool', '#3fe3d2', .9),
};

function colour(g: THREE.BufferGeometry, pick: (y: number, i: number, n: THREE.Vector3) => THREE.Color) {
  const p = g.getAttribute('position'), nrm = g.getAttribute('normal'), out = new Float32Array(p.count * 3), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3; n.fromBufferAttribute(nrm, i);
    const c = pick(y, i, n);
    for (let k = 0; k < 3; k++) c.toArray(out, (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** A faceted rock mass: a convex hull of jittered rings, widest a third of the way up. */
function rockMass(r: () => number, x: number, z: number, radius: number, y0: number, y1: number, profile: readonly (readonly [number, number])[], tint: (f: number) => THREE.Color) {
  const sides = 7, spin = r() * Math.PI * 2, points: THREE.Vector3[] = [];
  for (const [f, k] of profile) for (let i = 0; i < sides; i++) {
    const a = spin + (i + (r() - .5) * .6) / sides * Math.PI * 2, rr = radius * k * (.82 + r() * .32);
    points.push(new THREE.Vector3(x + Math.cos(a) * rr, y0 + (y1 - y0) * f, z + Math.sin(a) * rr));
  }
  const g = new ConvexGeometry(points), shade = rng(Math.floor(x * 97 + z * 13 + y0 * 7));
  colour(g, y => tint((y - y0) / Math.max(.01, y1 - y0)).clone().multiplyScalar(.9 + shade() * .16));
  return { geometry: g, points };
}

export function buildFungalHall(getProp: GetProp) {
  const group = new THREE.Group(); group.name = 'Fungal hall';
  const solids: HallSolid[] = [], r = rng(80001);
  const hull = (points: THREE.Vector3[]) => {
    const b = new THREE.Box3().setFromPoints(points), c = b.getCenter(new THREE.Vector3()), h = b.getSize(new THREE.Vector3()).multiplyScalar(.5);
    solids.push({ at: c.toArray(), half: h.toArray(), yaw: 0, hull: points.flatMap(p => [p.x - c.x, p.y - c.y, p.z - c.z].map(v => +v.toFixed(4))) });
  };
  const box = (at: readonly number[], half: readonly number[], yaw = 0) => solids.push({ at: [...at], half: [...half], yaw });
  const add = (mesh: THREE.Mesh) => { mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };

  // Keep-out areas the wall masses must not intrude on at floor level: the stalls, the name board, the big caps.
  const stallBoxes = [HALL.stalls.sell.at, HALL.stalls.shop.at].map(([x, , z]) => ({ x0: x - 3.2, x1: x + 3.2, z0: z - 2.2, z1: z + 2.2 }));
  const clearOf = (x: number, z: number, reach: number) =>
    !stallBoxes.some(b => x + reach > b.x0 && x - reach < b.x1 && z + reach > b.z0 && z - reach < b.z1) &&
    !(Math.abs(x - HALL.board[0]) < 5.2 && z - reach < HALL.board[2] + 1) &&
    !HALL.mushrooms.slice(0, 4).some(m => Math.hypot(x - m.at[0], z - m.at[2]) < reach + m.cap * .55);

  // WALLS: two tiers of masses along every wall, their backs beyond the voxel wall. The lower tier is chunky and
  // stays shallow where the floor ring is busy; the upper tier leans further in, under the ceiling.
  const rockTint = (f: number) => new THREE.Color('#5a6182').lerp(new THREE.Color('#7f76ad'), smooth(.1, .9, f));
  const upperTint = (f: number) => new THREE.Color('#6d669c').lerp(new THREE.Color('#4a4574'), smooth(.2, 1, f));
  for (const [wall, along] of [['n', 1], ['s', 1], ['w', 0], ['e', 0]] as const) {
    for (let d = -HALF - 1; d < HALF + 1; d += 3.6 + r() * 1.6) {
      const sign = wall === 'n' || wall === 'w' ? -1 : 1, wallX = (v: number, inset: number) => along ? [v, sign * (HALF - inset)] : [sign * (HALF - inset), v];
      // Lower tier: radius 2.4-3.6, centred near the wall line, so its inner face stands 2-4 m into the room.
      // Where that would crowd a stall, the board or a big mushroom it shrinks back toward the wall.
      let radius = 2.4 + r() * 1.2, inset = radius * (-.1 + r() * .3);
      let [x, z] = wallX(d, inset);
      const face = () => { const [fx, fz] = wallX(d, inset + radius); return [fx, fz]; };
      for (let tries = 0; tries < 4 && !clearOf(face()[0], face()[1], .4); tries++) { radius *= .78; inset = -radius * .25; [x, z] = wallX(d, inset); }
      const lowTop = 6 + r() * 7;
      const low = rockMass(r, x, z, radius, -.6, lowTop, [[0, .96], [.32, 1], [.66, .9], [1, .62]], rockTint);
      add(new THREE.Mesh(low.geometry, M.rock)).name = 'Cave wall mass'; hull(low.points);
      // Upper tier up to the ceiling, a little further in.
      const upRadius = 2.8 + r() * 1.6, upInset = upRadius * (.35 + r() * .3);
      const [ux, uz] = wallX(d + (r() - .5) * 1.8, upInset);
      const up = rockMass(r, ux, uz, upRadius, lowTop - 1.5, TOP + 1, [[0, .7], [.3, 1], [.75, 1.05], [1, 1]], upperTint);
      add(new THREE.Mesh(up.geometry, M.rock)).name = 'Cave wall upper mass';
    }
  }
  // Corners: one big mass each, filling the junction.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const m = rockMass(r, sx * (HALF - 1), sz * (HALF - 1), 4.2, -.6, TOP + 1, [[0, .9], [.4, 1], [1, .95]], rockTint);
    add(new THREE.Mesh(m.geometry, M.rock)).name = 'Cave corner mass'; hull(m.points);
  }

  // CEILING: broad slabs a little under the voxel ceiling, then stalactites over the floor ring.
  const ceilingTint = (f: number) => new THREE.Color('#3e3a63').lerp(new THREE.Color('#57518a'), f);
  for (let x = -HALF; x < HALF; x += 6.5) for (let z = -HALF; z < HALF; z += 6.5) {
    const cx = x + 3.25 + (r() - .5) * 2, cz = z + 3.25 + (r() - .5) * 2, base = TOP - 2.6 - r() * 2.2;
    const slab = rockMass(r, cx, cz, 4.6 + r() * 1.2, base, TOP + .8, [[0, .62], [.4, 1], [1, 1]], ceilingTint);
    add(new THREE.Mesh(slab.geometry, M.ceiling)).name = 'Cave ceiling slab';
  }
  const stalTint = new THREE.Color('#5d578c');
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 6 + r() * 12.5, x = Math.cos(a) * d * 1.08, z = Math.sin(a) * d * 1.08;
    if (Math.abs(x) > HALF - 1.5 || Math.abs(z) > HALF - 1.5) continue;
    const length = 1.6 + r() * 4.2, radius = .45 + r() * .7, top = TOP - 1.4 - r() * 1.6;
    const g = new THREE.ConeGeometry(radius, length, 6, 1).rotateX(Math.PI).toNonIndexed(); g.computeVertexNormals();
    g.translate(x, top - length / 2, z);
    colour(g, (y) => stalTint.clone().lerp(new THREE.Color('#8a80c8'), smooth(top, top - length, y)));
    add(new THREE.Mesh(g, M.ceiling)).name = 'Cave stalactite';
    // A few tips glow faintly, catching the mushrooms' colours.
    if (r() < .22) {
      const tip = new THREE.OctahedronGeometry(.18 + r() * .12, 0).toNonIndexed(); tip.computeVertexNormals(); tip.translate(x, top - length - .05, z);
      colour(tip, () => new THREE.Color('#ffffff'));
      add(new THREE.Mesh(tip, r() < .5 ? M.glowTeal : M.glowViolet)).name = 'Cave glow tip';
    }
  }

  // FLOOR RING: irregular flagstones over the voxel floor (visual only; the voxels carry the player), dark
  // joints between them, moss carpets near the walls and round the mushrooms with glowing specks.
  const joints = new THREE.PlaneGeometry(HALF * 2, HALF * 2).rotateX(-Math.PI / 2).toNonIndexed(); joints.translate(0, .006, 0);
  colour(joints, () => new THREE.Color('#2a2840'));
  // Cut the pit out of the joint plane: four strips instead of one plane.
  for (const [x0, x1, z0, z1] of [[-HALF, -PIT, -HALF, HALF], [PIT, HALF, -HALF, HALF], [-PIT, PIT, -HALF, -PIT], [-PIT, PIT, PIT, HALF]]) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).toNonIndexed(); g.translate((x0 + x1) / 2, .006, (z0 + z1) / 2);
    colour(g, () => new THREE.Color('#2a2840')); add(new THREE.Mesh(g, M.floor)).name = 'Cave floor joints';
  }
  joints.dispose();
  const stone = [new THREE.Color('#68728f'), new THREE.Color('#727c98'), new THREE.Color('#5f6886'), new THREE.Color('#6b7488')];
  const flagstones: THREE.BufferGeometry[] = [];
  // Large irregular flags on a staggered grid, each a little turned, so the floor never reads as tiles.
  for (let row = 0, z = -HALF; z < HALF; z += 2.6, row++) for (let x = -HALF - (row % 2) * 1.3; x < HALF; x += 2.6) {
    const cx = x + 1.3 + (r() - .5) * .3, cz = z + 1.3 + (r() - .5) * .3, turn = (r() - .5) * .25;
    if (Math.abs(cx) < PIT + .6 && Math.abs(cz) < PIT + .6) continue;
    const corners = [[-1, -.6], [-.3, -1], [1, -.85], [.9, .4], [.4, 1], [-.95, .8]].map(([u, v]) => {
      const k = 1.22 - r() * .16, px = u * k, pz = v * k;
      return new THREE.Vector2(cx + px * Math.cos(turn) - pz * Math.sin(turn), cz + px * Math.sin(turn) + pz * Math.cos(turn));
    });
    const shape = new THREE.Shape(corners.map(p => new THREE.Vector2(p.x, -p.y)));
    const h = .03 + r() * .03;
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); g.computeVertexNormals();
    const c = stone[Math.floor(r() * stone.length)].clone().multiplyScalar(.92 + r() * .14);
    colour(g, () => c); flagstones.push(g);
  }
  for (const g of flagstones) add(new THREE.Mesh(g, M.floor)).name = 'Cave flagstone';
  // The player walks on the stones (their mean top, 4 cm), not on the voxel floor beneath them; low enough
  // that standing here still counts as the room's floor (PlayerDepth: within the spawn clearance).
  for (const [x0, x1, z0, z1] of [[-HALF, -PIT, -HALF, HALF], [PIT, HALF, -HALF, HALF], [-PIT, PIT, -HALF, -PIT], [-PIT, PIT, PIT, HALF]])
    box([(x0 + x1) / 2, .02, (z0 + z1) / 2], [(x1 - x0) / 2, .02, (z1 - z0) / 2]);
  // Moss: soft blobs hugging the walls and the big mushrooms, slightly above the flagstones.
  const mossSpots: [number, number, number][] = [];
  for (const m of HALL.mushrooms) mossSpots.push([m.at[0], m.at[2], m.cap * .75]);
  for (let i = 0; i < 26; i++) {
    const side = Math.floor(r() * 4), d = (r() - .5) * 34, inset = HALF - 2.4 - r() * 1.6;
    mossSpots.push(side === 0 ? [d, -inset, 1.4 + r() * 1.4] : side === 1 ? [d, inset, 1.4 + r() * 1.4] : side === 2 ? [-inset, d, 1.4 + r() * 1.4] : [inset, d, 1.4 + r() * 1.4]);
  }
  for (const [x, z, radius] of mossSpots) {
    if (Math.abs(x) < PIT + .6 && Math.abs(z) < PIT + .6) continue;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = radius * (.7 + r() * .5); pts.push(new THREE.Vector2(x + Math.cos(a) * rr, -(z + Math.sin(a) * rr))); }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: .06, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); g.translate(0, .045, 0); g.computeVertexNormals();
    colour(g, () => new THREE.Color('#2f7a64').multiplyScalar(.85 + r() * .3));
    add(new THREE.Mesh(g, M.moss)).name = 'Cave moss';
    for (let k = 0; k < Math.round(radius * 3); k++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * radius * .8;
      const speck = new THREE.OctahedronGeometry(.05 + r() * .05, 0).toNonIndexed(); speck.computeVertexNormals();
      speck.translate(x + Math.cos(a) * rr, .12, z + Math.sin(a) * rr); colour(speck, () => new THREE.Color('#ffffff'));
      add(new THREE.Mesh(speck, r() < .6 ? M.glowTeal : M.glowViolet)).name = 'Cave moss glow';
    }
  }

  // PIT RIM: a low stone curb round the open pit, open in the middle of every side, a glowing post per corner.
  const curbTint = new THREE.Color('#6a6f86');
  for (const side of [-1, 1]) for (const [a0, a1] of [[-PIT - .6, -1.6], [1.6, PIT + .6]]) {
    for (const axis of ['x', 'z'] as const) {
      const len = a1 - a0, mid = (a0 + a1) / 2;
      const g = new THREE.BoxGeometry(axis === 'x' ? len : .55, .28, axis === 'x' ? .55 : len).toNonIndexed(); g.computeVertexNormals();
      const at = axis === 'x' ? [mid, .14, side * (PIT + .3)] : [side * (PIT + .3), .14, mid];
      g.translate(at[0], at[1], at[2]); colour(g, (y) => curbTint.clone().multiplyScalar(y > .2 ? 1.12 : .9));
      add(new THREE.Mesh(g, M.floor)).name = 'Cave pit curb';
      box(at, axis === 'x' ? [len / 2, .14, .275] : [.275, .14, len / 2]);
    }
  }
  const place = (name: string, at: readonly number[], yaw = 0, scale = 1) => {
    const p = getProp(name); p.position.set(at[0], at[1], at[2]); p.rotation.y = yaw; p.scale.setScalar(scale); group.add(p); return p;
  };
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { place('Pit_Post', [sx * (PIT + .5), 0, sz * (PIT + .5)], r() * 6); box([sx * (PIT + .5), .55, sz * (PIT + .5)], [.35, .55, .35]); }

  // GLOWING POOL: a ring of mossy rim stones round a still, glowing surface.
  const { at: poolAt, radius: poolR } = HALL.pool;
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2 + r() * .2;
    place('Pool_Stone', [poolAt[0] + Math.cos(a) * poolR, 0, poolAt[2] + Math.sin(a) * poolR], -a + Math.PI / 2, .95 + r() * .25);
  }
  const water = new THREE.CircleGeometry(poolR - .25, 28).rotateX(-Math.PI / 2).toNonIndexed(); water.translate(poolAt[0], .3, poolAt[2]); water.computeVertexNormals();
  colour(water, () => new THREE.Color('#9ff7ee'));
  const pool = add(new THREE.Mesh(water, M.pool)); pool.name = 'Cave glow pool';
  box([poolAt[0], .25, poolAt[2]], [poolR * .8, .25, poolR * .8]);

  // GLOWING VINES hanging from the ceiling slabs (found by casting rays up), light accents high in the hall.
  const rocks: THREE.Mesh[] = []; group.updateMatrixWorld(true);
  group.traverse(o => { if (o instanceof THREE.Mesh && (o.material === M.rock || o.material === M.ceiling)) rocks.push(o); });
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 22; i++) {
    const x = (r() - .5) * 34, z = (r() - .5) * 34;
    if (Math.abs(x) < PIT && Math.abs(z) < PIT && r() < .7) continue;
    ray.set(new THREE.Vector3(x, 8, z), up); ray.far = 20;
    const hit = ray.intersectObjects(rocks, false)[0]; if (!hit) continue;
    const length = 2 + r() * 4.5, beads = Math.round(length / .42), tint = r() < .5;
    for (let k = 0; k < beads; k++) {
      const bead = new THREE.OctahedronGeometry(.09 + (k % 3 === 0 ? .06 : 0), 0).toNonIndexed(); bead.computeVertexNormals();
      bead.translate(x + Math.sin(k * .9) * .08, hit.point.y - .2 - k * .42, z + Math.cos(k * .7) * .08);
      colour(bead, () => new THREE.Color('#ffffff'));
      add(new THREE.Mesh(bead, tint ? M.glowTeal : M.glowViolet)).name = 'Cave glow vine';
    }
    const strand = new THREE.CylinderGeometry(.025, .025, length, 4).toNonIndexed(); strand.computeVertexNormals();
    strand.translate(x, hit.point.y - .2 - length / 2, z); colour(strand, () => new THREE.Color('#2c5d58'));
    add(new THREE.Mesh(strand, M.moss)).name = 'Cave vine strand';
  }

  // PROPS from the Blender kit.
  for (const m of HALL.mushrooms) {
    place(m.tint === 'teal' ? 'Mushroom_Teal' : 'Mushroom_Violet', m.at, m.yaw, m.height);
    box([m.at[0], m.height * .36, m.at[2]], [m.height * .075, m.height * .36, m.height * .075]);
  }
  for (const [name, stall] of [['Stall_Sell', HALL.stalls.sell], ['Stall_Shop', HALL.stalls.shop]] as const) {
    place(name, stall.at, Math.PI);
    box([stall.at[0], .7, stall.at[2] - .45], [2.4, .7, .7]); // counter (the stall faces -Z, so its front is at lower z)
    for (const side of [-1, 1]) box([stall.at[0] + side * 2.2, 1.9, stall.at[2] + .9], [.2, 1.9, .2]);
    box([stall.at[0], .9, stall.at[2] + 1.15], [2.1, .9, .4]); // back shelf
  }
  place('Name_Board', [HALL.board[0], 0, HALL.board[2]], 0);
  for (const side of [-1, 1]) box([HALL.board[0] + side * 3.9, 3.8, HALL.board[2]], [.3, 3.8, .3]);
  for (const [x, z, yaw] of [[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-8.8, -12.6, 0], [8.8, -12.6, Math.PI]] as const) {
    place('Lantern_Post', [x, 0, z], yaw); box([x, 1.4, z], [.2, 1.4, .2]);
  }
  // Crystals and small mushroom clumps along the wall feet.
  for (let i = 0; i < 34; i++) {
    const side = Math.floor(r() * 4), d = (r() - .5) * 34, inset = HALF - 2.9 - r() * .8;
    const [x, z] = side === 0 ? [d, -inset] : side === 1 ? [d, inset] : side === 2 ? [-inset, d] : [inset, d];
    if (!clearOf(x, z, .8)) continue;
    const crystal = r() < .35;
    place(crystal ? 'Crystal_Cluster' : 'Mushroom_Cluster', [x, 0, z], r() * 6.3, crystal ? .9 + r() * .7 : .9 + r() * .9);
    if (crystal) box([x, .5, z], [.45, .5, .45]);
  }
  return { group, solids, lights: HALL.lights };
}
