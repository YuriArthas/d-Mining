// Offline: 自动化矿道 (world 2, layer 1) — a near-future mining base built into the cave, on the shared cave shell
// (caveKit.ts) and world 2's base kit (techKit.ts) with props from build_automine.py. The rock stays; the base is
// installed into it: the poured floor, lanes and pit rail, bulkheads and fans bolted onto the rock,
// light trusses under the ceiling, a drill machine with a spinning bit, conveyors carrying ore to a hopper and a
// crusher, an ore cart on a rail, two mining robots and a garage bay where the shop would stand. The hero: a tunnel
// boring machine in the north wall's facade above the name board, its cutterhead turning in a white shield.
// Moving parts are direct children named Spin_* / Slide_* (SceneMotion.ts). Props bring their colliders
// (build_automine.py); the hall's own shapes (rock, floor, conveyors, rail buffers) add theirs here.
import * as THREE from 'three';
import { caveKit, colour, glow, matte, type GetProp } from './caveKit.ts';
import { techKit, softFrame, glowGrid } from './techKit.ts';
import { AUTOMINE_HALL as HALL } from '../../../src/game/content/underground/automineHall.ts';

type XZ = readonly [number, number];
/** A point offset (dx, dz) in a prop's own frame, turned by its yaw, from its placement. */
const local = ([x, z]: XZ, yaw: number, dx: number, dz: number): [number, number] => [x + dx * Math.cos(yaw) + dz * Math.sin(yaw), z - dx * Math.sin(yaw) + dz * Math.cos(yaw)];

export function buildHall(getProp: GetProp) {
  const L = HALL.layout;
  const kit = caveKit(HALL, 410001, {
    rock: ['#68707c', '#949ca8'], upper: ['#747c88', '#4c5460'], ceiling: ['#3e4450', '#586070'],
    stalactite: ['#5e6672', '#8e96a2'], joint: '#262b34', stones: ['#9aa2ae'], curb: '#f2c230',
  }, [
    { x: L.drill.at[0], z: L.drill.at[1], radius: 3.2 },
    ...L.conveyors.map(c => ({ x: c.end[0], z: c.end[1], radius: 2.2 })),
    { x: L.garage[0], z: L.garage[1], radius: 3.8 },
    ...L.robots.map(r => ({ x: r.at[0], z: r.at[1], radius: 1.6 })),
  ]);
  const { r, box, add, place, M, HALF, PIT } = kit;
  kit.useProps(getProp);
  const tech = techKit(kit, L.pools);
  const cyan = glow('Cave glow cyan', '#22d4f4', 1.0), steel = matte('Base steel'), grit = matte('Cave grit');
  const block = (size: readonly number[], at: readonly number[], tint: string, material: THREE.Material = steel, yaw = 0) => {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed(); g.computeVertexNormals();
    const m = new THREE.Mesh(colour(g, (_y, _i, n) => new THREE.Color(tint).multiplyScalar(n.y > .5 ? 1.06 : n.y < -.5 ? .8 : .94)), material);
    m.position.set(at[0], at[1], at[2]); m.rotation.y = yaw; return m;
  };

  // Rock everywhere but the facade's stretch of the north wall and the ceiling over the boring machine.
  const { facade, shield } = L;
  kit.walls((x, z, radius) => z < -13 && Math.abs(x) - radius * .8 < facade.half - 1.5);
  kit.ceiling(22, [cyan], .12, (x, z) => z < -10.5 && Math.abs(x) < facade.half + 1);

  // THE BASE (techKit): the poured floor with the lamps' light baked in, the lane loop and arrows, the pit rail,
  // the kiosks, board and lamp posts with their glow. The trusses below carry the ceiling light here.
  tech.base({ hall: HALL, lanterns: L.lanterns, lamps: [], loop: { half: 10.6, corner: 2.4 }, accent: '#22c4e4',
    arrows: [[-6, 14.2, Math.PI / 2], [6, 14.2, -Math.PI / 2], [-15, 1, 0], [15.8, -2.2, 0]] });
  kit.patches(kit.wallSpots(10), grit, '#565e6a', 'Cave grit');
  tech.lane([[0, -10.6], [0, -17.6]], 2.2, '#e8e6e0', tech.laneMaterial);
  tech.hazard([-7.6, -17.9], [7.6, -17.9], .7, tech.paintMaterial);

  // THE BORING MACHINE in the facade: the shield and its rams, the cutterhead turning slowly, a cyan halo behind
  // and round the shield and a streak of its light down the floor.
  place('TBM_Facade', [0, 0, facade.z], 0);
  place('TBM_Shield', [0, shield.y, shield.z], 0);
  {
    const cutter = new THREE.Group(); cutter.name = 'Spin_z_n15'; cutter.position.set(0, shield.y, shield.z + .1);
    cutter.add(getProp('TBM_Cutter')); kit.group.add(cutter);
  }
  tech.glow(softFrame(0, 0, 4.6, 11, '#1ab4e0', .5, 6, 8).translate(0, shield.y, facade.z + .36), 'Glow halo shield');
  tech.glow(softFrame(0, 0, 6.6, 8.2, '#40d8ff', .22, 2, 8).translate(0, shield.y, shield.z + .62), 'Glow halo ring');
  tech.glow(glowGrid(9, 9.6, 6, 12, '#30c8f0', (u, v) => .36 * Math.sin(Math.PI * u) ** 1.4 * v ** 1.8).rotateX(-Math.PI / 2).translate(0, .075, -13.2), 'Glow halo floor');

  // ROCK INSTALLATIONS: rays from the floor ring out to the rock find where bulkheads and fans are bolted on.
  const rocks: THREE.Mesh[] = []; kit.group.updateMatrixWorld(true);
  kit.group.traverse(o => { if (o instanceof THREE.Mesh && o.material === M.rock) rocks.push(o); });
  const ray = new THREE.Raycaster();
  const onRock = (side: number, d: number, heights: readonly number[], spread: number) => {
    const dir = new THREE.Vector3(...([[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][side] as [number, number, number]));
    let nearest = HALF + 1;
    for (const y of heights) for (const o of [-spread, 0, spread]) {
      const origin = side < 2 ? new THREE.Vector3(d + o, y, 0) : new THREE.Vector3(0, y, d + o);
      origin.addScaledVector(dir, PIT + 1);
      ray.set(origin, dir); ray.far = 20;
      const hit = ray.intersectObjects(rocks, false)[0];
      nearest = Math.min(nearest, hit ? hit.distance + PIT + 1 : HALF + .5);
    }
    return { dir, nearest, yaw: Math.atan2(-dir.x, -dir.z), at: (dist: number, y: number) => (side < 2 ? new THREE.Vector3(d, y, 0) : new THREE.Vector3(0, y, d)).addScaledVector(dir, dist) };
  };
  for (const { side, d } of L.bulkheads) {
    const wall = onRock(side, d, [.6, 2.5, 4.6], 1.7), p = wall.at(wall.nearest - .4, 0);
    place('Bulkhead', [p.x, 0, p.z], wall.yaw);
  }
  for (const { side, d, y } of L.fans) {
    const wall = onRock(side, d, [y - 1.2, y, y + 1.2], 1.2), p = wall.at(wall.nearest - .55, y);
    place('Fan_Frame', [p.x, p.y, p.z], wall.yaw);
    const spin = new THREE.Group(); spin.name = 'Spin_z_260'; spin.position.copy(p); spin.rotation.y = wall.yaw;
    spin.add(getProp('Fan_Blades')); kit.group.add(spin);
  }

  // LIGHT TRUSSES across the hall under the ceiling, each with a long cyan strip beneath.
  for (const z of L.trusses) {
    for (const y of [12.6, 13.8]) add(block([36, .28, .28], [0, y, z], '#4a525e'), 'Base truss chord');
    for (let x = -17; x <= 17; x += 2) {
      add(block([.16, 1.2, .16], [x, 13.2, z], '#5a6270'), 'Base truss post');
      const diagonal = block([.12, 1.55, .12], [x + 1, 13.2, z], '#5a6270'); diagonal.rotation.z = (x / 2) % 2 ? .87 : -.87; add(diagonal, 'Base truss brace');
    }
    add(block([28, .1, .34], [0, 12.42, z], '#103848', cyan), 'Base truss light');
  }

  // DRILL MACHINE in the north-west bay, its bit spinning under the spindle.
  {
    const { at, yaw } = L.drill;
    place('Drill_Machine', [at[0], 0, at[1]], yaw);
    const [bx, bz] = local(at, yaw, .9, .2), spin = new THREE.Group(); spin.name = 'Spin_y_420'; spin.position.set(bx, .25, bz);
    spin.add(getProp('Drill_Bit')); kit.group.add(spin);
  }
  // CONVEYORS: a raised belt on legs with yellow-edged side rails; cleats and ore slide toward the far machine.
  for (const c of L.conveyors) {
    const along = c.axis === 'x', mid: [number, number] = along ? [c.from[0] + c.length / 2, c.from[1]] : [c.from[0], c.from[1] + c.length / 2];
    const size = (a: number, b: number, h: number) => along ? [a, h, b] : [b, h, a];
    add(block(size(c.length + .4, 1.2, .26), [mid[0], .86, mid[1]], '#3a414c'), 'Conveyor bed');
    add(block(size(c.length, .96, .04), [mid[0], 1.01, mid[1]], '#24262c'), 'Conveyor belt');
    for (const s of [-1, 1]) {
      const off = s * .62;
      add(block(size(c.length + .4, .12, .22), [mid[0] + (along ? 0 : off), 1.1, mid[1] + (along ? off : 0)], '#f2c230'), 'Conveyor rail');
      for (let t = .4; t < c.length; t += 1.6) {
        const lx = along ? c.from[0] + t : c.from[0] + off, lz = along ? c.from[1] + off : c.from[1] + t;
        add(block([.16, .74, .16], [lx, .37, lz], '#5a6270'), 'Conveyor leg');
      }
    }
    box([mid[0], .65, mid[1]], along ? [c.length / 2 + .2, .65, .72] : [.72, .65, c.length / 2 + .2]);
    const slide = new THREE.Group(); slide.name = `Slide_${c.axis}_${Math.round(c.length * 100)}_55`;
    slide.position.set(c.from[0], 0, c.from[1]);
    for (let t = 0; t < c.length - .05; t += .55) {
      const cleat = block(size(.1, .9, .06), [0, 1.06, 0], '#5a6270'); cleat.position[c.axis] = t; slide.add(cleat);
    }
    for (let t = .3; t < c.length - .2; t += 1.45) {
      const ore = block([.36, .3, .36], [0, 1.2, 0], '#4a6ad8', steel, r() * 3); ore.position[c.axis] = t; slide.add(ore);
    }
    kit.group.add(slide);
    if (c.to === 'Ore_Hopper') place('Ore_Hopper', [c.end[0], 0, c.end[1]], -Math.PI / 2);
    else place('Crusher', [c.end[0], 0, c.end[1]], Math.PI / 2);
  }
  // RAIL along the east side with an ore cart on it and a buffer at each end.
  {
    const { x, from, to, cart } = L.rail;
    for (const s of [-1, 1]) add(block([.1, .1, to - from], [x + s * .5, .12, (from + to) / 2], '#8d95a1'), 'Rail');
    for (let z = from + .3; z < to; z += .8) add(block([1.4, .06, .24], [x, .08, z], '#3a414c'), 'Rail sleeper');
    for (const z of [from - .2, to + .2]) { add(block([1.4, .7, .3], [x, .35, z], '#f2c230'), 'Rail buffer'); box([x, .35, z], [.7, .35, .15]); }
    place('Ore_Cart', [x, .1, cart], 0);
  }
  for (const { at, yaw } of L.robots) place('Robot_Miner', [at[0], 0, at[1]], yaw);
  place('Garage_Gate', [L.garage[0], 0, L.garage[1]], Math.PI);
  for (const [x, z, yaw] of [[15.8, 15.6, .3], [8.2, 17.4, -.2]] as const) place('Crate_Stack', [x, 0, z], yaw);

  kit.wallFoot(14, () => ({ name: 'Crate_Stack', scale: () => .7 + r() * .3 }));
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
