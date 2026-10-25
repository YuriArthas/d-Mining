import { versionOne } from './data.ts';
import { integer } from './numbers.ts';
import { ECONOMY } from '../content/economy.ts';
/** Swing speed never passes 4× the first pickaxe's; speed beyond it (the capsule's mining boost) turns into damage. */
const SPEED_CAP = 4 * ECONOMY.tools[0].speed;
/** A pickaxe level's damage and swings per second (economy.json). `speedMultiplier` is everything that mines faster
 *  (the capsule's permanent boost, the pets): it raises the speed up to the cap and keeps the rest as damage, so
 *  damage per second always grows by it. */
export function pickaxeStats(level: number, speedMultiplier = 1) {
  if (!integer(level, '镐子等级') || level > ECONOMY.tools.length) throw new Error('镐子等级无效');
  if (!Number.isFinite(speedMultiplier) || speedMultiplier < 1) throw Error('无效挖矿速度倍率');
  const tool = ECONOMY.tools[level - 1], uncappedSpeed = tool.speed * speedMultiplier;
  const speed = Math.min(SPEED_CAP, uncappedSpeed);
  const power = integer(Math.round(tool.power * uncappedSpeed / speed), '力量');
  const faster = ECONOMY.tools.find(t => t.level > level && t.speed > tool.speed);
  return Object.freeze({ level, basePower: tool.power, power, speed, uncappedSpeed,
    overflowPower: power - tool.power, levelsUntilSpeed: faster ? faster.level - level : null });
}
export class Pickaxe {
  private snapshot;
  constructor(level = 1) { this.snapshot = pickaxeStats(level); }
  exportData() { return { version: 1 as const, level: this.snapshot.level }; }
  static fromData(value: unknown) { return new Pickaxe(versionOne(value).level as number); }
  getSnapshot = () => this.snapshot;
  setLevel(level: number) { this.snapshot = pickaxeStats(level); }
}
