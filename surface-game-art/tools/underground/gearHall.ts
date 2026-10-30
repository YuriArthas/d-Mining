// Offline: 巨齿工厂 (world 2, layer 2) on world 2's base kit (techKit.ts) and the shared cave shell (caveKit.ts), with
// props from build_gear.py. Dark slate rock with teal power conduits climbing it; a huge half-buried machine fills
// the north wall above the name board: bronze-and-teal gears turning slowly in a slate frame, a teal power core
// either side, the colony's white catwalk with a yellow rail across it, and a yellow jib crane on each side hanging
// a hazard crate over the floor. Glow is faked for phones: additive halos and floor streaks.
// Moving parts are direct children named Spin_* (SceneMotion.ts). Props bring their colliders (build_gear.py).
import * as THREE from 'three';
import { caveKit, glow, type GetProp } from './caveKit.ts';
import { techKit, softFrame, glowGrid } from './techKit.ts';
import { GEAR_HALL as HALL } from '../../../src/game/content/underground/gearHall.ts';

const TEAL = '#2ee0d0';
const GEAR_PROP: Readonly<Record<number, string>> = { 20: 'Gear_Large', 16: 'Gear_Medium', 10: 'Gear_Small' };

export function buildHall(getProp: GetProp) {
  const L = HALL.layout, { facade, catwalk } = L;
  const kit = caveKit(HALL, 820001, {
    rock: ['#262c34', '#3a424c'], upper: ['#323a44', '#1c2128'], ceiling: ['#181c22', '#262c34'],
    stalactite: ['#2a3038', '#46505c'], joint: '#1c1e22', stones: ['#5a5c62'], curb: '#f2c230',
  }, L.cranes.map(c => ({ x: c.at[0], z: c.at[1], radius: 2.2 })));
  const { r, place } = kit;
  kit.useProps(getProp);
  const tech = techKit(kit, L.pools);
  const conduit = Object.assign(glow('Cave glow teal', '#14a0a0', 1.0), { side: THREE.DoubleSide });

  // Rock everywhere but the machine frame's stretch of the north wall and the ceiling over it.
  kit.walls((x, z, radius) => z < -13 && Math.abs(x) - radius * .8 < facade.half - 1.5);
  kit.ceiling(34, [conduit], .14, (x, z) => z < -10.5 && Math.abs(x) < facade.half + 1);

  // THE BASE (techKit); a white lane and a hazard band lead to the machine.
  tech.base({ hall: HALL, lanterns: L.lanterns, lamps: L.lamps, loop: L.loop, accent: TEAL,
    arrows: [[-6, 14.2, Math.PI / 2], [6, 14.2, -Math.PI / 2], [0, -14.0, 0], [-14.6, 0, 0], [14.6, 0, 0]] });
  tech.lane([[0, -L.loop.half], [0, -17.4]], 2.2, '#e8e6e0', tech.laneMaterial);
  tech.hazard([-9.6, -17.9], [9.6, -17.9], .7, tech.paintMaterial);

  // MACHINE FRAME on the north wall with its GEARS: each a teal socket ring in the frame and the gear turning in
  // front of it, a halo round the socket on the slate and one over the glowing ring.
  place('Machine_Frame', [0, 0, facade.z], 0);
  for (const g of L.gears) {
    place('Gear_Socket', [g.at[0], g.at[1], facade.z + .42], 0, g.radius * 1.02);
    const spin = new THREE.Group(); spin.name = `Spin_z_${g.rate < 0 ? 'n' : ''}${Math.abs(g.rate)}`; spin.position.set(...g.at);
    spin.add(getProp(GEAR_PROP[g.teeth])); kit.group.add(spin);
    tech.glow(softFrame(0, 0, g.radius * 1.1, g.radius * 1.1 + 2.2, TEAL, .26, 4, 8).translate(g.at[0], g.at[1], facade.z + .34), 'Glow halo socket');
    tech.glow(softFrame(0, 0, g.radius * .61, g.radius * .61 + .9, TEAL, .3, 3, 8).translate(g.at[0], g.at[1], g.at[2] + .32), 'Glow halo gear');
  }
  tech.glow(glowGrid(16, 8, 8, 10, TEAL, (u, v) => .3 * Math.sin(Math.PI * u) ** 1.2 * v ** 1.8).rotateX(-Math.PI / 2).translate(0, .075, -14.2), 'Glow halo floor');

  // POWER CORES either side of the gears: a halo up each column and its light on the floor.
  for (const [x, z] of L.cores) {
    place('Power_Core', [x, 0, z], 0);
    tech.glow(glowGrid(3.2, 13, 4, 10, TEAL, (u, v) => .34 * Math.sin(Math.PI * u) ** 1.5 * Math.sin(Math.PI * v) ** .6).translate(x, 7.6, z + 1.05), 'Glow halo core');
    tech.glow(glowGrid(3.6, 3.4, 4, 6, TEAL, (u, v) => .28 * Math.sin(Math.PI * u) * v ** 1.6).rotateX(-Math.PI / 2).translate(x, .075, z + 3.0), 'Glow halo floor');
  }

  // CATWALK across the frame above the board, on yellow legs.
  place('Catwalk', [0, catwalk.y, catwalk.z], 0);
  for (const x of [-catwalk.half + .2, -6.5, 6.5, catwalk.half - .2]) place('Catwalk_Leg', [x, 0, catwalk.z + .5], 0).scale.set(1, catwalk.y - .46, 1);

  // JIB CRANES on either side, each hanging a hazard crate over the floor ring.
  for (const c of L.cranes) {
    place('Crane', [c.at[0], 0, c.at[1]], c.dir > 0 ? 0 : Math.PI);
    tech.glow(softFrame(0, 0, 0, .9, '#ffd8a0', .3, 3).rotateY(c.dir > 0 ? Math.PI / 2 : -Math.PI / 2).translate(c.at[0] + c.dir * .86, 12.3, c.at[1] + .2), 'Glow halo cab');
  }

  // TEAL POWER CONDUITS climbing the rock, never on the frame.
  tech.seams(12, conduit, TEAL, (side, d) => side === 0 && Math.abs(d) < facade.half + 2, 'Cave power conduit');

  kit.wallFoot(12, () => ({ name: 'Crate_Stack', scale: () => .8 + r() * .3 }));
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
