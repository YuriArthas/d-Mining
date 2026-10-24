// Offline: the 水晶洞穴 rest hall on the shared cave shell (caveKit.ts), with props from build_crystal.py.
import { caveKit, glow, matte, type GetProp } from './caveKit.ts';
import { CRYSTAL_HALL as HALL } from '../../../src/game/content/underground/crystalHall.ts';

export function buildHall(getProp: GetProp) {
  const kit = caveKit(HALL, 120001, { rock: ['#4f5f8a', '#6f7fb8'], upper: ['#5d6aa0', '#3e4778'], ceiling: ['#333a66', '#4b558e'], stalactite: ['#56609a', '#8a96d8'], joint: '#22283f', stones: ['#6a7aa0', '#7484aa', '#606f96', '#6f7a9a'], curb: '#6c78a0' });
  kit.useProps(getProp);
  const a = glow('Cave glow cyan', '#5ee8ff', 1.2), b = glow('Cave glow pink', '#ff7ad8', 1.1), ground = matte('Cave crystal sand');
  kit.walls();
  kit.ceiling(60, [a, b], .2);
  kit.floor();
  kit.patches(kit.wallSpots(22), ground, '#4a5a8a', 'Cave crystal sand', [a, b]);
  kit.pitRim();
  kit.hangers(14, [a, b], ground, '#4a5a8a');
  kit.services();
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
