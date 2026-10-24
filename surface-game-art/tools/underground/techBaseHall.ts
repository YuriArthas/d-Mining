// Offline: 第二世界's surface, a compact near-future mining base ("plastic-toy tech") in a basin ringed by layered
// red-rock cliffs. Props from build_tech_base.py, placed from src/game/content/world2/techBase.ts. Local metres round
// the mine shaft (world z 224). Metal panels only on the plaza, the walk, the ring round the shaft and the service
// aprons; red earth and gravel elsewhere; a raised yard with tanks and containers; the ore buyer and the gear
// workshop either side of the walk; the world portal at the plaza's far end. The drill bit, the turbine rotors on
// the cliff tops and the conveyor's cleats move in the game (Spin_* / Slide_* nodes). Baked with the daytime sun,
// so large flat surfaces are subdivided.
import * as THREE from 'three';
import { colour, glow, matte, rockMass, type GetProp, type HallSolid } from './caveKit.ts';
import { rng } from '../terrain/kit.ts';
import { TECH_BASE as BASE } from '../../../src/game/content/world2/techBase.ts';

export const ASSET = BASE.asset;
export const SUN = true;

const SHAFT = 8;

/** Split every triangle until no edge is longer than `max` metres (all attributes interpolated). The sun bake
 *  stores one value per vertex; a big face with only its corners, two of them buried in the plinth it stands on,
 *  would go dark all over instead of just at its foot. */
function tessellate(source: THREE.BufferGeometry, max: number) {
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
  // A box collider given in a prop's own frame (turned by its yaw round its origin).
  const solidAt = (at: readonly number[], yaw: number, local: readonly number[], half: readonly number[], k = 1) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    box([at[0] + (local[0] * c + local[2] * s) * k, at[1] + local[1] * k, at[2] + (-local[0] * s + local[2] * c) * k], half.map(v => v * k), yaw);
  };
  const M = { ground: matte('Base ground'), gravel: matte('Base gravel'), joint: matte('Base joints'), panel: matte('Base panels'), paint: matte('Base paint'),
    rock: matte('Base cliff rock'), deck: matte('Base deck'), pipe: matte('Base pipes'), cyan: glow('Base glow cyan', '#2ad0f0', .9), stripe: matte('Base hazard stripes') };
  const tint = (g: THREE.BufferGeometry, hex: string | ((y: number) => THREE.Color)) => colour(g, typeof hex === 'string' ? () => new THREE.Color(hex) : hex);
  const cuboid = (at: readonly number[], size: readonly number[], hex: string | ((y: number) => THREE.Color), material: THREE.Material, name: string, yaw = 0) => {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed(); g.rotateY(yaw); g.translate(at[0], at[1], at[2]);
    return add(new THREE.Mesh(tessellate(tint(g, hex), 2), material), name);
  };

  const inShaft = (x: number, z: number, m = 0) => Math.abs(x) < SHAFT + m && Math.abs(z) < SHAFT + m;
  const inside = (x: number, z: number, [x0, x1]: readonly number[], [z0, z1]: readonly number[]) => x > x0 && x < x1 && z > z0 && z < z1;
  const { plaza, walk, ring, aprons, basin } = BASE;
  const zone = (x: number, z: number): 'plaza' | 'walk' | 'ring' | 'apron' | null =>
    inside(x, z, plaza.x, plaza.z) ? 'plaza' : Math.abs(x) < walk.halfWidth && z > walk.z[0] - 1 && z < walk.z[1] + 1 ? 'walk'
      : Math.abs(x) < ring.outer && Math.abs(z) < ring.outer && !inShaft(x, z, ring.inner - SHAFT) ? 'ring'
      : aprons.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1) ? 'apron' : null;

  // GROUND: red earth over the basin and under the cliffs, 2 m cells with soft patches (shaft left open).
  const earth = [new THREE.Color('#b9855c'), new THREE.Color('#c99a6c'), new THREE.Color('#a7714c'), new THREE.Color('#d2a97c')];
  const noise = (x: number, z: number) => Math.sin(x * .09 + z * .061) * .5 + Math.sin(x * .23 - z * .17 + 1.3) * .3 + Math.sin(x * .53 + z * .47) * .2;
  const G = { x0: -48, x1: 48, z0: -38, z1: 80 };
  for (const [x0, x1, z0, z1] of [[G.x0, -SHAFT, G.z0, G.z1], [SHAFT, G.x1, G.z0, G.z1], [-SHAFT, SHAFT, G.z0, -SHAFT], [-SHAFT, SHAFT, SHAFT, G.z1]]) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / 2), Math.ceil((z1 - z0) / 2)).rotateX(-Math.PI / 2).toNonIndexed();
    g.translate((x0 + x1) / 2, .015, (z0 + z1) / 2); g.computeVertexNormals();
    const p = g.getAttribute('position');
    colour(g, (_y, i) => {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, n = noise(x, z);
      const c = n > .45 ? earth[3] : n > .05 ? earth[1] : n > -.4 ? earth[0] : earth[2];
      return c.clone().multiplyScalar(.95 + ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1 * .08);
    });
    add(new THREE.Mesh(g, M.ground), 'Base ground');
  }
  // Gravel patches off the paving: low irregular pads of grey-brown grit.
  for (let i = 0; i < 46; i++) {
    const x = basin.x[0] + 2 + r() * (basin.x[1] - basin.x[0] - 4), z = basin.z[0] + 2 + r() * (basin.z[1] - basin.z[0] - 4), radius = 1.4 + r() * 2.4;
    if (zone(x, z) || inShaft(x, z, 2) || inside(x, z, [-15, 15], [12, 66])) continue;
    const pts: THREE.Vector2[] = [];
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = radius * (.7 + r() * .45); pts.push(new THREE.Vector2(x + Math.cos(a) * rr, -(z + Math.sin(a) * rr))); }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: .04, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); g.translate(0, .02, 0); g.computeVertexNormals();
    const c = new THREE.Color(r() < .5 ? '#8f7a68' : '#9d8a76').multiplyScalar(.92 + r() * .14);
    add(new THREE.Mesh(tessellate(tint(g, () => c), 2), M.gravel), 'Base gravel');
  }

  // PAVING: 2 m panels over gunmetal joints, only where people walk. The plaza mixes light and mid panels with a
  // darker band down its middle; the walk, the ring and the aprons are mid grey with a few service plates.
  for (let x = basin.x[0]; x < basin.x[1]; x += 2) for (let z = basin.z[0]; z < basin.z[1]; z += 2) {
    const cx = x + 1, cz = z + 1, where = zone(cx, cz);
    if (!where) continue;
    const joint = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2).toNonIndexed(); joint.translate(cx, .03, cz); joint.computeVertexNormals();
    add(new THREE.Mesh(tint(joint, '#545c68'), M.joint), 'Base joints');
    const base = where === 'plaza' ? (Math.abs(cx) < 3 ? '#8d95a1' : ((Math.floor(cx / 2) + Math.floor(cz / 2)) & 1) ? '#c3c9d1' : '#b2b9c3')
      : where === 'walk' ? '#8d95a1' : where === 'ring' ? '#9aa2ae' : '#a6adb8';
    const c = new THREE.Color(r() < .07 ? '#6f7784' : base).multiplyScalar(.96 + r() * .06), h = .05 + r() * .015;
    const g = new THREE.BoxGeometry(1.9, h, 1.9).toNonIndexed(); g.translate(cx, .035 + h / 2, cz);
    add(new THREE.Mesh(tint(g, (y) => y > .05 ? c : c.clone().multiplyScalar(.8)), M.panel), 'Base panel');
  }
  // Painted lines: yellow edges along the walk and round the ring, dashed centre line; cyan glow at the plaza's ends.
  const line = (x0: number, z0: number, x1: number, z1: number, hex = '#e8b62a', material = M.paint) =>
    cuboid([(x0 + x1) / 2, .1, (z0 + z1) / 2], [Math.max(.16, x1 - x0), .02, Math.max(.16, z1 - z0)], hex, material, 'Base line');
  for (const x of [-walk.halfWidth + .3, walk.halfWidth - .3]) line(x - .08, walk.z[0], x + .08, walk.z[1]);
  for (let z = walk.z[0] + 1; z < walk.z[1]; z += 3) line(-.08, z, .08, z + 1.6, '#e9edf2');
  for (const s of [-1, 1]) { line(-ring.outer + .3, s * (ring.outer - .3) - .08, ring.outer - .3, s * (ring.outer - .3) + .08); line(s * (ring.outer - .3) - .08, -ring.outer + .3, s * (ring.outer - .3) + .08, ring.outer - .3); }
  for (const z of [plaza.z[0] + .3, plaza.z[1] - .3]) line(plaza.x[0] + .4, z - .09, plaza.x[1] - .4, z + .09, '#0a5a6e', M.cyan);
  for (const x of [plaza.x[0] + .3, plaza.x[1] - .3]) line(x - .09, plaza.z[0] + .4, x + .09, plaza.z[1] - .4, '#0a5a6e', M.cyan);
  // The spawn medallion: a navy disc with a cyan ring and four arrow tabs pointing at the shaft, set in the plaza.
  {
    const disc = new THREE.CylinderGeometry(3.4, 3.4, .05, 24).toNonIndexed(); disc.translate(0, .1, 46); disc.computeVertexNormals();
    add(new THREE.Mesh(tessellate(tint(disc, '#24324a'), 1.6), M.paint), 'Base medallion');
    for (let k = 0; k < 24; k++) {
      const a0 = k / 24 * Math.PI * 2, a1 = (k + .7) / 24 * Math.PI * 2, rr = 2.9;
      const g = new THREE.BoxGeometry(rr * (a1 - a0), .03, .18).toNonIndexed(); g.rotateY(-(a0 + a1) / 2 + Math.PI / 2);
      g.translate(Math.cos((a0 + a1) / 2) * rr, .135, 46 + Math.sin((a0 + a1) / 2) * rr); add(new THREE.Mesh(tint(g, '#0a5a6e'), M.cyan), 'Base medallion glow');
    }
    for (const dz of [-1.6, 0, 1.6]) { const g = new THREE.ConeGeometry(.5, .9, 3).rotateX(-Math.PI / 2).toNonIndexed(); g.scale(1, .06, 1); g.translate(0, .14, 46 + dz); g.computeVertexNormals(); add(new THREE.Mesh(tint(g, '#f2c230'), M.paint), 'Base medallion arrow'); }
  }
  // Hazard band round the shaft: yellow and black blocks on the curb between the shaft and the ring walk.
  for (const side of [-1, 1]) for (const axis of ['x', 'z'] as const) for (let d = -SHAFT - .6, k = 0; d < SHAFT + .6; d += .86, k++) {
    const w = Math.min(.86, SHAFT + .6 - d), at = axis === 'x' ? [d + w / 2, .08, side * (SHAFT + .3)] : [side * (SHAFT + .3), .08, d + w / 2];
    const g = new THREE.BoxGeometry(axis === 'x' ? w - .04 : .56, .12, axis === 'x' ? .56 : w - .04).toNonIndexed(); g.translate(at[0], at[1], at[2]);
    add(new THREE.Mesh(tint(g, k % 2 ? '#2a2a2e' : '#f2c230'), M.stripe), 'Base hazard band');
  }

  // CLIFFS: two rows of layered red rock round the basin, the inner lower, the outer tall, so nothing outside shows.
  const strata = ['#b8744e', '#c98a5e', '#a8643f', '#d49a6c', '#bf7d52'];
  const cliffTint = (f: number) => new THREE.Color(strata[Math.floor(f * 9) % strata.length]).multiplyScalar(.88 + f * .14);
  const tops: { x: number; z: number; top: number }[] = [];
  const cliff = (x: number, z: number, radius: number, top: number, outer: boolean) => {
    const m = rockMass(r, x, z, radius, -1, top, [[0, 1], [.35, .97], [.6, .9], [.8, .84], [.92, .76], [1, .7]], cliffTint, 9);
    add(new THREE.Mesh(outer ? m.geometry : tessellate(m.geometry.toNonIndexed(), 7), M.rock), outer ? 'Base cliff outer' : 'Base cliff'); hull(m.points);
    if (outer) tops.push({ x, z, top });
  };
  const perimeter = (offset: number, step: number, each: (x: number, z: number, along: 'x' | 'z') => void) => {
    const [x0, x1] = basin.x, [z0, z1] = basin.z;
    for (let x = x0 - offset; x <= x1 + offset; x += step) { each(x, z0 - offset, 'x'); each(x, z1 + offset, 'x'); }
    for (let z = z0 - offset + step; z < z1 + offset; z += step) { each(x0 - offset, z, 'z'); each(x1 + offset, z, 'z'); }
  };
  perimeter(8.5, 8.5, (x, z) => cliff(x + (r() - .5) * 2, z + (r() - .5) * 2, 7.6 + r() * 1.6, 15 + r() * 9, false));
  perimeter(19, 11, (x, z) => cliff(x + (r() - .5) * 3, z + (r() - .5) * 3, 10 + r() * 3, 27 + r() * 11, true));
  // A few boulders at the cliff feet.
  for (let i = 0; i < 18; i++) {
    const side = Math.floor(r() * 4), t = r();
    const x = side < 2 ? basin.x[0] + 2 + t * (basin.x[1] - basin.x[0] - 4) : side === 2 ? basin.x[0] + 1.5 : basin.x[1] - 1.5;
    const z = side >= 2 ? basin.z[0] + 2 + t * (basin.z[1] - basin.z[0] - 4) : side === 0 ? basin.z[0] + 1.5 : basin.z[1] - 1.5;
    if (zone(x, z)) continue;
    const radius = .8 + r() * 1.4, m = rockMass(r, x, z, radius, -.3, radius * (1.1 + r() * .5), [[0, .9], [.5, 1], [1, .55]], cliffTint, 7);
    add(new THREE.Mesh(m.geometry, M.rock), 'Base boulder'); hull(m.points);
  }

  // DRILL RIG over the shaft, its bit spinning below the housing.
  const L = BASE.rig.legs;
  place('Drill_Rig', [0, 0, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box([sx * L, 7.5, sz * L], [.6, 7.5, .6]); box([sx * L, .55, sz * L], [1, .55, 1]); }
  const bit = new THREE.Group(); bit.name = 'Spin_y_220'; bit.position.set(0, 8.6, 0); place('Drill_Bit', [0, 0, 0], 0, bit); group.add(bit);

  // SERVICE BUILDINGS: the ore buyer (door at local -x) and the gear workshop (door at local +x), fronts to the walk.
  for (const [name, k, door] of [['Ore_Buyer', BASE.kiosks.sell, -1], ['Gear_Workshop', BASE.kiosks.shop, 1]] as const) {
    place(name, k.at, k.yaw, group, k.scale);
    const dx = door * 2.6, wx = -door * 2.8, q = k.scale;
    solidAt(k.at, k.yaw, [0, 3.3, -.6], [5.3, 3.3, 3.4], q);
    solidAt(k.at, k.yaw, [dx, .55, 3.95], [2.6, .55, 1.3], q);
    solidAt(k.at, k.yaw, [dx - door * 3.15, .3, 4.3], [.55, .3, .9], q);
    solidAt(k.at, k.yaw, [wx, .8, 3.4], [1.85, .8, .7], q);
    solidAt(k.at, k.yaw, [dx + door * 2.4, 3.3, 4.75], [.25, 3.3, .25], q);
    if (door < 0) solidAt(k.at, k.yaw, [-6.6, .45, 4.3], [.7, .45, 1.0], q); else solidAt(k.at, k.yaw, [7.1, 1.1, 3.8], [.6, 1.1, 1.3], q);
  }

  const pipe = (a: readonly number[], b: readonly number[], radius: number, hex: string) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), length = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(radius, radius, length, 8).toNonIndexed();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); g.computeVertexNormals();
    add(new THREE.Mesh(tessellate(tint(g, hex), 2), M.pipe), 'Base pipe');
  };
  // THE GANTRY over the walk: two striped posts, a navy truss beam with a cyan underglow and a screen in the middle
  // with a glowing frame and a cyan pickaxe mark.
  {
    const gz = BASE.gantry.z, gx = BASE.gantry.x, gy = BASE.gantry.height;
    for (const sx of [-1, 1]) {
      cuboid([sx * gx, gy / 2, gz], [.9, gy, .9], (y) => new THREE.Color(y < 1.2 ? '#f2c230' : '#3a414c'), M.deck, 'Base gantry post');
      cuboid([sx * gx, .25, gz], [1.6, .5, 1.6], '#3a414c', M.deck, 'Base gantry foot');
      box([sx * gx, gy / 2, gz], [.6, gy / 2, .6]);
    }
    cuboid([0, gy + .55, gz], [2 * gx + 1.2, .8, 1.0], '#24324a', M.deck, 'Base gantry beam');
    cuboid([0, gy - .05, gz + .3], [2 * gx, .08, .14], '#0a5a6e', M.cyan, 'Base gantry glow');
    cuboid([0, gy - .05, gz - .3], [2 * gx, .08, .14], '#0a5a6e', M.cyan, 'Base gantry glow');
    cuboid([0, gy - .1, gz + .15], [7.4, 2.1, .25], '#16283a', M.deck, 'Base gantry screen');
    cuboid([0, gy + .98, gz + .3], [7.6, .12, .12], '#c4520a', M.cyan, 'Base gantry screen glow');
    cuboid([0, gy - 1.2, gz + .3], [7.6, .12, .12], '#c4520a', M.cyan, 'Base gantry screen glow');
    for (const sx of [-1, 1]) pipe([sx * (gx - .3), gy + .2, gz], [sx * 3.6, gy - .9, gz], .12, '#8d95a1');
    cuboid([0, gy + .05, gz + .3], [3.4, .34, .06], '#0e8eb0', M.cyan, 'Base gantry mark');
    cuboid([0, gy - .45, gz + .3], [.3, 1.1, .06], '#0e8eb0', M.cyan, 'Base gantry mark');
  }

  // THE WORLD PORTAL's frame (TeleportStations draws the disc) and THE TELEPORT STATION.
  const pt = BASE.portal;
  place('Portal_Frame', pt.at, pt.yaw);
  for (const sx of [-1, 1]) solidAt(pt.at, pt.yaw, [sx * 2.75, 3.4, 0], [.95, 3.4, .75]);
  const st = BASE.station;
  place('Tech_Station', [st.x, 0, st.z], st.yaw);
  for (const side of [-1, 1]) box([st.x + Math.cos(st.yaw) * 1.9 * side, 2.6, st.z - Math.sin(st.yaw) * 1.9 * side], [.45, 2.6, .45], st.yaw);

  // THE WEST YARD: a raised deck with a hazard edge and steps, tanks, stacked containers and the beacon mast;
  // a pipe run along its back.
  const dk = BASE.deck, dh = dk.height, dcx = (dk.x[0] + dk.x[1]) / 2, dcz = (dk.z[0] + dk.z[1]) / 2, dw = dk.x[1] - dk.x[0], dd = dk.z[1] - dk.z[0];
  cuboid([dcx, dh / 2, dcz], [dw, dh, dd], (y) => new THREE.Color(y > dh - .05 ? '#7d8592' : '#3a414c'), M.deck, 'Base deck');
  box([dcx, dh / 2, dcz], [dw / 2, dh / 2, dd / 2]);
  for (let z = dk.z[0] + .4, k = 0; z < dk.z[1] - .4; z += .9, k++) cuboid([dk.x[1] - .15, dh + .04, z + .4], [.3, .06, .82], k % 2 ? '#2a2a2e' : '#f2c230', M.stripe, 'Base deck edge');
  for (const [i, h] of [[0, .33], [1, .66]] as const) {
    cuboid([dk.x[1] + 1.25 - i * .6, h / 2, -10], [1.2 - i * .6 + .6, h, 3.6], '#8d95a1', M.deck, 'Base deck step');
    box([dk.x[1] + 1.25 - i * .6, h / 2, -10], [(1.8 - i * .6) / 2, h / 2, 1.8]);
  }
  for (const [x, z] of BASE.tanks) {
    const y = inside(x, z, dk.x, dk.z) ? dh : 0;
    place('Storage_Tank', [x, y, z], r() * 6); box([x, y + 2.9, z], [1.6, 2.9, 1.6]);
  }
  place('Antenna_Mast', BASE.beacon); box([BASE.beacon[0], BASE.beacon[1] + .4, BASE.beacon[2]], [1.1, .4, 1.1]); box([BASE.beacon[0], BASE.beacon[1] + 7, BASE.beacon[2]], [.4, 7, .4]);
  for (const [y, hex] of [[2.2, '#e0782a'], [3.0, '#8d95a1']] as const) pipe([-33.2, y, basin.z[0]], [-33.2, y, 14], .3, hex);
  for (let z = basin.z[0] + 2; z < 14; z += 6) { cuboid([-33.2, 1.6, z], [.3, 3.2, .3], '#3a414c', M.pipe, 'Base pipe support'); }
  // North tanks feed the rig: pipes from each tank to the rig's north side and a header pipe on two A-frames.
  for (const [x, z] of BASE.tanks.filter(([x, z]) => !inside(x, z, dk.x, dk.z))) pipe([x, 1.2, z + 1.4], [x * .5, 1.2, -L - 1.2], .22, '#e0782a');
  pipe([-13, 6.6, -19.2], [13, 6.6, -19.2], .34, '#8d95a1');
  for (const x of [-13, 13]) for (const s of [-1, 1]) pipe([x + s * 1.2, 0, -19.2], [x, 6.6, -19.2], .14, '#3a414c');
  for (const x of [-13, 13]) box([x, 3.3, -19.2], [1.4, 3.3, .3]);

  // SILO AND CONVEYOR: the rig's ore rides to the silo in the north-east.
  place('Ore_Silo', BASE.silo.at);
  for (const yaw of [0, Math.PI / 4]) box([BASE.silo.at[0], 7.5, BASE.silo.at[2]], [3.2, 7.5, 3.2], yaw);
  const cv = BASE.conveyor;
  place('Conveyor_Frame', [cv.from, 0, cv.z]);
  for (const x of [8, 13.5]) box([cv.from + x, 1.4, cv.z], [.25, 1.4, .75]);
  const slide = new THREE.Group(), length = cv.to - cv.from; slide.name = `Slide_x_${length * 100}_140`;
  slide.position.set(cv.from, cv.height, cv.z);
  for (let x = .2; x < length; x += .8) place('Conveyor_Cleat', [x, 0, 0], 0, slide);
  for (let x = 1.4; x < length; x += 2.4) place('Conveyor_Ore', [x, 0, (r() - .5) * .3], r() * 6, slide);
  group.add(slide);
  for (const z of BASE.solar.rows) { place('Solar_Row', [BASE.solar.x, 0, z]); box([BASE.solar.x, 1.1, z], [6.1, 1.1, 1.1]); }

  // PLAZA SIDES: planters of ore crystals (chunky boxes with an orange band) and benches.
  for (const [x, z, kind] of BASE.plazaDecor) {
    if (kind === 'planter') {
      cuboid([x, .45, z], [1.8, .9, 3.6], (y) => new THREE.Color(y > .8 ? '#8d95a1' : y > .35 ? '#c9ced6' : '#e0782a'), M.deck, 'Base planter');
      cuboid([x, .92, z], [1.5, .06, 3.3], '#6a5a4c', M.gravel, 'Base planter soil');
      for (const dz of [-1.1, 0, 1.1]) place('Conveyor_Ore', [x + (r() - .5) * .4, .9, z + dz], r() * 6);
      box([x, .5, z], [.9, .5, 1.8]);
    } else {
      cuboid([x, .45, z], [.7, .14, 2.6], '#3a414c', M.deck, 'Base bench');
      cuboid([x + Math.sign(x) * .3, .8, z], [.12, .6, 2.6], '#2a9a9a', M.deck, 'Base bench back');
      for (const dz of [-1.1, 1.1]) cuboid([x, .2, z + dz], [.5, .4, .14], '#3a414c', M.deck, 'Base bench leg');
      box([x, .45, z], [.4, .45, 1.3]);
    }
  }

  // HABITATS round the plaza, CONTAINERS, THE MECH, LAMPS AND BOLLARDS.
  place('Habitat_Dome', BASE.dome.at, Math.PI / 2);
  for (const yaw of [0, Math.PI / 4]) box([BASE.dome.at[0], 3.6, BASE.dome.at[2]], [6.1, 3.6, 6.1], yaw);
  place('Habitat_Module', BASE.module.at, BASE.module.yaw);
  box([BASE.module.at[0], 2.1, BASE.module.at[2]], [4.3, 2.1, 2.2], BASE.module.yaw + Math.PI / 2);
  for (const [x, y, z, yaw, paint] of BASE.containers) { place(`Container_${paint}`, [x, y, z], yaw); box([x, y + 1.25, z], [3, 1.25, 1.25], yaw); }
  place('Mining_Mech', BASE.mech.at, BASE.mech.yaw);
  solidAt(BASE.mech.at, BASE.mech.yaw, [0, 2.5, .3], [1.9, 2.5, 1.5]);
  for (const [x, z, yaw] of BASE.lamps) { place('Lamp_Post', [x, 0, z], yaw); box([x, 2.5, z], [.3, 2.5, .3]); }
  for (const [x, z] of BASE.bollards) { place('Bollard', [x, 0, z], 0); box([x, .55, z], [.28, .55, .28]); }

  // WIND TURBINES on three of the tall cliffs, rotors facing the basin and turning.
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
