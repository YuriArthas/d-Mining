// Offline: the 熔岩矿洞 rest hall on the shared cave shell (caveKit.ts), with props (and their colliders) from
// build_volcanic.py. Red-brown
// basalt over a column-top floor with lava in its seams, hexagonal column clusters along the walls, a raised lava basin with drifting crust plates,
// ember vents, glowing ember cracks running over the rock faces, ash patches with ember specks.
import * as THREE from 'three';
import { caveKit, colour, glow, matte, type GetProp } from './caveKit.ts';
import { VOLCANIC_HALL as HALL } from '../../../src/game/content/underground/volcanicHall.ts';

export function buildHall(getProp: GetProp) {
  const kit = caveKit(HALL, 240001, {
    rock: ['#6a3e36', '#965c4c'], upper: ['#74463c', '#4a2c26'], ceiling: ['#3c221e', '#583530'],
    stalactite: ['#5c3a32', '#8c5a4a'], joint: '#4a1206', stones: ['#6e5450', '#785c56', '#644a46', '#725852'], curb: '#7a5a52',
  }, [
    ...HALL.columns.slice(0, 4).map(c => ({ x: c.at[0], z: c.at[2], radius: c.radius * .9 })),
    { x: HALL.pool.at[0], z: HALL.pool.at[2], radius: HALL.pool.radius + .6 },
    { x: HALL.spare[0], z: HALL.spare[2], radius: 3.4 },
  ]);
  const { r, box, add, place, M } = kit;
  kit.useProps(getProp);
  const lava = glow('Cave glow lava', '#ff7a2a', 1.3), ember = glow('Cave glow ember', '#ffb040', 1.15), ash = matte('Cave ash');

  kit.walls();
  kit.ceiling(60, [lava, ember], .18);
  // Basalt column tops, each at its own height, with lava glowing in the seams.
  kit.floor({ kind: 'hex', radius: 1.05, gap: .16, height: [.03, .085] }, glow('Cave glow seam', '#ff4a10', .6));
  kit.patches(kit.wallSpots(22, HALL.columns.slice(0, 4).map(c => [c.at[0], c.at[2], c.radius * 1.1] as const)), ash, '#54403a', 'Cave ash', [lava, ember], .5, 2.4);
  kit.pitRim();

  // LAVA BASIN: a ring of basalt rim stones round a glowing surface with a few dark crust plates.
  const { at: poolAt, radius: poolR } = HALL.pool;
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + r() * .15;
    place('Lava_Rim', [poolAt[0] + Math.cos(a) * poolR, 0, poolAt[2] + Math.sin(a) * poolR], -a + Math.PI / 2, 1 + r() * .2);
  }
  const surface = new THREE.CircleGeometry(poolR - .2, 28).rotateX(-Math.PI / 2).toNonIndexed(); surface.translate(poolAt[0], .42, poolAt[2]); surface.computeVertexNormals();
  add(new THREE.Mesh(colour(surface, () => new THREE.Color('#5a1a06')), glow('Cave glow lava pool', '#ff5410', .78)), 'Cave glow lava pool');
  const crust = matte('Cave lava crust');
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (poolR - 1), size = .35 + r() * .35, pts: THREE.Vector2[] = [];
    for (let k = 0; k < 6; k++) { const b = k / 6 * Math.PI * 2, rr = size * (.75 + r() * .4); pts.push(new THREE.Vector2(poolAt[0] + Math.cos(a) * d + Math.cos(b) * rr, -(poolAt[2] + Math.sin(a) * d + Math.sin(b) * rr))); }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: .06, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); g.translate(0, .41, 0); g.computeVertexNormals();
    add(new THREE.Mesh(colour(g, (_y, _i, n) => new THREE.Color(n.y > .5 ? '#3e2a26' : '#ff8a3a')), crust), 'Cave lava crust');
  }
  box([poolAt[0], .3, poolAt[2]], [poolR * .8, .3, poolR * .8]);

  // EMBER CRACKS on the rock faces: zigzag seams found by casting rays out at the walls, each segment laid flat
  // on the face it hit, so the glow always sits on the rock.
  const rocks: THREE.Mesh[] = []; kit.group.updateMatrixWorld(true);
  kit.group.traverse(o => { if (o instanceof THREE.Mesh && o.material === M.rock) rocks.push(o); });
  const ray = new THREE.Raycaster(), seam = new THREE.Object3D();
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    let y = .5 + r() * 2.5, sway = 0;
    const segments = 3 + Math.floor(r() * 3), material = r() < .6 ? lava : ember;
    for (let k = 0; k < segments; k++) {
      const turn = a + sway, origin = new THREE.Vector3(Math.cos(turn) * 6, y, Math.sin(turn) * 6);
      ray.set(origin, new THREE.Vector3(Math.cos(turn), (r() - .5) * .1, Math.sin(turn)).normalize()); ray.far = 20;
      const hit = ray.intersectObjects(rocks, false)[0]; if (!hit?.face) break;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const length = .8 + r() * .6, g = new THREE.BoxGeometry(.22, length, .05).toNonIndexed();
      seam.position.copy(hit.point).addScaledVector(normal, .03); seam.lookAt(hit.point.clone().add(normal)); seam.rotateZ((r() - .5) * .7); seam.updateMatrix();
      g.applyMatrix4(seam.matrix); g.computeVertexNormals();
      add(new THREE.Mesh(colour(g, () => new THREE.Color('#ffffff')), material), 'Cave glow crack');
      y += length * .92; sway += (r() - .5) * .05;
    }
  }

  // LANDMARKS: basalt column clusters, ember vents.
  for (const c of HALL.columns) place('Basalt_Columns', c.at, c.yaw, c.height);
  for (const v of HALL.vents) place('Ember_Vent', v.at, r() * 6.3, v.scale);
  kit.services();
  // In the spare stall's place (this layer has no shop): a big obsidian cluster between two basalt stubs.
  {
    const [x, , z] = HALL.spare;
    for (const [dx, dz, name, scale] of [[0, 0, 'Obsidian_Cluster', 2.1], [-2.1, .5, 'Basalt_Stub', 1.4], [2.2, -.3, 'Basalt_Stub', 1.1]] as const)
      place(name, [x + dx, 0, z + dz], r() * 6.3, scale);
  }
  kit.wallFoot(30, () => r() < .45
    ? { name: 'Obsidian_Cluster', scale: () => .9 + r() * .8 }
    : { name: 'Basalt_Stub', scale: () => .8 + r() * .9 });
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
