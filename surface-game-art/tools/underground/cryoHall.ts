// Offline: 冰封实验室 (world 2, layer 5) — the colony's cold lab in an ice cave, on world 2's base kit (techKit.ts)
// over the shared cave shell (caveKit.ts), with props from build_cryo.py. Dim blue ice walls with icicles and
// glowing cyan cracks; a frozen waterfall of tall pale-cyan columns (unlit, its own light) down the north wall
// behind the name board, framed by a soft halo with a frost mist at its foot and its light streaking down the
// floor; two giant ice pillars flank it, amber heater capsules stand at its foot and by the pods; white insulated
// pods along the side walls and where a shop would be; frosted pipes into the ice; snow drifts at the wall feet.
// Moving parts are direct children named Spin_* (SceneMotion.ts).
import * as THREE from 'three';
import { caveKit, glow, matte, rockMass, smooth, type GetProp } from './caveKit.ts';
import { techKit, softFrame, glowGrid, glowBall, unlit } from './techKit.ts';
import { rng } from '../terrain/kit.ts';
import { CRYO_HALL as HALL } from '../../../src/game/content/underground/cryoHall.ts';

export function buildHall(getProp: GetProp) {
  const L = HALL.layout, { falls } = L;
  const kit = caveKit(HALL, 2050001, {
    rock: ['#2c4460', '#46688a'], upper: ['#3c5a7a', '#22344a'], ceiling: ['#1c2a3c', '#2c4058'],
    stalactite: ['#4a7090', '#8cc0e0'], joint: '#1e2430', stones: ['#5a5c62'], curb: '#f2c230',
  }, [
    ...L.pillars.map(([x, z]) => ({ x, z, radius: 3 })),
    ...L.pods.map(([x, z]) => ({ x, z, radius: 2.6 })),
  ]);
  const { r, box, add, place, M } = kit;
  kit.useProps(getProp);
  const tech = techKit(kit, L.pools);
  const crack = Object.assign(glow('Cave glow ice', '#1a8cb8', 1.0), { side: THREE.DoubleSide });
  const tips = glow('Cave glow ice tip', '#1a9cc8', 1.1), snow = matte('Cave snow'), frost = matte('Base frost pipe');

  // Ice everywhere but behind the frozen waterfall; icicles with cyan tips.
  kit.walls((x, z, radius) => z < -13 && Math.abs(x) - radius * .8 < falls.half - .8);
  kit.ceiling(60, [tips], .22);

  // THE BASE (techKit); a white lane leads from the loop to the board.
  tech.base({ hall: HALL, lanterns: L.lanterns, lamps: L.lamps, loop: L.loop, accent: '#2ab8e8' });
  tech.lane([[0, -L.loop.half], [0, -16.4]], 2.2, '#e8eef4', tech.laneMaterial);

  // FROZEN WATERFALL: tall six-sided columns side by side against the north wall, each a little forward or back,
  // pale cyan, brightest at the foot where the ice is thickest (unlit: it is the hall's light). A frame of halo
  // round it, a frost mist at its foot and its light down the floor.
  {
    const tone = rng(5077), top = new THREE.Color('#2a8cc0'), foot = new THREE.Color('#9fe6ff'), streak = new THREE.Color('#d8f6ff');
    const parts: THREE.BufferGeometry[] = [];
    for (let x = -falls.half; x <= falls.half + 1e-6; x += .82) {
      const radius = .5 + tone() * .22, height = falls.top - tone() * 3 - (Math.abs(x) / falls.half) ** 2 * 2.5, z = falls.z + (tone() - .5) * .5 + Math.abs(x) * -.04;
      const g = new THREE.CylinderGeometry(radius * .82, radius, height, 6, 4).toNonIndexed(); g.translate(x + (tone() - .5) * .2, height / 2, z);
      const pos = g.getAttribute('position'), c = new Float32Array(pos.count * 3), lift = .85 + tone() * .2;
      for (let i = 0; i < pos.count; i += 3) {
        const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, f = tone();
        const col = top.clone().lerp(foot, 1 - smooth(0, height, y)).multiplyScalar(lift * (.9 + f * .15));
        if (f < .08) col.lerp(streak, .6);
        for (let k = 0; k < 3; k++) col.toArray(c, (i + k) * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); parts.push(g);
    }
    const fallsMaterial = unlit('Glow ice falls');
    for (const g of parts) add(new THREE.Mesh(g, fallsMaterial), 'Cave frozen falls');
    box([0, 8, falls.z], [falls.half + .4, 8, .7]);
    tech.glow(softFrame(falls.half * 2 + .6, falls.top - 1, 0, 2.6, '#3ac8ff', .32, 4).translate(0, (falls.top - 1) / 2, falls.z + .9), 'Glow halo falls');
    tech.glow(glowGrid(falls.half * 2 + 3, 2.8, 8, 4, '#bff0ff', (u, v) => .26 * Math.sin(Math.PI * u) ** .8 * (1 - v) ** 1.6).translate(0, 1.4, -17.9), 'Glow halo mist');
    tech.glow(glowGrid(9, 8, 6, 10, '#58d0ff', (u, v) => .34 * Math.sin(Math.PI * u) ** 1.4 * v ** 1.8).rotateX(-Math.PI / 2).translate(0, .075, -12.6), 'Glow halo floor');
  }

  // ICE PILLARS floor to ceiling either side of the falls: pale faceted columns on the ice material.
  for (const [x, z] of L.pillars) {
    const pillar = rockMass(r, x, z, 2.3, -.6, HALL.size[1] + 1, [[0, 1.15], [.12, .92], [.55, .8], [.9, .95], [1, 1.2]],
      f => new THREE.Color('#78b4dc').lerp(new THREE.Color('#bfe6fa'), smooth(0, .35, f) * (1 - smooth(.7, 1, f) * .7)), 9);
    add(new THREE.Mesh(pillar.geometry, M.rock), 'Cave ice pillar'); kit.hull(pillar.points);
    tech.glow(glowGrid(3.6, 9, 3, 6, '#3ac8ff', (u, v) => .18 * Math.sin(Math.PI * u) * (1 - v) ** 1.2).translate(x, 4.5, z + 2.7), 'Glow halo pillar');
  }

  // HEATER CAPSULES: amber glass in a yellow frame, a fan turning on top, a glow ball round the glass.
  for (const [x, z, yaw] of L.heaters) {
    place('Heater_Capsule', [x, 0, z], yaw);
    box([x, 1.4, z], [.62, 1.4, .62]);
    const fan = new THREE.Group(); fan.name = 'Spin_y_300'; fan.position.set(x, 2.84, z); fan.add(getProp('Heater_Fan')); kit.group.add(fan);
    tech.glow(glowBall(1.3, '#ff9a40', .3).translate(x, 1.45, z), 'Glow halo heater');
  }
  // PODS along the side walls and in the shop's place, each with a frost pipe from its back into the ice and a
  // warm glow round its door.
  for (const [x, z, yaw] of L.pods) {
    place('Cryo_Pod', [x, 0, z], yaw);
    box([x, 2.0, z], [1.95, 2.0, 1.95], yaw);
    const back = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw), front = back.clone().negate();
    place('Frost_Pipe', [x + back.x * 2.0, 0, z + back.z * 2.0], yaw + Math.PI);
    const door = new THREE.Vector3(x, 1.6, z).addScaledVector(front, 2.55);
    tech.glow(softFrame(1.2, 2.0, 0, .7, '#ffc070', .28, 3).rotateY(yaw).translate(door.x, 1.2, door.z), 'Glow halo door');
  }
  // Frosted pipes along the north wall feet between the pillars and the falls.
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(.36, .36, 4.4, 10).rotateZ(Math.PI / 2).toNonIndexed(); g.translate(s * 8.6, .9, -18.4); g.computeVertexNormals();
    const n = g.getAttribute('normal'), c = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) new THREE.Color('#b8c8d8').multiplyScalar(n.getY(i) < -.3 ? .7 : 1).toArray(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); add(new THREE.Mesh(g, frost), 'Base frost pipe');
    box([s * 8.6, .9, -18.4], [2.2, .36, .36]);
  }

  // GLOWING CRACKS in the ice, never over the falls; snow drifts along the wall feet.
  tech.seams(14, crack, '#3ac8ff', (side, d) => side === 0 && Math.abs(d) < falls.half + 2, 'Cave ice crack');
  kit.patches(kit.wallSpots(16), snow, '#8ea4b8', 'Cave snow');
  kit.wallFoot(10, () => ({ name: 'Crate_Stack', scale: () => .8 + r() * .3, solid: [.9, .7] }));
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
