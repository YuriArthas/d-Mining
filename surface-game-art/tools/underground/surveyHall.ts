// Offline: 遗迹勘探站 (world 2, layer 4) — the world 2 base kit (techKit.ts) on the shared cave shell (caveKit.ts),
// with props from build_survey.py. Warm brown rock with gold veins; an ancient temple front on the north wall with
// a round glyph door above the name board, its golden glyph turning slowly; seated statues in the north corners,
// sandstone pillars (one broken) along the sides, the colony's white survey scaffolds and yellow lamp towers
// between them, rubble and crates at the wall feet. Glow is faked for phones: additive halos and floor streaks.
// Moving parts are direct children named Spin_* (SceneMotion.ts).
import * as THREE from 'three';
import { caveKit, glow, type GetProp } from './caveKit.ts';
import { techKit, softFrame, glowGrid, glowBall } from './techKit.ts';
import { SURVEY_HALL as HALL } from '../../../src/game/content/underground/surveyHall.ts';

type Spot = readonly [number, number, number];
/** A point offset (dx, dz) in a prop's own frame (front +Z), turned by its yaw, from its placement. */
const local = ([x, z, yaw]: Spot, dx: number, dz: number): [number, number] => [x + dx * Math.cos(yaw) + dz * Math.sin(yaw), z - dx * Math.sin(yaw) + dz * Math.cos(yaw)];

export function buildHall(getProp: GetProp) {
  const L = HALL.layout, { facade, door } = L;
  const kit = caveKit(HALL, 1640001, {
    rock: ['#4a3324', '#6a4a32'], upper: ['#563c2a', '#2e2018'], ceiling: ['#2a1e16', '#3a2a1e'],
    stalactite: ['#4a3424', '#6a4c34'], joint: '#1e1e22', stones: ['#5a5c62'], curb: '#f2c230',
  }, [
    ...L.statues.map(([x, z]) => ({ x, z, radius: 2.6 })),
    ...[...L.pillars, ...L.broken].map(([x, z]) => ({ x, z, radius: 1.4 })),
    ...L.scaffolds.map(([x, z]) => ({ x, z, radius: 1.9 })),
    ...L.towers.map(([x, z]) => ({ x, z, radius: .9 })),
  ]);
  const { r, box, place } = kit;
  kit.useProps(getProp);
  const tech = techKit(kit, L.pools);
  const gold = Object.assign(glow('Cave glow gold', '#b8820c', 1.0), { side: THREE.DoubleSide });

  // Rock everywhere but the temple front's stretch of the north wall and the ceiling over the door.
  kit.walls((x, z, radius) => z < -13 && Math.abs(x) - radius * .8 < facade.half - 1.5);
  kit.ceiling(34, [gold], .16, (x, z) => z < -10.5 && Math.abs(x) < facade.half + 1);

  // THE BASE (techKit): floor, lanes, rail, lamps, services and their glow; a white lane leads to the temple steps.
  tech.base({ hall: HALL, lanterns: L.lanterns, lamps: L.lamps, loop: L.loop, accent: '#ffb030',
    arrows: [[-6, 14.2, Math.PI / 2], [6, 14.2, -Math.PI / 2], [0, -14.4, 0], [-14.6, 0, 0], [14.6, 0, 0]] });
  tech.lane([[0, -L.loop.half], [0, -16.9]], 2.2, '#e8e6e0', tech.laneMaterial);

  // TEMPLE FRONT on the north wall, the GLYPH DOOR in it: the carved ring and stone disc, the golden glyph turning
  // slowly; a halo round the ring, a softer one over the glyph and a streak of its light down the floor.
  place('Survey_Facade', [0, 0, facade.z], 0);
  box([0, 10, facade.z - .1], [facade.half - .8, 10, .4]);
  for (const s of [-1, 1]) box([s * 8.9, 10, facade.z + .5], [1.0, 10, .8]);
  // The three steps at its foot, each solid down to the floor.
  for (let i = 0; i < 3; i++) box([0, .2 * (i + 1), facade.z + 1.6 - i * .5], [8.2 - i * .6, .2 * (i + 1), .8]);
  place('Glyph_Door', [...door.at], 0);
  {
    const rotor = new THREE.Group(); rotor.name = 'Spin_z_12'; rotor.position.set(...door.at);
    rotor.add(getProp('Glyph_Rotor')); kit.group.add(rotor);
    tech.glow(softFrame(0, 0, door.radius - .6, door.radius + 4.6, '#ffa820', .45, 6, 8).translate(door.at[0], door.at[1], facade.z + .6), 'Glow halo door');
    tech.glow(softFrame(0, 0, 0, 4.3, '#ffc040', .1, 4, 8).translate(door.at[0], door.at[1], door.at[2] + .4), 'Glow halo glyph');
    tech.glow(glowGrid(9, 8.4, 6, 10, '#ffb030', (u, v) => .36 * Math.sin(Math.PI * u) ** 1.4 * v ** 1.8).rotateX(-Math.PI / 2).translate(0, .075, -12.6), 'Glow halo floor');
  }

  // STATUES in the north corners, turned a little toward the hall, their eyes glowing cyan.
  for (const s of L.statues) {
    const [x, z, yaw] = s;
    place('Statue', [x, 0, z], yaw);
    box([x, 4.5, z], [1.8, 4.5, 1.6], yaw);
    for (const side of [-1, 1]) { const [ex, ez] = local(s, side * .34, .84); tech.glow(glowBall(.32, '#30d8f0', .4).translate(ex, 7.15, ez), 'Glow halo eye'); }
    const [cx, cz] = local(s, 0, .7); tech.glow(glowBall(.45, '#30d8f0', .3).translate(cx, 4.9, cz), 'Glow halo emblem');
  }
  // PILLARS along the side walls, whole and broken.
  for (const [x, z, yaw] of L.pillars) { place('Ruin_Pillar', [x, 0, z], yaw); box([x, 3.6, z], [1.0, 3.6, 1.0], yaw); }
  for (const [x, z, yaw] of L.broken) { place('Ruin_Pillar_Broken', [x, 0, z], yaw); box([x, 2.0, z], [1.0, 2.0, 1.0], yaw); }
  // SURVEY SCAFFOLDS facing the hall, their lamps; LAMP TOWERS with their four-light heads.
  for (const s of L.scaffolds) {
    const [x, z, yaw] = s;
    place('Scaffold', [x, 0, z], yaw);
    box([x, 3.3, z], [1.55, 3.3, 1.05], yaw);
    const [lx, lz] = local(s, .9, -.2); tech.glow(glowBall(.6, '#ffe0a8', .35).translate(lx, 7.0, lz), 'Glow halo lamp');
    const [ix, iz] = local(s, -.6, .2); tech.glow(softFrame(.6, .4, 0, .35, '#30d8f0', .3, 2).rotateY(yaw).translate(ix, 3.8, iz), 'Glow halo screen');
  }
  for (const s of L.towers) {
    const [x, z, yaw] = s;
    place('Lamp_Tower', [x, 0, z], yaw);
    box([x, 3.3, z], [.55, 3.3, .55]);
    const [hx, hz] = local(s, 0, .4); tech.glow(glowBall(1.2, '#ffe0a0', .35).translate(hx, 6.4, hz), 'Glow halo lamp');
  }

  // GOLD VEINS in the rock, never on the temple front.
  tech.seams(12, gold, '#ffa820', (side, d) => side === 0 && Math.abs(d) < facade.half + 2, 'Cave gold vein');

  kit.wallFoot(14, () => r() < .55
    ? { name: 'Ruin_Block', scale: () => .9 + r() * .5, solid: [.8, .6] }
    : { name: 'Crate_Stack', scale: () => .8 + r() * .3, solid: [.9, .7] });
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
