// Offline: 第三世界's surface, 星陨秘境, a crater where a star fell, in big flat colour blocks on pale stardust,
// closed by moonstone crater walls with crystals on their tops and a few floating islands above them. Props from
// build_star_base.py (and, round the teleport station, the layers' own props from their halls' kits), placed from
// src/game/content/world3/starBase.ts. Local metres round the mine shaft (world z 448). Stardust everywhere, the
// crater's pale stone rim round the shaft with posts and gold rails, starlight paths with white arrows from the
// portal past the spawn and round the crater; the fallen star hung and turning over the shaft (a Spin_* node), the
// crater arch behind it, the observatories facing the paths, the portal and the station; crystal trees, clusters
// and star lanterns; world 3's eggs on their pad east of the spawn. Baked with the daytime sun, so large flat
// surfaces are subdivided.
import * as THREE from 'three';
import { colour, matte, rockMass, type GetProp, type HallSolid } from './caveKit.ts';
import { rng } from '../terrain/kit.ts';
import { flat, ribbon, roundedSquare, tessellate } from './techBaseHall.ts';
import { buildHatchery } from './hatchery.ts';
import { STAR_BASE as BASE } from '../../../src/game/content/world3/starBase.ts';

export const ASSET = BASE.asset;
export const SUN = true;
// The station's decor comes from world 3's own layers (their halls' prop kits; the fossil and the shard are in
// the tech base's kit, by world 2's portal).
export const PROPS = ['star-base', 'egg-stands', 'tech-base', 'gear', 'crystal', 'ruins', 'frozen'];

const SHAFT = 8;

export function buildHall(getProp: GetProp) {
  const group = new THREE.Group(); group.name = 'star base';
  const solids: HallSolid[] = [], r = rng(330003);
  const box = (at: readonly number[], half: readonly number[], yaw = 0) => solids.push({ at: [...at], half: [...half], yaw });
  const hull = (points: THREE.Vector3[]) => {
    const b = new THREE.Box3().setFromPoints(points), c = b.getCenter(new THREE.Vector3()), h = b.getSize(new THREE.Vector3()).multiplyScalar(.5);
    solids.push({ at: c.toArray(), half: h.toArray(), yaw: 0, hull: points.flatMap(p => [p.x - c.x, p.y - c.y, p.z - c.z].map(v => +v.toFixed(4))) });
  };
  const add = (mesh: THREE.Mesh, name: string) => { mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
  const fine = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const place = (name: string, at: readonly number[], yaw = 0, parent: THREE.Object3D = group, scale = 1) => {
    const p = getProp(name); p.position.set(at[0], at[1], at[2]); p.rotation.y = yaw; p.scale.setScalar(scale); parent.add(p);
    p.traverse(o => { if (o instanceof THREE.Mesh) { let g = fine.get(o.geometry); if (!g) { g = tessellate(o.geometry, 1.8); fine.set(o.geometry, g); } o.geometry = g; } });
    return p;
  };
  // A box collider given in a prop's own frame (turned by its yaw round its origin, scaled by k).
  const solidAt = (at: readonly number[], yaw: number, local: readonly number[], half: readonly number[], k = 1) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    box([at[0] + (local[0] * c + local[2] * s) * k, at[1] + local[1] * k, at[2] + (-local[0] * s + local[2] * c) * k], half.map(v => v * k), yaw);
  };
  const M = { ground: matte('Base ground'), rim: matte('Base crater rim'), paint: matte('Base paint'), rock: matte('Base crater rock'), rail: matte('Base rail') };
  const tint = (g: THREE.BufferGeometry, hex: string | ((y: number) => THREE.Color)) => colour(g, typeof hex === 'string' ? () => new THREE.Color(hex) : hex);
  const cuboid = (at: readonly number[], size: readonly number[], hex: string, material: THREE.Material, name: string, yaw = 0) => {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed(); g.rotateY(yaw); g.translate(at[0], at[1], at[2]);
    return add(new THREE.Mesh(tessellate(tint(g, hex), 2), material), name);
  };
  const paint = (g: THREE.BufferGeometry, hex: string, name: string, material = M.paint, max = 2) => add(new THREE.Mesh(tessellate(tint(g, hex), max), material), name);
  const { basin, paths } = BASE;

  // GROUND: pale lilac stardust over the basin and under the walls, 2 m cells in soft patches (shaft left open).
  const dust = [new THREE.Color('#d2b9ea'), new THREE.Color('#d8c1ee'), new THREE.Color('#cbb0e5'), new THREE.Color('#ddc8f1')];
  const noise = (x: number, z: number) => Math.sin(x * .09 + z * .061) * .5 + Math.sin(x * .23 - z * .17 + 1.3) * .3 + Math.sin(x * .53 + z * .47) * .2;
  const G = { x0: -48, x1: 48, z0: -38, z1: 80 };
  for (const [x0, x1, z0, z1] of [[G.x0, -SHAFT, G.z0, G.z1], [SHAFT, G.x1, G.z0, G.z1], [-SHAFT, SHAFT, G.z0, -SHAFT], [-SHAFT, SHAFT, SHAFT, G.z1]]) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / 2), Math.ceil((z1 - z0) / 2)).rotateX(-Math.PI / 2).toNonIndexed();
    g.translate((x0 + x1) / 2, .015, (z0 + z1) / 2); g.computeVertexNormals();
    const p = g.getAttribute('position');
    colour(g, (_y, i) => {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, n = noise(x, z);
      const c = n > .45 ? dust[3] : n > .05 ? dust[1] : n > -.4 ? dust[0] : dust[2];
      return c.clone().multiplyScalar(.98 + ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1 * .025);
    });
    add(new THREE.Mesh(g, M.ground), 'Base ground');
  }

  // THE CRATER RIM round the shaft: pale stone from the pit's edge out to a rounded square, a little raised, its
  // kerb lilac; a gold inlay band near the mouth.
  {
    const shape = new THREE.Shape(roundedSquare(BASE.rim, 3.4, 5).map(p => new THREE.Vector2(p.x, -p.y)));
    shape.holes.push(new THREE.Path([new THREE.Vector2(-SHAFT, -SHAFT), new THREE.Vector2(SHAFT, -SHAFT), new THREE.Vector2(SHAFT, SHAFT), new THREE.Vector2(-SHAFT, SHAFT)]));
    const g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).toNonIndexed(); g.translate(0, .03, 0); g.computeVertexNormals();
    paint(g, '#f1edf6', 'Base crater rim', M.rim, 1.6);
    const kerb = new THREE.Shape(roundedSquare(BASE.rim + .3, 3.6, 5).map(p => new THREE.Vector2(p.x, -p.y)));
    kerb.holes.push(new THREE.Path(roundedSquare(BASE.rim, 3.4, 5).map(p => new THREE.Vector2(p.x, -p.y))));
    const k = new THREE.ExtrudeGeometry(kerb, { depth: .12, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); k.computeVertexNormals();
    paint(k, '#9c8ad6', 'Base crater kerb', M.rim, 1.6);
  }
  for (const side of [-1, 1]) for (const axis of ['x', 'z'] as const) {
    const at = axis === 'x' ? [0, .06, side * (SHAFT + .45)] : [side * (SHAFT + .45), .06, 0];
    cuboid(at, axis === 'x' ? [2 * SHAFT + 1.4, .06, .5] : [.5, .06, 2 * SHAFT + 1.4], '#f2be36', M.paint, 'Base crater inlay');
  }

  // STARLIGHT PATHS: the loop round the crater, the trunk from the portal to the spawn and the two curves from the
  // spawn round either side; a gold edge under a pale gold middle. White arrows point toward the mine.
  const W = paths.width;
  const lane = (pts: THREE.Vector2[], y: number, closed = false) => {
    paint(ribbon(pts, W, y, closed), '#e7c26a', 'Base path edge', M.paint, 1.6);
    paint(ribbon(pts, W - .4, y + .006, closed), '#fbe8b2', 'Base path', M.paint, 1.6);
  };
  const arrow = (at: THREE.Vector2, dir: THREE.Vector2, y: number) => {
    const n = new THREE.Vector2(-dir.y, dir.x), shape: [number, number][] = [[-.9, -.26], [.05, -.26], [.05, -.66], [1.0, 0], [.05, .66], [.05, .26], [-.9, .26]];
    const pt = ([u, v]: [number, number]) => at.clone().addScaledVector(dir, u).addScaledVector(n, v), P = shape.map(pt), tris: number[][] = [];
    for (const [a, b, c] of [[0, 1, 5], [0, 5, 6], [2, 3, 4], [1, 2, 4], [1, 4, 5]]) tris.push([P[a].x, P[a].y, P[b].x, P[b].y, P[c].x, P[c].y]);
    paint(flat(tris, y), '#fffdf8', 'Base path arrow', M.paint, 1.2);
  };
  lane(roundedSquare(paths.loop.half, paths.loop.corner), .04, true);
  lane(paths.trunk.map(([x, z]) => new THREE.Vector2(x, z)), .052);
  arrow(new THREE.Vector2(0, 52), new THREE.Vector2(0, -1), .064);
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3(paths.curve.map(([x, z]) => new THREE.Vector3(s * x, 0, z)));
    lane(curve.getSpacedPoints(60).map(p => new THREE.Vector2(p.x, p.z)), .052);
    for (const t of [.22, .5, .76]) {
      const p = curve.getPointAt(t), d = curve.getTangentAt(t);
      arrow(new THREE.Vector2(p.x, p.z), new THREE.Vector2(d.x, d.z).normalize(), .064);
    }
  }
  // The spawn medallion on the trunk: a white disc with a gold ring and a violet star.
  {
    const disc = new THREE.CylinderGeometry(2.6, 2.6, .05, 28).toNonIndexed(); disc.translate(0, .07, 46); disc.computeVertexNormals();
    paint(disc, '#f8f5fb', 'Base medallion', M.paint, 1.4);
    const ring = new THREE.RingGeometry(1.9, 2.3, 28).rotateX(-Math.PI / 2).toNonIndexed(); ring.translate(0, .1, 46);
    paint(ring, '#f2be36', 'Base medallion ring', M.paint, 1.4);
    const star: [number, number][] = [];
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? .55 : 1.3; star.push([Math.cos(a) * rr, 46 + Math.sin(a) * rr]); }
    const tris: number[][] = []; for (let k = 0; k < 10; k++) tris.push([0, 46, ...star[k], ...star[(k + 1) % 10]]);
    paint(flat(tris, .1), '#9c66e6', 'Base medallion star', M.paint, 1.2);
  }

  // THE RAIL round the crater's mouth: posts every ~2.3 m, gold rails, an opening in the middle of each side
  // between two taller gate posts.
  {
    const R = BASE.rail.at, gap = BASE.rail.opening / 2, posts = [R, R - 2.3, R - 4.6, gap + .15];
    for (const side of [-1, 1]) for (const axis of ['x', 'z'] as const) {
      const at = (d: number, y = 0): [number, number, number] => axis === 'x' ? [d, y, side * R] : [side * R, y, d];
      for (const s of [-1, 1]) {
        for (const d of posts) { const gate = d === gap + .15; if (d === R && axis === 'z') continue; place(gate ? 'Star_Post_Gate' : 'Star_Post', at(s * d)); }
        const len = R - gap - .15, mid = s * (gap + .15 + len / 2);
        for (const y of [.5, .95]) cuboid(at(mid, y), axis === 'x' ? [len, .1, .1] : [.1, .1, len], '#f2be36', M.rail, 'Base rail');
        box(at(mid, .55), axis === 'x' ? [len / 2, .55, .15] : [.15, .55, len / 2]);
      }
    }
  }

  // CRATER WALLS: two rows of moonstone round the basin, the inner lower, the outer tall, so nothing outside shows;
  // pale tops on the outer row, crystal clusters on some of them.
  // Violet bands, clearly darker and more coloured than the sky, under pale tops.
  const strata = ['#8a70d4', '#9f86e0', '#7a60c8', '#ae98e6', '#9278d8'];
  const wallTint = (f: number) => f > .93 ? new THREE.Color('#eee9f6') : new THREE.Color(strata[Math.floor(f * 9) % strata.length]).multiplyScalar(.92 + f * .1);
  const tops: { x: number; z: number; top: number }[] = [];
  const wall = (x: number, z: number, radius: number, top: number, outer: boolean) => {
    const m = rockMass(r, x, z, radius, -1, top, [[0, 1], [.35, .97], [.6, .9], [.8, .84], [.92, .76], [1, .7]], wallTint, 9);
    add(new THREE.Mesh(outer ? m.geometry : tessellate(m.geometry.toNonIndexed(), 7), M.rock), outer ? 'Base crater wall outer' : 'Base crater wall'); hull(m.points);
    if (outer) tops.push({ x, z, top });
  };
  const perimeter = (offset: number, step: number, each: (x: number, z: number) => void) => {
    const [x0, x1] = basin.x, [z0, z1] = basin.z;
    for (let x = x0 - offset; x <= x1 + offset; x += step) { each(x, z0 - offset); each(x, z1 + offset); }
    for (let z = z0 - offset + step; z < z1 + offset; z += step) { each(x0 - offset, z); each(x1 + offset, z); }
  };
  perimeter(8.5, 8.5, (x, z) => wall(x + (r() - .5) * 2, z + (r() - .5) * 2, 7.6 + r() * 1.6, 13 + r() * 8, false));
  perimeter(19, 11, (x, z) => wall(x + (r() - .5) * 3, z + (r() - .5) * 3, 10 + r() * 3, 26 + r() * 10, true));
  const clusterKinds = ['Crystal_Cluster_Violet', 'Crystal_Cluster_Teal', 'Crystal_Cluster_Pink'];
  tops.forEach((t, i) => { if (i % 3 !== 1) return; place(clusterKinds[i % 3], [t.x, t.top - .4, t.z], r() * 6, group, 2.6 + r()); });
  // Boulders of moon rock at the walls' feet.
  for (let i = 0; i < 16; i++) {
    const side = Math.floor(r() * 4), t = r();
    const x = side < 2 ? basin.x[0] + 2 + t * (basin.x[1] - basin.x[0] - 4) : side === 2 ? basin.x[0] + 1.5 : basin.x[1] - 1.5;
    const z = side >= 2 ? basin.z[0] + 2 + t * (basin.z[1] - basin.z[0] - 4) : side === 0 ? basin.z[0] + 1.5 : basin.z[1] - 1.5;
    if (Math.abs(x) < 8 && z > 50) continue;
    if (Math.hypot(x - BASE.hatchery.centre[0], z - BASE.hatchery.centre[1]) < BASE.hatchery.pad + 3) continue;
    const radius = .8 + r() * 1.3, m = rockMass(r, x, z, radius, -.3, radius * (1.1 + r() * .5), [[0, .9], [.5, 1], [1, .55]], wallTint, 7);
    add(new THREE.Mesh(m.geometry, M.rock), 'Base boulder'); hull(m.points);
  }
  // FLOATING ISLANDS over the walls: a moonstone cone point-down under a pale top, a crystal cluster on it. Out of
  // reach, so no colliders.
  for (const [x, y, z, radius] of BASE.islands) {
    const m = rockMass(r, x, z, radius, y - radius * 1.8, y, [[0, .12], [.45, .55], [.8, .92], [1, 1]], f => f > .9 ? new THREE.Color('#eee9f6') : new THREE.Color(strata[Math.floor(f * 7) % strata.length]), 8);
    add(new THREE.Mesh(m.geometry, M.rock), 'Base floating island');
    place(clusterKinds[Math.floor(r() * 3)], [x, y - .2, z], r() * 6, group, 1.4 + r() * .6);
  }

  // THE FALLEN STAR, hung over the shaft and turning; THE CRATER ARCH behind the shaft's far edge.
  const star = new THREE.Group(); star.name = 'Spin_y_25'; star.position.set(...BASE.star.at); place('Fallen_Star', [0, 0, 0], 0, star, BASE.star.scale); group.add(star);
  place('Crater_Arch', BASE.arch.at);
  for (const s of [-1, 1]) box([BASE.arch.at[0] + s * 9, 4.7, BASE.arch.at[2]], [1.2, 4.7, 1.2]);

  // THE OBSERVATORIES: the ore buyer and the gear shop, fronts to the paths.
  for (const [name, k] of [['Star_Buyer', BASE.kiosks.sell], ['Star_Workshop', BASE.kiosks.shop]] as const) {
    place(name, k.at, k.yaw, group, k.scale);
    solidAt(k.at, k.yaw, [0, 4.4, -3.4], [4.6, 4.4, 4.6], k.scale);
    for (const s of [-1, 1]) solidAt(k.at, k.yaw, [s * 3.95, 2.4, 1.15], [.45, 2.4, 1.15], k.scale);
    solidAt(k.at, k.yaw, [0, 1.0, 2.65], [3.4, 1.0, .5], k.scale);
  }

  // THE WORLD PORTAL and THE TELEPORT STATION.
  const pt = BASE.portal;
  place('Star_Portal', pt.at, pt.yaw);
  for (const s of [-1, 1]) solidAt(pt.at, pt.yaw, [s * 2.1, .7, 0], [.6, .7, .6]);
  solidAt(pt.at, pt.yaw, [0, 2.9, 0], [2.7, 2.9, .45]);
  const st = BASE.station;
  place('Star_Station', [st.x, 0, st.z], st.yaw);
  for (const side of [-1, 1]) box([st.x + Math.cos(st.yaw) * 1.9 * side, 2.6, st.z - Math.sin(st.yaw) * 1.9 * side], [.5, 2.6, .5], st.yaw);
  // Round the station, the layers below (their halls' props), each in the station's frame, on the ground.
  {
    const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    for (const d of BASE.stationDecor) {
      const at: [number, number, number] = [st.x + d.x * c + d.z * s, d.y ?? 0, st.z - d.x * s + d.z * c];
      place(d.prop, at, st.yaw + d.yaw, group, d.scale);
      box([at[0], d.half[1], at[2]], d.half, st.yaw + d.yaw);
    }
  }

  // THE HATCHERY: pale marble, a gold rim, a violet ring at its centre.
  buildHatchery(BASE.hatchery, BASE.stands, { pad: '#f1edf7', rim: '#f2be36', mark: '#9c66e6' },
    { place: (name, at, yaw) => place(name, at, yaw), paint: (g, hex, name, max) => paint(g, hex, name, M.paint, max), box });

  // STAR LANTERNS, CRYSTAL TREES AND CLUSTERS.
  for (const [x, z] of BASE.lamps) { place('Star_Lamp', [x, 0, z], 0); box([x, 2.4, z], [.3, 2.4, .3]); }
  const treeKinds = ['Crystal_Tree_Violet', 'Crystal_Tree_Teal', 'Crystal_Tree_Pink'];
  for (const [x, z, k, yaw, kind] of BASE.trees) { place(treeKinds[kind], [x, 0, z], yaw, group, k); box([x, 1.7 * k, z], [.55 * k, 1.7 * k, .55 * k]); }
  for (const [x, z, k, yaw, kind] of BASE.clusters) {
    if (kind === 1) { place('Star_Fragment', [x, 0, z], yaw, group, k); box([x, .6 * k, z], [1 * k, .6 * k, 1 * k], yaw); }
    else { place(clusterKinds[Math.floor(r() * 3)], [x, 0, z], yaw, group, k * 1.2); box([x, .9 * k, z], [.8 * k, .9 * k, .8 * k], yaw); }
  }
  return { group, solids, lights: [] };
}
