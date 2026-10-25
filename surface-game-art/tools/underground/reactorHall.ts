// Offline: 地心反应堆 (world 2, layer 6) — the style sample for world 2's base kit (techKit.ts) on the shared cave
// shell (caveKit.ts), with props from build_reactor.py. Charcoal rock cracked by red-hot seams; the planet's molten
// core sits in a reactor facade on the north wall above the name board, held by a white ring with yellow clamps
// and a turning rotor, cooling towers either side; one smooth poured floor with the lamps' light baked in, a lane
// loop and arrows, a yellow rail round the pit, white kiosks. Glow is faked for phones: additive halos, light
// cones and streaks of reflected light on the floor.
// Moving parts are direct children named Spin_* (SceneMotion.ts).
import * as THREE from 'three';
import { caveKit, glow, matte, type GetProp } from './caveKit.ts';
import { techKit, softFrame, glowGrid, glowBall, lightCone, unlit, gloss } from './techKit.ts';
import { rng } from '../terrain/kit.ts';
import { REACTOR_HALL as HALL } from '../../../src/game/content/underground/reactorHall.ts';

export function buildHall(getProp: GetProp) {
  const L = HALL.layout, { core, facade } = L;
  const kit = caveKit(HALL, 2460001, {
    rock: ['#2c2729', '#403739'], upper: ['#383032', '#211c1e'], ceiling: ['#1e1a1b', '#2c2627'],
    stalactite: ['#2e2729', '#4a3834'], joint: '#1e1e22', stones: ['#5a5c62'], curb: '#f2c230',
  }, [
    ...L.towers.map(([x, z]) => ({ x, z, radius: 2.8 })),
  ]);
  const { r, box, add, place, M, HALF, PIT } = kit;
  kit.useProps(getProp);
  const tech = techKit(kit, L.pools);
  const ember = Object.assign(glow('Cave glow ember', '#c8360c', 1.0), { side: THREE.DoubleSide }), paintM = matte('Base paint'), steel = matte('Base steel');

  // Rock everywhere but the facade's stretch of the north wall and the ceiling over the core.
  kit.walls((x, z, radius) => z < -13 && Math.abs(x) - radius * .8 < facade.half - 1.5);
  kit.ceiling(34, [ember], .16, (x, z) => z < -10.5 && Math.abs(x) < facade.half + 1);

  // FLOOR: poured, glossy, lit by the pools; the lane loop round the pit, a white lane to the reactor, arrows.
  tech.pouredFloor('#a4a7ae', gloss('Base floor gloss', .42));
  const lanes = gloss('Base lane gloss', .5);
  tech.lane(tech.loopPath(L.loop.half, L.loop.corner), 1.0, '#f2c230', lanes, true);
  tech.lane([[0, -L.loop.half], [0, -17.6]], 2.2, '#e8e6e0', lanes);
  tech.hazard([-7.6, -17.9], [7.6, -17.9], .7, paintM);
  for (const [x, z, yaw] of [[-6, 14.2, Math.PI / 2], [6, 14.2, -Math.PI / 2], [0, -14.6, 0], [-14.6, 0, 0], [14.6, 0, 0]] as const)
    tech.arrow(x, z, yaw, 3.2, '#f4f2ec', lanes);
  kit.pitRim();
  tech.rail('#f2c230', paintM);

  // REACTOR FACADE on the north wall, the CORE in it: a faceted ball of lava plates and dark crust (unlit, its
  // own light) turning slowly about Z, the ring and its clamps round it, the rotor turning the other way, a halo
  // behind and a streak of its light down the floor.
  place('Reactor_Facade', [0, 0, facade.z], 0);
  box([0, 10, facade.z - .1], [facade.half - .8, 10, .4]);
  for (const s of [-1, 1]) box([s * 8.9, 10, facade.z + .4], [.8, 10, .7]);
  box([0, .6, facade.z + .55], [8.2, .6, .45]);
  {
    const lava = ['#ff6a14', '#ff8a24', '#f04a0c', '#ffb43c', '#ff7a1c'].map(c => new THREE.Color(c)), crust = new THREE.Color('#9a2a0c'), tone = rng(9071);
    const ball = new THREE.IcosahedronGeometry(core.radius, 3).toNonIndexed(); ball.computeVertexNormals();
    const colours = new Float32Array(ball.getAttribute('position').count * 3);
    for (let i = 0; i < colours.length / 3; i += 3) {
      const c = tone() < .14 ? crust.clone().multiplyScalar(.8 + tone() * .5) : lava[Math.floor(tone() * lava.length)].clone().multiplyScalar(.85 + tone() * .15);
      for (let k = 0; k < 3; k++) c.toArray(colours, (i + k) * 3);
    }
    ball.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    const spin = new THREE.Group(); spin.name = 'Spin_z_8'; spin.position.set(...core.at);
    spin.add(new THREE.Mesh(ball, unlit('Glow core'))); kit.group.add(spin);
    place('Reactor_Ring', [core.at[0], core.at[1], -18.2], 0);
    const rotor = new THREE.Group(); rotor.name = 'Spin_z_n30'; rotor.position.set(core.at[0], core.at[1], -18.2);
    rotor.add(getProp('Reactor_Rotor')); kit.group.add(rotor);
    tech.glow(softFrame(0, 0, core.radius - .3, core.radius + 6, '#ff5a14', .6, 6, 8).translate(core.at[0], core.at[1], facade.z + .36), 'Glow halo core');
    tech.glow(softFrame(0, 0, 6.3, 7.6, '#ff8a3a', .25, 2, 8).translate(core.at[0], core.at[1], -17.55), 'Glow halo ring');
    tech.glow(glowGrid(9, 9.6, 6, 12, '#ff6a24', (u, v) => .42 * Math.sin(Math.PI * u) ** 1.4 * v ** 1.8).rotateX(-Math.PI / 2).translate(0, .075, -13.2), 'Glow halo floor');
  }

  // COOLING TOWERS either side of the facade, fans turning on top, pipes into the rock; their glow on the floor.
  for (const [x, z] of L.towers) {
    place('Cooling_Tower', [x, 0, z], 0);
    box([x, 4.1, z], [2.1, 4.1, 2.1]);
    const fan = new THREE.Group(); fan.name = 'Spin_y_180'; fan.position.set(x, 8.2, z); fan.add(getProp('Cooling_Fan')); kit.group.add(fan);
    for (const y of [3.0, 6.6]) {
      const g = new THREE.CylinderGeometry(.42, .42, HALF - Math.abs(z) + 1.4, 10).rotateX(Math.PI / 2).toNonIndexed(); g.computeVertexNormals();
      g.translate(x - Math.sign(x) * .9, y, (z - 1.2 - HALF - 1) / 2);
      add(new THREE.Mesh(g, steel), 'Base pipe');
    }
    tech.glow(glowGrid(3.6, 3.4, 4, 6, '#ff7a2c', (u, v) => .3 * Math.sin(Math.PI * u) * v ** 1.6).rotateX(-Math.PI / 2).translate(x, .075, z + 3.6), 'Glow halo floor');
    tech.glow(softFrame(0, 0, 2.05, 3.0, '#ff6a20', .3, 2, 8).rotateX(Math.PI / 2).translate(x, 3.6, z), 'Glow halo vent');
  }
  // Paint the steel pipes: light grey, a little darker underneath.
  kit.group.traverse(o => { if (o instanceof THREE.Mesh && o.name === 'Base pipe') { const g = o.geometry, n = g.getAttribute('normal'), c = new Float32Array(n.count * 3); for (let i = 0; i < n.count; i++) new THREE.Color('#c8ccd2').multiplyScalar(n.getY(i) < -.3 ? .7 : 1).toArray(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); } });

  // CEILING LAMPS with cones of light and a glow under each.
  for (const [x, z] of L.lamps) {
    place('Ceiling_Lamp', [x, 12.6, z], (r() - .5) * .3);
    tech.glow(lightCone(x, z, .1, 12.3, .75, 3.3, '#ffe2b8', .1), 'Glow halo cone');
    tech.glow(softFrame(1.5, .8, 0, .9, '#ffd8a0', .45, 3).rotateX(Math.PI / 2).translate(x, 12.28, z), 'Glow halo lamp');
  }

  // SERVICES: the kiosks, the board, the lamp posts, and their glow: screen halos and floor streaks for the
  // kiosks, a halo round the board, balls round the lamp heads and the corner bollards' lamps.
  kit.services(L.lanterns);
  for (const [stall, tint] of [[HALL.stalls.sell, '#ff9a3c'], [HALL.stalls.shop, '#38d8c8']] as const) {
    const [x, , z] = stall.at;
    tech.glow(softFrame(2.9, 1.3, 0, 1.1, tint, .5, 4).translate(x, 4.6, z - 1.12), 'Glow halo screen');
    tech.glow(glowGrid(3.4, 2.6, 4, 5, tint, (u, v) => .22 * Math.sin(Math.PI * u) * v ** 1.5).rotateX(-Math.PI / 2).translate(x, .075, z - 2.6), 'Glow halo floor');
  }
  tech.glow(softFrame(7.5, 2.4, 0, .7, '#ff7a2c', .3, 3).translate(HALL.board[0], 6.0, HALL.board[2] + .14), 'Glow halo board');
  for (const [x, z, yaw] of L.lanterns) tech.glow(glowBall(.9, '#ffd8a8', .32).translate(x + .55 * Math.cos(yaw), 2.52, z - .55 * Math.sin(yaw)), 'Glow halo lamp');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tech.glow(glowBall(.55, '#ff7a2c', .4).translate(sx * (PIT + .5), 1.2, sz * (PIT + .5)), 'Glow halo bollard');

  // RED-HOT SEAMS cracking the rock: ribbons that follow the rock face (one ray per point), each with a soft
  // glow ribbon over it. Never on the facade.
  const rocks: THREE.Mesh[] = []; kit.group.updateMatrixWorld(true);
  kit.group.traverse(o => { if (o instanceof THREE.Mesh && o.material === M.rock) rocks.push(o); });
  const ray = new THREE.Raycaster();
  const ribbon = (points: THREE.Vector3[], normals: THREE.Vector3[], width: number, centre: (t: number) => THREE.Color, edge: THREE.Color) => {
    const position: number[] = [], colours: number[] = [];
    const across = points.map((p, i) => { const along = points[Math.min(points.length - 1, i + 1)].clone().sub(points[Math.max(0, i - 1)]); return along.cross(normals[i]).normalize().multiplyScalar(width / 2); });
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1], ca = centre(i / (points.length - 1)), cb = centre((i + 1) / (points.length - 1));
      const rows = [[a.clone().add(across[i]), edge], [a, ca], [a.clone().sub(across[i]), edge]] as const, next = [[b.clone().add(across[i + 1]), edge], [b, cb], [b.clone().sub(across[i + 1]), edge]] as const;
      for (let k = 0; k < 2; k++) for (const [p, c] of [rows[k], rows[k + 1], next[k + 1], rows[k], next[k + 1], next[k]]) { position.push(p.x, p.y, p.z); colours.push(c.r, c.g, c.b); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3)); g.computeVertexNormals();
    return g;
  };
  for (let i = 0, made = 0; i < 60 && made < 18; i++) {
    const side = Math.floor(r() * 4), d = (r() - .5) * 32;
    if (side === 0 && Math.abs(d) < facade.half + 2) continue;
    const dir = new THREE.Vector3(...([[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][side] as [number, number, number]));
    const points: THREE.Vector3[] = [], normals: THREE.Vector3[] = [];
    let y = .4 + r() * 2.2, s = d;
    for (let k = 0; k < 7; k++) {
      const origin = (side < 2 ? new THREE.Vector3(s, y, 0) : new THREE.Vector3(0, y, s)).addScaledVector(dir, PIT + 1);
      ray.set(origin, dir); ray.far = 16;
      const hit = ray.intersectObjects(rocks, false)[0];
      if (!hit || !hit.face) break;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      points.push(hit.point.clone().addScaledVector(n, .05)); normals.push(n);
      y += .6 + r() * .7; s += (r() - .5) * 1.1;
    }
    if (points.length < 4) continue;
    made++;
    const black = new THREE.Color(0, 0, 0);
    add(new THREE.Mesh(ribbon(points, normals, .16, () => new THREE.Color('#ffffff'), new THREE.Color('#ffffff')), ember), 'Cave ember seam');
    tech.glow(ribbon(points.map((p, k) => p.clone().addScaledVector(normals[k], .06)), normals, 1.3, t => new THREE.Color('#ff4a14').multiplyScalar(.4 * Math.sin(Math.PI * Math.min(1, t * 1.2 + .1))), black), 'Glow halo seam');
  }

  kit.wallFoot(12, () => ({ name: 'Crate_Stack', scale: () => .8 + r() * .3, solid: [.9, .7] }));
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
