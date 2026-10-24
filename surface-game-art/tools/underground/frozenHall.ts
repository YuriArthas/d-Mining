// Offline: the 冰封矿洞 rest hall on the shared cave shell (caveKit.ts), with props from build_frozen.py.
import { caveKit, glow, matte, type GetProp } from './caveKit.ts';
import { FROZEN_HALL as HALL } from '../../../src/game/content/underground/frozenHall.ts';

export function buildHall(getProp: GetProp) {
  const kit = caveKit(HALL, 200001, { rock: ['#6f8fae', '#a6c4e0'], upper: ['#87a6c6', '#5c7a9c'], ceiling: ['#46607e', '#6684a6'], stalactite: ['#9ec4e6', '#e0f4ff'], joint: '#30445c', stones: ['#a8c0d6', '#b4cade', '#9cb4cc', '#b0c4d4'], curb: '#9ab2c8' });
  kit.useProps(getProp);
  const a = glow('Cave glow ice', '#8fe8ff', 1.1), b = glow('Cave glow frost', '#c8f4ff', 1.0), ground = matte('Cave snow');
  kit.walls();
  kit.ceiling(60, [a, b], .2);
  kit.floor();
  kit.patches(kit.wallSpots(22), ground, '#e8f2fa', 'Cave snow', [a, b]);
  kit.pitRim();
  kit.hangers(14, [a, b], ground, '#e8f2fa');
  kit.services();
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}
