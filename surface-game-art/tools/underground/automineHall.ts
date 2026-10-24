// Offline: 自动化矿道 (world 2, layer 1) on the shared cave shell (caveKit.ts), props from build_automine.py.
import { caveKit, glow, matte, type GetProp } from './caveKit.ts';
import { AUTOMINE_HALL as HALL } from '../../../src/game/content/underground/automineHall.ts';

export function buildHall(getProp: GetProp) {
  const kit = caveKit(HALL, 410001, {
    rock: ['#5e6670', '#8a929c'], upper: ['#6a727c', '#454c56'], ceiling: ['#383e48', '#525a66'],
    stalactite: ['#565e68', '#868e98'], joint: '#22262e', stones: ['#8a929e', '#949ca8', '#808894', '#8e96a0'], curb: '#f2c230',
  });
  kit.useProps(getProp);
  const cyan = glow('Cave glow cyan', '#5ee8ff', 1.1), orange = glow('Cave glow orange', '#ff9a2e', 1.0), grit = matte('Cave grit');
  kit.walls();
  kit.ceiling(40, [cyan, orange], .15);
  kit.floor({ kind: 'shards', size: 2.4, gap: .1 });
  kit.patches(kit.wallSpots(14), grit, '#4a5058', 'Cave grit');
  kit.pitRim();
  kit.services();
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
