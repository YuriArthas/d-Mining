// Offline: 自动化矿道 (world 2, layer 1) — a near-future mining base built into the cave, on the shared cave shell
// (caveKit.ts) with props from build_automine.py. The rock stays; the base is installed into it: chamfered metal
// deck panels with hazard bands round the pit and painted walkway lines, bulkheads and fans bolted onto the rock,
// light trusses under the ceiling, a drill machine with a spinning bit, conveyors carrying ore to a hopper and a
// crusher, an ore cart on a rail, two mining robots and a garage bay where the shop would stand.
// Moving parts are direct children named Spin_* / Slide_* (SceneMotion.ts).
import * as THREE from 'three';
import { caveKit, colour, glow, matte, type GetProp } from './caveKit.ts';
import { AUTOMINE_HALL as HALL } from '../../../src/game/content/underground/automineHall.ts';

type XZ = readonly [number, number];
const HALL_JOINT = '#262b34';
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
  const cyan = glow('Cave glow cyan', '#22d4f4', 1.0), deck = matte('Base deck'), steel = matte('Base steel'), grit = matte('Cave grit');
  const block = (size: readonly number[], at: readonly number[], tint: string, material: THREE.Material = steel, yaw = 0) => {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed(); g.computeVertexNormals();
    const m = new THREE.Mesh(colour(g, (_y, _i, n) => new THREE.Color(tint).multiplyScalar(n.y > .5 ? 1.06 : n.y < -.5 ? .8 : .94)), material);
    m.position.set(at[0], at[1], at[2]); m.rotation.y = yaw; return m;
  };

  kit.walls();
  kit.ceiling(22, [cyan], .12);

  // DECK: chamfered 2 m panels on a grid over the floor ring (a tech floor may be regular), mostly light grey with
  // a few darker grating plates, dark joints between. The walkable slab is the shared one (4 cm).
  for (const [x0, x1, z0, z1] of [[-HALF, -PIT, -HALF, HALF], [PIT, HALF, -HALF, HALF], [-PIT, PIT, -HALF, -PIT], [-PIT, PIT, PIT, HALF]]) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).toNonIndexed(); g.translate((x0 + x1) / 2, .006, (z0 + z1) / 2);
    add(new THREE.Mesh(colour(g, () => new THREE.Color(HALL_JOINT)), M.floor), 'Base deck joints');
    box([(x0 + x1) / 2, .02, (z0 + z1) / 2], [(x1 - x0) / 2, .02, (z1 - z0) / 2]);
  }
  const panelShape = (cx: number, cz: number, s: number, q: number) => new THREE.Shape([[-1, -1 + q], [-1 + q, -1], [1 - q, -1], [1, -1 + q], [1, 1 - q], [1 - q, 1], [-1 + q, 1], [-1, 1 - q]]
    .map(([u, v]) => new THREE.Vector2(cx + u * s, -(cz + v * s))));
  for (let x = -HALF; x < HALF; x += 2) for (let z = -HALF; z < HALF; z += 2) {
    const cx = x + 1, cz = z + 1;
    if (Math.abs(cx) < PIT && Math.abs(cz) < PIT) continue;
    const roll = r(), tint = roll < .08 ? '#646c7a' : roll < .3 ? '#98a0ab' : '#aab1bb';
    const g = new THREE.ExtrudeGeometry(panelShape(cx, cz, .94, .08), { depth: .05, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); g.computeVertexNormals();
    const c = new THREE.Color(tint).multiplyScalar(.96 + r() * .08);
    add(new THREE.Mesh(colour(g, (_y, _i, n) => n.y > .5 ? c : c.clone().multiplyScalar(.7)), deck), 'Base deck panel');
    // Four bolt heads in the corners of the light panels.
    if (roll >= .08) for (const [u, v] of [[-.72, -.72], [.72, -.72], [-.72, .72], [.72, .72]]) add(block([.12, .03, .12], [cx + u, .065, cz + v], '#7d8592', deck), 'Base deck bolt');
  }
  // Hazard band round the pit, just outside the curb: yellow and black blocks in turn.
  for (const side of [-1, 1]) for (const axis of ['x', 'z'] as const) for (let a = -PIT - 1.2, k = 0; a < PIT + 1.2 - 1e-6; a += .6, k++) {
    const at = axis === 'x' ? [a + .3, .078, side * (PIT + 1.05)] : [side * (PIT + 1.05), .078, a + .3];
    add(block(axis === 'x' ? [.6, .012, .5] : [.5, .012, .6], at, k % 2 ? '#2a2a2e' : '#f2c230', deck), 'Base hazard band');
  }
  // Painted walkway loop between the pit and the installations.
  const W = 10.6;
  for (const side of [-1, 1]) {
    add(block([W * 2 + .14, .01, .14], [0, .077, side * W], '#f2c230', deck), 'Base walkway line');
    add(block([.14, .01, W * 2 + .14], [side * W, .077, 0], '#f2c230', deck), 'Base walkway line');
  }
  kit.patches(kit.wallSpots(10), grit, '#565e6a', 'Cave grit');
  kit.pitRim();

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
    box([p.x - wall.dir.x * .1, 1.2, p.z - wall.dir.z * .1], [side < 2 ? 2.15 : .35, 1.2, side < 2 ? .35 : 2.15]);
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
    box([at[0], 1.7, at[1]], [1.8, 1.7, 1.5], yaw);
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
    if (c.to === 'Ore_Hopper') { place('Ore_Hopper', [c.end[0], 0, c.end[1]], -Math.PI / 2); box([c.end[0], 1.75, c.end[1]], [1.45, 1.75, 1.45]); }
    else { place('Crusher', [c.end[0], 0, c.end[1]], Math.PI / 2); box([c.end[0], 1.5, c.end[1]], [1.5, 1.5, 1.25], Math.PI / 2); }
  }
  // RAIL along the east side with an ore cart on it and a buffer at each end.
  {
    const { x, from, to, cart } = L.rail;
    for (const s of [-1, 1]) add(block([.1, .1, to - from], [x + s * .5, .12, (from + to) / 2], '#8d95a1'), 'Rail');
    for (let z = from + .3; z < to; z += .8) add(block([1.4, .06, .24], [x, .08, z], '#3a414c'), 'Rail sleeper');
    for (const z of [from - .2, to + .2]) { add(block([1.4, .7, .3], [x, .35, z], '#f2c230'), 'Rail buffer'); box([x, .35, z], [.7, .35, .15]); }
    place('Ore_Cart', [x, .1, cart], 0); box([x, .75, cart], [.68, .75, 1.0]);
  }
  for (const { at, yaw } of L.robots) { place('Robot_Miner', [at[0], 0, at[1]], yaw); box([at[0], 1.3, at[1]], [1.0, 1.3, 1.0], yaw); }
  place('Garage_Gate', [L.garage[0], 0, L.garage[1]], Math.PI);
  for (const s of [-1, 1]) box([L.garage[0] + s * 2.6, 2.4, L.garage[1]], [.4, 2.4, .5]);
  box([L.garage[0], 2.2, L.garage[1] + .4], [2.2, 2.2, .3]);
  for (const [x, z, yaw] of [[15.8, 15.6, .3], [8.2, 17.4, -.2]] as const) { place('Crate_Stack', [x, 0, z], yaw); box([x + .3, .7, z], [1.1, .7, .7], yaw); }

  kit.services(L.lanterns);
  kit.wallFoot(14, () => ({ name: 'Crate_Stack', scale: () => .7 + r() * .3, solid: [.9, .6] }));
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
