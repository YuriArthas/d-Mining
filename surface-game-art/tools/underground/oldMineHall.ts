// Offline: the 老矿井 rest hall on the shared cave shell (caveKit.ts), with props from build_old_mine.py.
import { caveKit, glow, matte, type GetProp } from './caveKit.ts';
import { OLD_MINE_HALL as HALL } from '../../../src/game/content/underground/oldMineHall.ts';

export function buildHall(getProp: GetProp) {
  const kit = caveKit(HALL, 40001, { rock: ['#7a5f4a', '#a07c5c'], upper: ['#8a6c52', '#5e4836'], ceiling: ['#4e3c2e', '#6e5440'], stalactite: ['#6a5240', '#9a7a5c'], joint: '#3a2c22', stones: ['#8c7a66', '#97846e', '#7f6e5c', '#8a7f70'], curb: '#857260' });
  kit.useProps(getProp);
  const a = glow('Cave glow amber', '#ffb45a', 1.1), b = glow('Cave glow ember', '#ff8a3c', 1.0), ground = matte('Cave dirt');
  kit.walls();
  kit.ceiling(60, [a, b], .2);
  kit.floor();
  kit.patches(kit.wallSpots(22), ground, '#6e5a44', 'Cave dirt', [a, b]);
  kit.pitRim();
  kit.hangers(14, [a, b], ground, '#6e5a44');
  kit.services();
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
