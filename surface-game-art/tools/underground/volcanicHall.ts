// Offline: the 熔岩矿洞 rest hall on the shared cave shell (caveKit.ts), with props from build_volcanic.py.
import { caveKit, glow, matte, type GetProp } from './caveKit.ts';
import { VOLCANIC_HALL as HALL } from '../../../src/game/content/underground/volcanicHall.ts';

export function buildHall(getProp: GetProp) {
  const kit = caveKit(HALL, 240001, { rock: ['#4a3c3c', '#6a5450'], upper: ['#56443f', '#3a2e2c'], ceiling: ['#2e2424', '#463634'], stalactite: ['#4a3a36', '#7a5a4a'], joint: '#1a1212', stones: ['#5a4f4c', '#655854', '#524846', '#5e5450'], curb: '#5a4c48' });
  kit.useProps(getProp);
  const a = glow('Cave glow lava', '#ff7a2a', 1.3), b = glow('Cave glow ember', '#ffb040', 1.1), ground = matte('Cave ash');
  kit.walls();
  kit.ceiling(60, [a, b], .2);
  kit.floor();
  kit.patches(kit.wallSpots(22), ground, '#3a3030', 'Cave ash', [a, b]);
  kit.pitRim();
  kit.hangers(14, [a, b], ground, '#3a3030');
  kit.services();
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
