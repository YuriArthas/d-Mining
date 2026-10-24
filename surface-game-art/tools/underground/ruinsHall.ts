// Offline: the 地下遗迹 rest hall on the shared cave shell (caveKit.ts), with props from build_ruins.py.
import { caveKit, glow, matte, type GetProp } from './caveKit.ts';
import { RUINS_HALL as HALL } from '../../../src/game/content/underground/ruinsHall.ts';

export function buildHall(getProp: GetProp) {
  const kit = caveKit(HALL, 160001, { rock: ['#8a7458', '#b0956e'], upper: ['#9a8262', '#6a573f'], ceiling: ['#54452f', '#75614a'], stalactite: ['#7a6650', '#a8906e'], joint: '#3c3122', stones: ['#b8a07a', '#c2aa82', '#ab9470', '#b5a283'], curb: '#a89070' });
  kit.useProps(getProp);
  const a = glow('Cave glow jade', '#6ff0b0', 1.1), b = glow('Cave glow flame', '#ffb45c', 1.1), ground = matte('Cave moss');
  kit.walls();
  kit.ceiling(60, [a, b], .2);
  kit.floor();
  kit.patches(kit.wallSpots(22), ground, '#5a7a3a', 'Cave moss', [a, b]);
  kit.pitRim();
  kit.hangers(14, [a, b], ground, '#5a7a3a');
  kit.services();
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
