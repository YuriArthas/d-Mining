// Offline: 水晶精炼厂 (world 2, layer 3) on the world 2 base kit (techKit.ts) and the shared cave shell (caveKit.ts),
// with props from build_refinery.py. Deep indigo rock where the colony harvests giant magenta crystals: a giant
// crystal in a yellow cradle in each north corner, cut by a white laser rig's beam; white-framed crystal tanks on
// the west wall and in the south-east (where a shop would stand); crystal clusters growing out of the rock (one ray
// each, turned to the rock face) and along the wall feet; violet veins in the rock. The hero on the north wall: three
// refining columns on a deck in the shared facade above the name board, a crystal core turning in each. Glow is
// faked for phones: additive halos round the crystals, tanks, columns and beams, no post-processing. Props bring
// their colliders (build_refinery.py).
import * as THREE from 'three';
import { caveKit, glow, type GetProp } from './caveKit.ts';
import { techKit, glowBall, softFrame, glowGrid } from './techKit.ts';
import { REFINERY_HALL as HALL } from '../../../src/game/content/underground/refineryHall.ts';

const MAGENTA = '#d050e8', VIOLET = '#a860f0';

export function buildHall(getProp: GetProp) {
  const L = HALL.layout;
  const kit = caveKit(HALL, 1230001, {
    rock: ['#2a2440', '#3e3660'], upper: ['#342c50', '#1e1830'], ceiling: ['#1a1528', '#272040'],
    stalactite: ['#2c2644', '#4c3e70'], joint: '#1e1e22', stones: ['#5a5c62'], curb: '#f2c230',
  }, [
    ...L.giants.map(g => ({ x: g.at[0], z: g.at[1], radius: 3.4 })),
    ...L.rigs.map(([x, z]) => ({ x, z, radius: 1.6 })),
    ...L.tanks.map(([x, z]) => ({ x, z, radius: 1.6 })),
  ]);
  const { r, add, place, M, PIT } = kit;
  kit.useProps(getProp);
  const tech = techKit(kit, L.pools);
  const tip = glow('Cave glow crystal', '#a01ca0', 1.1), vein = Object.assign(glow('Cave glow vein', '#7a28c8', 1.0), { side: THREE.DoubleSide });
  const beam = glow('Cave glow beam', '#c020b0', 1.4);

  // Rock everywhere but the facade's stretch of the north wall and the ceiling over the columns.
  const { facade } = L;
  kit.walls((x, z, radius) => z < -13 && Math.abs(x) - radius * .8 < facade.half - 1.5);
  kit.ceiling(40, [tip], .2, (x, z) => z < -10.5 && Math.abs(x) < facade.half + 1);

  // THE BASE (techKit): floor, lanes, rail, lamps, services and their glow. Arrows point to the sale and along.
  tech.base({ hall: HALL, lanterns: L.lanterns, lamps: L.lamps, loop: L.loop, accent: MAGENTA,
    arrows: [[-6, 14.2, Math.PI / 2], [-14.6, 0, 0], [14.6, 0, 0], [0, -14.6, 0]] });

  // THE REFINERY in the facade: the deck above the name board, three columns on it, each with a core turning in a
  // tube of soft light; a magenta halo on the wall behind, a white lane and a hazard band up to it, its light on
  // the floor.
  tech.lane([[0, -L.loop.half], [0, -17.6]], 2.2, '#e8e6e0', tech.laneMaterial);
  tech.hazard([-7.6, -17.9], [7.6, -17.9], .7, tech.paintMaterial);
  place('Refinery_Facade', [0, 0, facade.z], 0);
  place('Refinery_Deck', [0, 0, facade.z], 0);
  const deck = 8.4, cz = facade.z + 1.6;
  for (const c of L.columns) {
    const glass = c.tall ? 7.0 : 5.4;
    place(c.tall ? 'Refinery_Column_Tall' : 'Refinery_Column_Short', [c.x, deck, cz], 0);
    const core = new THREE.Group(); core.name = `Spin_y_${c.spin < 0 ? 'n' : ''}${Math.abs(c.spin)}`;
    core.position.set(c.x, deck + 1.05 + (glass - 3.4) / 2, cz); core.add(getProp('Refinery_Core')); kit.group.add(core);
    const tube = new THREE.CylinderGeometry(1.12, 1.12, glass, 12, 1, true).toNonIndexed(); tube.translate(c.x, deck + 1.05 + glass / 2, cz); tube.computeVertexNormals();
    const tint = new THREE.Color(MAGENTA).multiplyScalar(.3), colours = new Float32Array(tube.getAttribute('position').count * 3);
    for (let k = 0; k < colours.length; k += 3) tint.toArray(colours, k);
    tube.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    tech.glow(tube, 'Glow halo tube');
    tech.glow(glowBall(2.2, MAGENTA, .3).translate(c.x, deck + 1.05 + glass / 2, cz), 'Glow halo core');
  }
  tech.glow(softFrame(0, 0, 0, 7.5, '#b030d0', .4, 6, 8).scale(1.25, 1, 1).translate(0, 13.2, facade.z + .36), 'Glow halo wall');
  tech.glow(glowGrid(9, 9.6, 6, 12, MAGENTA, (u, v) => .34 * Math.sin(Math.PI * u) ** 1.4 * v ** 1.8).rotateX(-Math.PI / 2).translate(0, .075, -13.2), 'Glow halo floor');

  // GIANT CRYSTALS in the north corners, each with a big halo; a LASER RIG beams at each from the side wall: a thin
  // glowing beam inside a soft halo tube, a burst of light where it strikes.
  L.giants.forEach((g, i) => {
    const [x, z] = g.at;
    place('Crystal_Giant', [x, 0, z], g.yaw, g.scale);
    tech.glow(glowBall(5.2 * g.scale, MAGENTA, .26).translate(x, 4.6 * g.scale, z), 'Glow halo crystal');
    const [rx, rz] = L.rigs[i], yaw = Math.atan2(x - rx, z - rz);
    place('Laser_Rig', [rx, 0, rz], yaw);
    const from = new THREE.Vector3(rx + 2.82 * Math.sin(yaw), 4.1, rz + 2.82 * Math.cos(yaw));
    const centre = new THREE.Vector3(x, 4.4 * g.scale, z), to = centre.clone().add(from.clone().sub(centre).setY(0).normalize().multiplyScalar(1.3 * g.scale));
    const dir = to.clone().sub(from), length = dir.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const tube = (radius: number) => { const t = new THREE.CylinderGeometry(radius, radius, length, 8, 1, true).toNonIndexed(); t.applyQuaternion(q); t.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2); t.computeVertexNormals(); return t; };
    add(new THREE.Mesh(tube(.07), beam), 'Cave laser beam');
    const halo = tube(.42), c = new THREE.Color('#e040e0').multiplyScalar(.32), colours = new Float32Array(halo.getAttribute('position').count * 3);
    for (let k = 0; k < colours.length; k += 3) c.toArray(colours, k);
    halo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    tech.glow(halo, 'Glow halo beam');
    tech.glow(glowBall(1.4, '#ff60f0', .5).translate(to.x, to.y, to.z), 'Glow halo spark');
    tech.glow(glowBall(.6, '#ff60f0', .45).translate(from.x, from.y, from.z), 'Glow halo lens');
  });

  // CRYSTAL TANKS with a halo round the crystal inside; CARTS of crystal chunks.
  for (const [x, z, yaw] of L.tanks) {
    place('Crystal_Tank', [x, 0, z], yaw);
    tech.glow(glowBall(1.7, VIOLET, .32).translate(x, 1.9, z), 'Glow halo tank');
  }
  for (const [x, z, yaw] of L.carts) place('Crystal_Cart', [x, 0, z], yaw);

  // CRYSTALS IN THE ROCK: clusters where rays from the floor ring meet the rock, turned out of the rock face, each
  // with a soft halo. Never over the name board.
  const rocks: THREE.Mesh[] = []; kit.group.updateMatrixWorld(true);
  kit.group.traverse(o => { if (o instanceof THREE.Mesh && o.material === M.rock) rocks.push(o); });
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0, made = 0; i < 90 && made < 14; i++) {
    const side = Math.floor(r() * 4), d = (r() - .5) * 34, y = 3.2 + r() * 5.6;
    if (side === 0 && Math.abs(d) < facade.half + 2) continue;
    const dir = new THREE.Vector3(...([[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][side] as [number, number, number]));
    ray.set((side < 2 ? new THREE.Vector3(d, y, 0) : new THREE.Vector3(0, y, d)).addScaledVector(dir, PIT + 1), dir); ray.far = 16;
    const hit = ray.intersectObjects(rocks, false)[0];
    if (!hit || !hit.face) continue;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    // Only faces that look out or up: under an overhang the crystals would hang off the rock.
    if (n.y < -.25) continue;
    made++;
    const out = n.clone().multiplyScalar(.75).add(up.clone().multiplyScalar(.45)).normalize();
    const p = place(r() < .7 ? 'Crystal_Cluster' : 'Crystal_Small', [0, 0, 0], 0, 1.1 + r() * 1.1);
    p.position.copy(hit.point).addScaledVector(n, -.15);
    p.quaternion.setFromUnitVectors(up, out).multiply(new THREE.Quaternion().setFromAxisAngle(up, r() * 6.3));
    tech.glow(glowBall(1.9 * p.scale.x, r() < .5 ? MAGENTA : VIOLET, .2).translate(...hit.point.clone().addScaledVector(out, 1.2 * p.scale.x).toArray()), 'Glow halo crystal');
  }

  // VIOLET VEINS in the rock, and crystals and crates along the wall feet.
  tech.seams(10, vein, '#a040f0', (side, d) => side === 0 && Math.abs(d) < facade.half + 2, 'Cave crystal vein');
  kit.wallFoot(16, () => {
    const roll = r();
    return roll < .45 ? { name: 'Crystal_Cluster', scale: () => .7 + r() * .6 }
      : roll < .75 ? { name: 'Crystal_Small', scale: () => .9 + r() * .8 }
      : { name: 'Crate_Stack', scale: () => .8 + r() * .3 };
  });
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
