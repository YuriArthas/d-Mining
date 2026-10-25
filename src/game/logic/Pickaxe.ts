import { versionOne } from './data.ts';
import { integer } from './numbers.ts';
import { ECONOMY } from '../content/economy.ts';
/** Swing speed never passes 4× the first pickaxe's; speed beyond it (the capsule's mining boost) turns into damage. */
const SPEED_CAP = 4 * ECONOMY.tools[0].speed;
/** A pickaxe level's damage and swings per second (economy.json). `speedMultiplier` is everything that mines faster
 *  (the capsule's permanent boost, the pets): it raises the speed up to the cap and keeps the rest as damage, so
 *  damage per second always grows by it. */
export function pickaxeStats(level: number, speedMultiplier = 1, enhance = 0) {
  if (!integer(level, '镐子等级') || level > ECONOMY.tools.length) throw new Error('镐子等级无效');
  if (!Number.isFinite(speedMultiplier) || speedMultiplier < 1) throw Error('无效挖矿速度倍率');
  const tool = ECONOMY.tools[level - 1];
  if (integer(enhance, '强化等级') > tool.enhance.length) throw Error('强化等级无效');
  // An enhancement (+1..+3) raises the damage only; the model, the gate level and the speed stay the pickaxe's.
  const basePower = enhance ? tool.enhance[enhance - 1].power : tool.power, uncappedSpeed = tool.speed * speedMultiplier;
  const speed = Math.min(SPEED_CAP, uncappedSpeed);
  const power = integer(Math.round(basePower * uncappedSpeed / speed), '力量');
  const faster = ECONOMY.tools.find(t => t.level > level && t.speed > tool.speed);
  return Object.freeze({ level, enhance, basePower, power, speed, uncappedSpeed,
    overflowPower: power - basePower, levelsUntilSpeed: faster ? faster.level - level : null });
}
export class Pickaxe {
  private snapshot;
  constructor(level = 1, enhance = 0) { this.snapshot = pickaxeStats(level, 1, enhance); }
  exportData() { return { version: 1 as const, level: this.snapshot.level, enhance: this.snapshot.enhance }; }
  static fromData(value: unknown) { const data = versionOne(value); return new Pickaxe(data.level as number, (data.enhance ?? 0) as number); }
  getSnapshot = () => this.snapshot;
  /** Equips a pickaxe: `enhance` is how far that one is enhanced (only the newest one ever is). */
  setLevel(level: number, enhance = 0) { this.snapshot = pickaxeStats(level, 1, enhance); }
}
