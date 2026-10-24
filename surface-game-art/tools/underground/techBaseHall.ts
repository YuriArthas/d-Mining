// Offline: 第二世界's surface, a near-future mining base on a dusty red plateau ("plastic-toy tech"). Props from
// build_tech_base.py, placed from src/game/content/world2/techBase.ts. Local metres round the mine shaft (world z
// 224). Panelled metal plaza, ring path and walk south over gunmetal joints; hazard bands round the shaft; layered
// mesas along the strip's sides; the drill rig's bit, the turbine rotors and the conveyor's cleats move in the game
// (Spin_* / Slide_* nodes). Baked with the daytime sun, so large flat surfaces are subdivided.
import * as THREE from 'three';
import { colour, glow, matte, rockMass, type GetProp, type HallSolid } from './caveKit.ts';
import { rng } from '../terrain/kit.ts';
import { TECH_BASE as BASE } from '../../../src/game/content/world2/techBase.ts';

export const ASSET = BASE.asset;
export const SUN = true;

const X0 = -103, X1 = 103, Z0 = -155, Z1 = 69, SHAFT = 8;

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
  const solids: HallSolid[] = [], r = rng(220001);
  const box = (at: readonly number[], half: readonly number[], yaw = 0) => solids.push({ at: [...at], half: [...half], yaw });
  const hull = (points: THREE.Vector3[]) => {
    const b = new THREE.Box3().setFromPoints(points), c = b.getCenter(new THREE.Vector3()), h = b.getSize(new THREE.Vector3()).multiplyScalar(.5);
    solids.push({ at: c.toArray(), half: h.toArray(), yaw: 0, hull: points.flatMap(p => [p.x - c.x, p.y - c.y, p.z - c.z].map(v => +v.toFixed(4))) });
  };
  const add = (mesh: THREE.Mesh, name: string) => { mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
  const fine = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const place = (name: string, at: readonly number[], yaw = 0, parent: THREE.Object3D = group) => {
    const p = getProp(name); p.position.set(at[0], at[1], at[2]); p.rotation.y = yaw; parent.add(p);
    p.traverse(o => { if (o instanceof THREE.Mesh) { let g = fine.get(o.geometry); if (!g) { g = tessellate(o.geometry, 1.8); fine.set(o.geometry, g); } o.geometry = g; } });
    return p;
  };
  // A rotated box collider in local frame (dx, dz from the prop's origin turned by yaw).
  const solidAt = (at: readonly number[], yaw: number, local: readonly number[], half: readonly number[]) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    box([at[0] + local[0] * c + local[2] * s, local[1], at[2] - local[0] * s + local[2] * c], half, yaw);
  };
  const M = { ground: matte('Base ground'), joint: matte('Base joints'), panel: matte('Base panels'), rock: matte('Base mesa rock'),
    cyan: glow('Base glow cyan', '#2ad0f0', .9), stripe: matte('Base hazard stripes') };

  const inShaft = (x: number, z: number, m = 0) => Math.abs(x) < SHAFT + m && Math.abs(z) < SHAFT + m;
  const paved = (x: number, z: number) => {
    const { plaza, ring, southWalk } = BASE;
    return (x > plaza.x[0] && x < plaza.x[1] && z > plaza.z[0] && z < plaza.z[1])
      || (Math.abs(x) < ring.outer && Math.abs(z) < ring.outer && !inShaft(x, z, ring.inner - SHAFT))
      || (Math.abs(x) < southWalk.halfWidth && z < 0 && z > southWalk.to)
      || (Math.abs(x) < southWalk.halfWidth && z > 0 && z < plaza.z[0] + 1);
  };

  // GROUND: the plateau, 3 m cells with soft patches of darker and paler earth (shaft left open).
  const earth = [new THREE.Color('#b9855c'), new THREE.Color('#c99a6c'), new THREE.Color('#a7714c'), new THREE.Color('#d2a97c')];
  const noise = (x: number, z: number) => Math.sin(x * .061 + z * .043) * .5 + Math.sin(x * .17 - z * .11 + 1.3) * .3 + Math.sin(x * .41 + z * .37) * .2;
  for (const [x0, x1, z0, z1] of [[X0, -SHAFT, Z0, Z1], [SHAFT, X1, Z0, Z1], [-SHAFT, SHAFT, Z0, -SHAFT], [-SHAFT, SHAFT, SHAFT, Z1]]) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / 3), Math.ceil((z1 - z0) / 3)).rotateX(-Math.PI / 2).toNonIndexed();
    g.translate((x0 + x1) / 2, .015, (z0 + z1) / 2); g.computeVertexNormals();
    const p = g.getAttribute('position');
    colour(g, (_y, i) => {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, n = noise(x, z);
      const c = n > .45 ? earth[3] : n > .05 ? earth[1] : n > -.4 ? earth[0] : earth[2];
      return c.clone().multiplyScalar(.95 + ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1 * .08);
    });
    add(new THREE.Mesh(g, M.ground), 'Base ground');
  }

  // PAVING: gunmetal joints under 2 m panels (light on the plaza, mid grey on the ring and the walks), raised
  // a few centimetres, a few darker service plates; cyan guide strips set in the plaza and down the walk.
  const panelTint = (x: number, z: number) => {
    const plaza = z > BASE.plaza.z[0];
    const base = plaza ? (((Math.floor(x / 2) + Math.floor(z / 2)) & 1) ? '#c9ced6' : '#bcc2cb') : '#9aa2ae';
    return new THREE.Color(r() < .06 ? '#7d8592' : base).multiplyScalar(.96 + r() * .06);
  };
  for (let x = X0; x < X1; x += 2) for (let z = Z0; z < Z1; z += 2) {
    const cx = x + 1, cz = z + 1;
    if (!paved(cx, cz)) continue;
    const joint = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2).toNonIndexed(); joint.translate(cx, .03, cz); joint.computeVertexNormals();
    add(new THREE.Mesh(colour(joint, () => new THREE.Color('#5a626f')), M.joint), 'Base joints');
    const h = .05 + r() * .015, g = new THREE.BoxGeometry(1.9, h, 1.9).toNonIndexed(); g.translate(cx, .035 + h / 2, cz);
    const c = panelTint(cx, cz);
    add(new THREE.Mesh(colour(g, (y) => y > .05 ? c : c.clone().multiplyScalar(.8)), M.panel), 'Base panel');
  }
  const strip = (x0: number, z0: number, x1: number, z1: number, name = 'Base glow strip') => {
    const g = new THREE.BoxGeometry(Math.max(.18, x1 - x0), .03, Math.max(.18, z1 - z0)).toNonIndexed(); g.translate((x0 + x1) / 2, .1, (z0 + z1) / 2);
    add(new THREE.Mesh(colour(g, () => new THREE.Color('#0a5a6e')), M.cyan), name);
  };
  for (const x of [-5, 5]) strip(x - .09, 18, x + .09, 64);
  strip(-30, 23.9, 30, 24.1); strip(-30, 63.9, 30, 64.1);
  for (let z = -20; z > BASE.southWalk.to; z -= 4) strip(-.09, z - 2, .09, z);
  // Hazard band round the shaft: yellow and black blocks on the curb between the shaft and the ring path.
  for (const side of [-1, 1]) for (const axis of ['x', 'z'] as const) for (let d = -SHAFT - .6, k = 0; d < SHAFT + .6; d += .86, k++) {
    const w = Math.min(.86, SHAFT + .6 - d), at = axis === 'x' ? [d + w / 2, .08, side * (SHAFT + .3)] : [side * (SHAFT + .3), .08, d + w / 2];
    const g = new THREE.BoxGeometry(axis === 'x' ? w - .04 : .56, .12, axis === 'x' ? .56 : w - .04).toNonIndexed(); g.translate(at[0], at[1], at[2]);
    add(new THREE.Mesh(colour(g, () => new THREE.Color(k % 2 ? '#2a2a2e' : '#f2c230')), M.stripe), 'Base hazard band');
  }

  // MESAS along the strip's sides (and a few boulders): layered red rock, flat-topped.
  const strata = ['#b8744e', '#c98a5e', '#a8643f', '#d49a6c', '#bf7d52'];
  const mesaTint = (f: number) => new THREE.Color(strata[Math.floor(f * 7) % strata.length]).multiplyScalar(.9 + f * .12);
  for (const side of [-1, 1]) for (let z = Z0 + 6; z < Z1 - 4; z += 17 + r() * 8) {
    const radius = 9 + r() * 6, x = side * (90 + r() * 8), top = 10 + r() * 16;
    const m = rockMass(r, x, z, radius, -1, top, [[0, 1], [.6, .96], [.82, .86], [.9, .78], [1, .74]], mesaTint, 9);
    add(new THREE.Mesh(m.geometry, M.rock), 'Base mesa'); hull(m.points);
  }
  for (let i = 0; i < 26; i++) {
    const x = (r() - .5) * 170, z = Z0 + 8 + r() * (Z1 - Z0 - 16);
    if (paved(x, z) || Math.abs(x) < 24 && z > -20 || Math.abs(x) > 80) continue;
    const radius = .8 + r() * 1.6, top = radius * (1 + r() * .6);
    const m = rockMass(r, x, z, radius, -.3, top, [[0, .9], [.5, 1], [1, .55]], mesaTint, 7);
    add(new THREE.Mesh(m.geometry, M.rock), 'Base boulder'); if (top > 1) hull(m.points);
  }

  // DRILL RIG over the shaft, its bit spinning below the housing.
  const L = BASE.rig.legs;
  place('Drill_Rig', [0, 0, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box([sx * L, 7.5, sz * L], [.6, 7.5, .6]); box([sx * L, .55, sz * L], [1, .55, 1]); }
  const bit = new THREE.Group(); bit.name = 'Spin_y_220'; bit.position.set(0, 8.6, 0); place('Drill_Bit', [0, 0, 0], 0, bit); group.add(bit);

  // SERVICE KIOSKS behind their rings.
  for (const [name, k] of [['Kiosk_Sell', BASE.kiosks.sell], ['Kiosk_Shop', BASE.kiosks.shop]] as const) {
    place(name, k.at);
    box([k.at[0], 2.0, k.at[2] - 1.05], [2.95, 2.0, 1.2]);
    box([k.at[0], .8, k.at[2] + .95], [2.6, .8, .55]);
    for (const sx of [-1, 1]) box([k.at[0] + sx * 2.9, 2.0, k.at[2] + 1.95], [.22, 2.0, .22]);
  }

  // TELEPORT STATION (TeleportStations draws the portal disc between its pillars).
  const st = BASE.station;
  place('Tech_Station', [st.x, 0, st.z], st.yaw);
  for (const side of [-1, 1]) box([st.x + Math.cos(st.yaw) * 1.9 * side, 2.6, st.z - Math.sin(st.yaw) * 1.9 * side], [.45, 2.6, .45], st.yaw);

  // WIND TURBINES, rotors facing the base and turning.
  for (const [i, [x, z, yaw]] of BASE.turbines.entries()) {
    place('Wind_Turbine_Tower', [x, 0, z], yaw);
    const rotor = new THREE.Group(); rotor.name = `Spin_z_${55 + i * 9}`;
    rotor.position.set(x + Math.sin(yaw) * 1.45, 22.6, z + Math.cos(yaw) * 1.45); rotor.rotation.y = yaw;
    rotor.rotation.z = i * .7; place('Wind_Turbine_Rotor', [0, 0, 0], 0, rotor); group.add(rotor);
    box([x, .5, z], [1.6, .5, 1.6]); box([x, 11.5, z], [.8, 11, .8]);
  }

  // SOLAR ROWS, HABITATS, SILO AND CONVEYOR.
  for (const z of BASE.solar.rows) { place('Solar_Row', [BASE.solar.x, 0, z]); box([BASE.solar.x, 1.1, z], [6.1, 1.1, 1.1]); }
  place('Habitat_Dome', BASE.dome.at, -Math.PI / 2);
  for (const yaw of [0, Math.PI / 4]) box([BASE.dome.at[0], 3.6, BASE.dome.at[2]], [6.1, 3.6, 6.1], yaw);
  place('Habitat_Module', BASE.module.at, BASE.module.yaw);
  box([BASE.module.at[0], 2.1, BASE.module.at[2]], [4.3, 2.1, 2.2], BASE.module.yaw);
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

  // CONTAINERS, THE MECH, THE MAST, LAMPS AND BOLLARDS.
  for (const [x, y, z, yaw, paint] of BASE.containers) { place(`Container_${paint}`, [x, y, z], yaw); box([x, y + 1.25, z], [3, 1.25, 1.25], yaw); }
  place('Mining_Mech', BASE.mech.at, BASE.mech.yaw);
  solidAt(BASE.mech.at, BASE.mech.yaw, [0, 2.5, .3], [1.9, 2.5, 1.5]);
  place('Antenna_Mast', BASE.antenna); box([BASE.antenna[0], .4, BASE.antenna[2]], [1.1, .4, 1.1]); box([BASE.antenna[0], 7, BASE.antenna[2]], [.4, 7, .4]);
  for (const [x, z, yaw] of BASE.lamps) { place('Lamp_Post', [x, 0, z], yaw); box([x, 2.5, z], [.3, 2.5, .3]); }
  for (const [x, z] of BASE.bollards) { place('Bollard', [x, 0, z], 0); box([x, .55, z], [.28, .55, .28]); }
  return { group, solids, lights: [] };
}
