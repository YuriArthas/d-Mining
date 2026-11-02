// Offline: the 蘑菇洞穴 rest hall on the shared cave shell (caveKit.ts): an indigo cave, moss carpets with glowing
// specks, a raised glowing pool in the north-east, glowing vines, and giant mushrooms from build_fungal.py (props
// with their colliders).
import * as THREE from 'three';
import { caveKit, colour, glow, matte, type GetProp } from './caveKit.ts';
import { FUNGAL_HALL as HALL } from '../../../src/game/content/underground/fungalHall.ts';

export function buildHall(getProp: GetProp) {
  const kit = caveKit(HALL, 80001, {
    rock: ['#5a6182', '#7f76ad'], upper: ['#6d669c', '#4a4574'], ceiling: ['#3e3a63', '#57518a'],
    stalactite: ['#5d578c', '#8a80c8'], joint: '#2a2840', stones: ['#68728f', '#727c98', '#5f6886', '#6b7488'], curb: '#6a6f86',
  }, HALL.mushrooms.slice(0, 4).map(m => ({ x: m.at[0], z: m.at[2], radius: m.cap * .55 })));
  const { r, box, add, place } = kit;
  kit.useProps(getProp);
  const moss = matte('Cave moss'), teal = glow('Cave glow teal', '#57f0d8', 1.2), violet = glow('Cave glow violet', '#b98bff', 1.1);

  kit.walls();
  kit.ceiling(70, [teal, violet]);
  kit.floor();
  kit.patches(kit.wallSpots(26, HALL.mushrooms.map(m => [m.at[0], m.at[2], m.cap * .75] as const)), moss, '#2f7a64', 'Cave moss', [teal, violet]);
  kit.pitRim();

  // GLOWING POOL: a ring of mossy rim stones round a still, glowing surface.
  const { at: poolAt, radius: poolR } = HALL.pool;
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2 + r() * .2;
    place('Pool_Stone', [poolAt[0] + Math.cos(a) * poolR, 0, poolAt[2] + Math.sin(a) * poolR], -a + Math.PI / 2, .95 + r() * .25);
  }
  const water = new THREE.CircleGeometry(poolR - .25, 28).rotateX(-Math.PI / 2).toNonIndexed(); water.translate(poolAt[0], .3, poolAt[2]); water.computeVertexNormals();
  add(new THREE.Mesh(colour(water, () => new THREE.Color('#9ff7ee')), glow('Cave glow pool', '#3fe3d2', .9)), 'Cave glow pool');
  box([poolAt[0], .25, poolAt[2]], [poolR * .8, .25, poolR * .8]);

  kit.hangers(22, [teal, violet], moss, '#2c5d58');

  for (const m of HALL.mushrooms) place(m.tint === 'teal' ? 'Mushroom_Teal' : 'Mushroom_Violet', m.at, m.yaw, m.height);
  kit.services();
  // Crystals and small mushroom clumps along the wall feet.
  kit.wallFoot(34, () => r() < .35
    ? { name: 'Crystal_Cluster', scale: () => .9 + r() * .7 }
    : { name: 'Mushroom_Cluster', scale: () => .9 + r() * .9 });
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
