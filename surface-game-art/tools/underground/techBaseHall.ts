// Offline: 第二世界's surface, a desert mining colony in big flat colour blocks on warm sand, ringed by layered red
// mesas. Props from build_tech_base.py, placed from src/game/content/world2/techBase.ts. Local metres round the mine
// shaft (world z 224). Sand everywhere, a concrete apron and a yellow rail round the shaft, painted yellow lanes
// with white arrows from the portal dais past the spawn and round the shaft; the drill tower over the shaft, the
// ore buyer and the gear shop facing the lanes, the world portal on its dais at the far end; palms, cacti, crates,
// a yard with tanks and containers, the silo and its conveyor; world 2's eggs on their pad east of the spawn. The drill bit, the turbine rotors on the mesa tops
// and the conveyor's cleats move in the game (Spin_* / Slide_* nodes). Baked with the daytime sun, so large flat
// surfaces are subdivided. The props bring their colliders (build_tech_base.py); the base adds its own shapes'.
import * as THREE from 'three';
import { colour, matte, rockMass, type GetProp, type HallSolid } from './caveKit.ts';
import { rng } from '../terrain/kit.ts';
import { TECH_BASE as BASE } from '../../../src/game/content/world2/techBase.ts';
import { buildHatchery } from './hatchery.ts';

export const ASSET = BASE.asset;
export const SUN = true;
// The station's decor comes from world 2's own layers' halls (their prop kits).
export const PROPS = ['tech-base', 'egg-stands', 'gear', 'refinery', 'cryo', 'reactor'];

const SHAFT = 8;

/** Split every triangle until no edge is longer than `max` metres (all attributes interpolated). The sun bake
 *  stores one value per vertex; a big face with only its corners, two of them buried in the plinth it stands on,
 *  would go dark all over instead of just at its foot. */
export function tessellate(source: THREE.BufferGeometry, max: number) {
  const g = source.index ? source.toNonIndexed() : source.clone();
  const names = Object.keys(g.attributes), src = names.map(n => g.getAttribute(n));
  const out: number[][] = names.map(() => []);
  const P = g.getAttribute('position'), a = new THREE.Vector3(), b = new THREE.Vector3();
  const split = (tri: number[][][], depth: number) => {
    // tri: [vertex][attribute][components]
    const len = (i: number, j: number) => a.fromArray(tri[i][0]).distanceTo(b.fromArray(tri[j][0]));
    const e = [len(0, 1), len(1, 2), len(2, 0)], longest = Math.max(...e);
    if (longest <= max || depth > 6) { for (const v of tri) v.forEach((values, k) => out[k].push(...values)); return; }
    const k = e.indexOf(longest), i = k, j = (k + 1) % 3, o = (k + 2) % 3;
    const mid = tri[i].map((values, n) => values.map((v, c) => (v + tri[j][n][c]) / 2));
    split([tri[i], mid, tri[o]], depth + 1); split([mid, tri[j], tri[o]], depth + 1);
  };
  for (let t = 0; t < P.count; t += 3)
    split([0, 1, 2].map(v => src.map(attr => Array.from({ length: attr.itemSize }, (_, c) => attr.array[(t + v) * attr.itemSize + c] as number))), 0);
  const result = new THREE.BufferGeometry();
  names.forEach((n, k) => result.setAttribute(n, new THREE.Float32BufferAttribute(out[k], src[k].itemSize)));
  g.dispose();
  return result;
}

/** Flat triangles at height y from XZ corner triples, each wound to face up. */
export function flat(tris: number[][], y: number) {
  const pos: number[] = [];
  for (const [ax, az, bx, bz, cx, cz] of tris) {
    const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0;
    pos.push(ax, y, az, ...(up ? [bx, y, bz, cx, y, cz] : [cx, y, cz, bx, y, bz]));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
/** A painted strip of `width` along the XZ points (closed: back to the first). */
export function ribbon(pts: readonly THREE.Vector2[], width: number, y: number, closed = false) {
  const n = pts.length, side = (i: number) => {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)], b = pts[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
    const t = b.clone().sub(a).normalize(); return new THREE.Vector2(-t.y, t.x).multiplyScalar(width / 2);
  };
  const L = pts.map((p, i) => p.clone().add(side(i))), R = pts.map((p, i) => p.clone().sub(side(i))), tris: number[][] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const j = (i + 1) % n;
    tris.push([L[i].x, L[i].y, R[i].x, R[i].y, L[j].x, L[j].y], [R[i].x, R[i].y, R[j].x, R[j].y, L[j].x, L[j].y]);
  }
  return flat(tris, y);
}
/** A rounded square path round the origin (half size, corner radius), counter-clockwise from +X. */
export function roundedSquare(half: number, corner: number, steps = 6) {
  const pts: THREE.Vector2[] = [], c = half - corner;
  for (const [cx, cz, a0] of [[c, c, 0], [-c, c, Math.PI / 2], [-c, -c, Math.PI], [c, -c, Math.PI * 1.5]] as const)
    for (let k = 0; k <= steps; k++) { const a = a0 + Math.PI / 2 * k / steps; pts.push(new THREE.Vector2(cx + Math.cos(a) * corner, cz + Math.sin(a) * corner)); }
  return pts;
}

export function buildHall(getProp: GetProp) {
  const group = new THREE.Group(); group.name = 'tech base';
  const solids: HallSolid[] = [], r = rng(220002);
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
  const M = { ground: matte('Base ground'), apron: matte('Base apron'), paint: matte('Base paint'), rock: matte('Base cliff rock'), deck: matte('Base deck'), pipe: matte('Base pipes'), rail: matte('Base rail') };
  const tint = (g: THREE.BufferGeometry, hex: string | ((y: number) => THREE.Color)) => colour(g, typeof hex === 'string' ? () => new THREE.Color(hex) : hex);
  const cuboid = (at: readonly number[], size: readonly number[], hex: string | ((y: number) => THREE.Color), material: THREE.Material, name: string, yaw = 0) => {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed(); g.rotateY(yaw); g.translate(at[0], at[1], at[2]);
    return add(new THREE.Mesh(tessellate(tint(g, hex), 2), material), name);
  };
  const paint = (g: THREE.BufferGeometry, hex: string, name: string, material = M.paint, max = 2) => add(new THREE.Mesh(tessellate(tint(g, hex), max), material), name);
  const inside = (x: number, z: number, [x0, x1]: readonly number[], [z0, z1]: readonly number[]) => x > x0 && x < x1 && z > z0 && z < z1;
  const { basin, lanes } = BASE;

  // GROUND: warm sand over the basin and under the mesas, 2 m cells in soft patches (shaft left open).
  const sand = [new THREE.Color('#f0cd98'), new THREE.Color('#f3d4a2'), new THREE.Color('#ecc791'), new THREE.Color('#f5d8a8')];
  const noise = (x: number, z: number) => Math.sin(x * .09 + z * .061) * .5 + Math.sin(x * .23 - z * .17 + 1.3) * .3 + Math.sin(x * .53 + z * .47) * .2;
  const G = { x0: -48, x1: 48, z0: -38, z1: 80 };
  for (const [x0, x1, z0, z1] of [[G.x0, -SHAFT, G.z0, G.z1], [SHAFT, G.x1, G.z0, G.z1], [-SHAFT, SHAFT, G.z0, -SHAFT], [-SHAFT, SHAFT, SHAFT, G.z1]]) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / 2), Math.ceil((z1 - z0) / 2)).rotateX(-Math.PI / 2).toNonIndexed();
    g.translate((x0 + x1) / 2, .015, (z0 + z1) / 2); g.computeVertexNormals();
    const p = g.getAttribute('position');
    colour(g, (_y, i) => {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, n = noise(x, z);
      const c = n > .45 ? sand[3] : n > .05 ? sand[1] : n > -.4 ? sand[0] : sand[2];
      return c.clone().multiplyScalar(.98 + ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1 * .025);
    });
    add(new THREE.Mesh(g, M.ground), 'Base ground');
  }

  // THE APRON round the shaft: light concrete from the pit edge out to a rounded square, a hazard band at the edge.
  {
    const shape = new THREE.Shape(roundedSquare(BASE.apron, 3, 5).map(p => new THREE.Vector2(p.x, -p.y)));
    shape.holes.push(new THREE.Path([new THREE.Vector2(-SHAFT, -SHAFT), new THREE.Vector2(SHAFT, -SHAFT), new THREE.Vector2(SHAFT, SHAFT), new THREE.Vector2(-SHAFT, SHAFT)]));
    const g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).toNonIndexed(); g.translate(0, .03, 0); g.computeVertexNormals();
    paint(g, '#e2dccf', 'Base apron', M.apron, 1.6);
    const kerb = new THREE.Shape(roundedSquare(BASE.apron + .25, 3.2, 5).map(p => new THREE.Vector2(p.x, -p.y)));
    kerb.holes.push(new THREE.Path(roundedSquare(BASE.apron, 3, 5).map(p => new THREE.Vector2(p.x, -p.y))));
    const k = new THREE.ExtrudeGeometry(kerb, { depth: .1, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); k.computeVertexNormals();
    paint(k, '#c9c2b4', 'Base apron kerb', M.apron, 1.6);
  }
  for (const side of [-1, 1]) for (const axis of ['x', 'z'] as const) for (let d = -SHAFT - .6, k = 0; d < SHAFT + .6; d += .86, k++) {
    const w = Math.min(.86, SHAFT + .6 - d), at = axis === 'x' ? [d + w / 2, .08, side * (SHAFT + .3)] : [side * (SHAFT + .3), .08, d + w / 2];
    const g = new THREE.BoxGeometry(axis === 'x' ? w - .04 : .56, .12, axis === 'x' ? .56 : w - .04).toNonIndexed(); g.translate(at[0], at[1], at[2]);
    add(new THREE.Mesh(tint(g, k % 2 ? '#2a2a2e' : '#f5c02a'), M.paint), 'Base hazard band');
  }

  // LANES: the loop round the shaft, the trunk from the dais steps to the spawn and the two curves from the spawn
  // round either side; a darker yellow edge under a bright yellow middle, the curves a little above the loop they
  // run into. White arrows on the curves and the trunk point toward the mine.
  const W = lanes.width;
  const lane = (pts: THREE.Vector2[], y: number, closed = false) => {
    paint(ribbon(pts, W, y, closed), '#e2a218', 'Base lane edge', M.paint, 1.6);
    paint(ribbon(pts, W - .36, y + .006, closed), '#f8c73a', 'Base lane', M.paint, 1.6);
  };
  const arrow = (at: THREE.Vector2, dir: THREE.Vector2, y: number) => {
    const n = new THREE.Vector2(-dir.y, dir.x), shape: [number, number][] = [[-.9, -.26], [.05, -.26], [.05, -.66], [1.0, 0], [.05, .66], [.05, .26], [-.9, .26]];
    const pt = ([u, v]: [number, number]) => at.clone().addScaledVector(dir, u).addScaledVector(n, v), P = shape.map(pt), tris: number[][] = [];
    for (const [a, b, c] of [[0, 1, 5], [0, 5, 6], [2, 3, 4], [1, 2, 4], [1, 4, 5]]) tris.push([P[a].x, P[a].y, P[b].x, P[b].y, P[c].x, P[c].y]);
    paint(flat(tris, y), '#fbf8f0', 'Base lane arrow', M.paint, 1.2);
  };
  lane(roundedSquare(lanes.loop.half, lanes.loop.corner), .04, true);
  const trunk = lanes.trunk.map(([x, z]) => new THREE.Vector2(x, z));
  lane(trunk, .052);
  arrow(new THREE.Vector2(0, 51.5), new THREE.Vector2(0, -1), .064);
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3(lanes.curve.map(([x, z]) => new THREE.Vector3(s * x, 0, z)));
    lane(curve.getSpacedPoints(60).map(p => new THREE.Vector2(p.x, p.z)), .052);
    for (const t of [.22, .5, .76]) {
      const p = curve.getPointAt(t), d = curve.getTangentAt(t);
      arrow(new THREE.Vector2(p.x, p.z), new THREE.Vector2(d.x, d.z).normalize(), .064);
    }
  }
  // The spawn medallion on the trunk: a white disc with a yellow ring.
  {
    const disc = new THREE.CylinderGeometry(2.6, 2.6, .05, 28).toNonIndexed(); disc.translate(0, .07, 46); disc.computeVertexNormals();
    paint(disc, '#f6f3ec', 'Base medallion', M.paint, 1.4);
    const ring = new THREE.RingGeometry(1.9, 2.3, 28).rotateX(-Math.PI / 2).toNonIndexed(); ring.translate(0, .1, 46);
    paint(ring, '#f5c02a', 'Base medallion ring', M.paint, 1.4);
    arrow(new THREE.Vector2(0, 46.5), new THREE.Vector2(0, -1), .1);
  }

  // THE RAIL round the shaft: posts every ~2.2 m, yellow rails, an opening in the middle of each side between two
  // striped gate posts.
  {
    const R = BASE.rail.at, gap = BASE.rail.opening / 2, posts = [R, R - 2.3, R - 4.6, gap + .15];
    for (const side of [-1, 1]) for (const axis of ['x', 'z'] as const) {
      const at = (d: number, y = 0): [number, number, number] => axis === 'x' ? [d, y, side * R] : [side * R, y, d];
      for (const s of [-1, 1]) {
        for (const d of posts) { const gate = d === gap + .15; if (d === R && axis === 'z') continue; place(gate ? 'Rail_Gate' : 'Rail_Post', at(s * d)); }
        const len = R - gap - .15, mid = s * (gap + .15 + len / 2);
        for (const y of [.5, .95]) cuboid(at(mid, y), axis === 'x' ? [len, .12, .12] : [.12, .12, len], '#f5c02a', M.rail, 'Base rail');
        box(at(mid, .55), axis === 'x' ? [len / 2, .55, .15] : [.15, .55, len / 2]);
      }
    }
  }

  // MESAS: two rows of layered red rock round the basin, the inner lower, the outer tall, so nothing outside shows.
  const strata = ['#c65a3a', '#d46e48', '#b84e32', '#de8258', '#cc6440'];
  const cliffTint = (f: number) => new THREE.Color(strata[Math.floor(f * 9) % strata.length]).multiplyScalar(.9 + f * .14);
  const tops: { x: number; z: number; top: number }[] = [];
  const cliff = (x: number, z: number, radius: number, top: number, outer: boolean) => {
    const m = rockMass(r, x, z, radius, -1, top, [[0, 1], [.35, .97], [.6, .9], [.8, .84], [.92, .76], [1, .7]], cliffTint, 9);
    add(new THREE.Mesh(outer ? m.geometry : tessellate(m.geometry.toNonIndexed(), 7), M.rock), outer ? 'Base cliff outer' : 'Base cliff'); hull(m.points);
    if (outer) tops.push({ x, z, top });
  };
  const perimeter = (offset: number, step: number, each: (x: number, z: number) => void) => {
    const [x0, x1] = basin.x, [z0, z1] = basin.z;
    for (let x = x0 - offset; x <= x1 + offset; x += step) { each(x, z0 - offset); each(x, z1 + offset); }
    for (let z = z0 - offset + step; z < z1 + offset; z += step) { each(x0 - offset, z); each(x1 + offset, z); }
  };
  perimeter(8.5, 8.5, (x, z) => cliff(x + (r() - .5) * 2, z + (r() - .5) * 2, 7.6 + r() * 1.6, 15 + r() * 9, false));
  perimeter(19, 11, (x, z) => cliff(x + (r() - .5) * 3, z + (r() - .5) * 3, 10 + r() * 3, 27 + r() * 11, true));
  // A few boulders at the mesa feet.
  for (let i = 0; i < 18; i++) {
    const side = Math.floor(r() * 4), t = r();
    const x = side < 2 ? basin.x[0] + 2 + t * (basin.x[1] - basin.x[0] - 4) : side === 2 ? basin.x[0] + 1.5 : basin.x[1] - 1.5;
    const z = side >= 2 ? basin.z[0] + 2 + t * (basin.z[1] - basin.z[0] - 4) : side === 0 ? basin.z[0] + 1.5 : basin.z[1] - 1.5;
    if (Math.abs(x) < 8 && z > 50) continue;
    const radius = .8 + r() * 1.4, m = rockMass(r, x, z, radius, -.3, radius * (1.1 + r() * .5), [[0, .9], [.5, 1], [1, .55]], cliffTint, 7);
    add(new THREE.Mesh(m.geometry, M.rock), 'Base boulder'); hull(m.points);
  }

  // THE DRILL TOWER over the shaft, its bit spinning below the column.
  const F = BASE.rig.feet;
  place('Drill_Rig', [0, 0, 0]);
  const bit = new THREE.Group(); bit.name = 'Spin_y_160'; bit.position.set(0, 11.4, 0); place('Drill_Bit', [0, 0, 0], 0, bit, 1.3); group.add(bit);

  // THE DOME HALLS: the ore buyer and the gear shop, fronts to the lanes.
  for (const [name, k] of [['Ore_Buyer', BASE.kiosks.sell], ['Gear_Workshop', BASE.kiosks.shop]] as const) place(name, k.at, k.yaw, group, k.scale);

  // THE WORLD PORTAL on its dais, and THE TELEPORT STATION.
  const pt = BASE.portal, fl = pt.floor;
  place('Portal_Dais', pt.at, pt.yaw);
  place('Portal_Frame', [pt.at[0], fl, pt.at[2]], pt.yaw);
  const st = BASE.station;
  place('Tech_Station', [st.x, 0, st.z], st.yaw);
  // Round the station, the layers below (their halls' props, colliders and all); by the portal, world 3 ahead. Each
  // in its anchor's frame (x across, +Z toward the spawn), on the ground.
  const decor = (list: typeof BASE.stationDecor, ax: number, ay: number, az: number, yaw: number) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const d of list) {
      const at: [number, number, number] = [ax + d.x * c + d.z * s, ay + (d.y ?? 0), az - d.x * s + d.z * c];
      place(d.prop, at, yaw + d.yaw, group, d.scale);
    }
  };
  decor(BASE.stationDecor, st.x, 0, st.z, st.yaw);
  decor(BASE.portalDecor, pt.at[0], 0, pt.at[2], pt.yaw);

  // THE WEST YARD: a raised deck with a hazard edge and steps, tanks, stacked containers and the beacon mast;
  // a pipe run along its back.
  const pipe = (a: readonly number[], b: readonly number[], radius: number, hex: string) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), length = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(radius, radius, length, 8).toNonIndexed();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); g.computeVertexNormals();
    add(new THREE.Mesh(tessellate(tint(g, hex), 2), M.pipe), 'Base pipe');
  };
  const dk = BASE.deck, dh = dk.height, dcx = (dk.x[0] + dk.x[1]) / 2, dcz = (dk.z[0] + dk.z[1]) / 2, dw = dk.x[1] - dk.x[0], dd = dk.z[1] - dk.z[0];
  cuboid([dcx, dh / 2, dcz], [dw, dh, dd], (y) => new THREE.Color(y > dh - .05 ? '#ddd2bc' : '#eceeef'), M.deck, 'Base deck');
  box([dcx, dh / 2, dcz], [dw / 2, dh / 2, dd / 2]);
  for (let z = dk.z[0] + .4, k = 0; z < dk.z[1] - .4; z += .9, k++) cuboid([dk.x[1] - .15, dh + .04, z + .4], [.3, .06, .82], k % 2 ? '#2a2a2e' : '#f5c02a', M.paint, 'Base deck edge');
  for (const [i, h] of [[0, .33], [1, .66]] as const) {
    cuboid([dk.x[1] + 1.25 - i * .6, h / 2, -10], [1.2 - i * .6 + .6, h, 3.6], '#d8d2c4', M.deck, 'Base deck step');
    box([dk.x[1] + 1.25 - i * .6, h / 2, -10], [(1.8 - i * .6) / 2, h / 2, 1.8]);
  }
  for (const [x, z] of BASE.tanks) {
    const y = inside(x, z, dk.x, dk.z) ? dh : 0;
    place('Storage_Tank', [x, y, z], r() * 6);
  }
  place('Antenna_Mast', BASE.beacon);
  for (const [y, hex] of [[2.2, '#e8782a'], [3.0, '#eceeef']] as const) pipe([-33.2, y, basin.z[0]], [-33.2, y, 14], .3, hex);
  for (let z = basin.z[0] + 2; z < 14; z += 6) { cuboid([-33.2, 1.6, z], [.3, 3.2, .3], '#2c2e33', M.pipe, 'Base pipe support'); }
  // North tanks feed the rig: pipes from each tank toward the tower and a header pipe on two A-frames.
  for (const [x, z] of BASE.tanks.filter(([x, z]) => !inside(x, z, dk.x, dk.z))) pipe([x, 1.2, z + 1.4], [x * .5, 1.2, -F - 1.4], .22, '#e8782a');
  pipe([-13, 6.6, -19.2], [13, 6.6, -19.2], .34, '#eceeef');
  for (const x of [-13, 13]) for (const s of [-1, 1]) pipe([x + s * 1.2, 0, -19.2], [x, 6.6, -19.2], .14, '#2c2e33');
  for (const x of [-13, 13]) box([x, 3.3, -19.2], [1.4, 3.3, .3]);

  // SILO AND CONVEYOR: the tower's ore rides to the silo in the north-east.
  place('Ore_Silo', BASE.silo.at);
  const cv = BASE.conveyor;
  place('Conveyor_Frame', [cv.from, 0, cv.z]);
  const slide = new THREE.Group(), length = cv.to - cv.from; slide.name = `Slide_x_${length * 100}_140`;
  slide.position.set(cv.from, cv.height, cv.z);
  for (let x = .2; x < length; x += .8) place('Conveyor_Cleat', [x, 0, 0], 0, slide);
  for (let x = 1.4; x < length; x += 2.4) place('Conveyor_Ore', [x, 0, (r() - .5) * .3], r() * 6, slide);
  group.add(slide);
  for (const z of BASE.solar.rows) place('Solar_Row', [BASE.solar.x, 0, z]);

  // THE HATCHERY: white concrete, a teal rim, a yellow ring at its centre.
  buildHatchery(BASE.hatchery, BASE.stands, { pad: '#e6e2d8', rim: '#1fb0b8', mark: '#f5c02a' },
    { place: (name, at, yaw) => place(name, at, yaw), paint: (g, hex, name, max) => paint(g, hex, name, M.paint, max) });

  // HABITATS round the plaza, CONTAINERS, THE MECH, LAMPS.
  for (const [x, z, k, yaw] of BASE.domes) place('Habitat_Dome', [x, 0, z], yaw, group, k);
  for (const [x, y, z, yaw, colour] of BASE.containers) place(`Container_${colour}`, [x, y, z], yaw);
  place('Mining_Mech', BASE.mech.at, BASE.mech.yaw);
  for (const [x, z, yaw] of BASE.lamps) place('Lamp_Post', [x, 0, z], yaw);

  // PALMS, CACTI AND CRATES on the sand.
  for (const [x, z, k, yaw] of BASE.palms) place('Palm_Tree', [x, 0, z], yaw, group, k);
  BASE.cacti.forEach(([x, z, k, yaw], i) => place(i % 2 ? 'Cactus_B' : 'Cactus_A', [x, 0, z], yaw, group, k));
  for (const [x, z, yaw, kind] of BASE.crates) place(kind === 'barrel' ? 'Barrel' : kind === 'red' ? 'Crate_Red' : 'Crate_Blue', [x, 0, z], yaw);

  // WIND TURBINES on three of the tall mesas, rotors facing the basin and turning.
  const picks = [tops.reduce((a, b) => (b.z < a.z - 4 || (Math.abs(b.z - a.z) < 4 && b.x < a.x)) ? b : a), tops.reduce((a, b) => (b.z < a.z - 4 || (Math.abs(b.z - a.z) < 4 && b.x > a.x)) ? b : a),
    tops.reduce((a, b) => (b.x < a.x - 4 || (Math.abs(b.x - a.x) < 4 && Math.abs(b.z - 20) < Math.abs(a.z - 20))) ? b : a)];
  for (const [i, t] of picks.entries()) {
    const yaw = Math.atan2(-t.x, 20 - t.z), y = t.top - 1.2;
    place('Wind_Turbine_Tower', [t.x, y, t.z], yaw);
    const rotor = new THREE.Group(); rotor.name = `Spin_z_${55 + i * 9}`;
    rotor.position.set(t.x + Math.sin(yaw) * 1.45, y + 22.6, t.z + Math.cos(yaw) * 1.45); rotor.rotation.y = yaw;
    rotor.rotation.z = i * .7; place('Wind_Turbine_Rotor', [0, 0, 0], 0, rotor); group.add(rotor);
  }
  return { group, solids, lights: [] };
}
