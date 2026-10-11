import { versionOne } from './data.ts';
import { integer } from './numbers.ts';
export const PICKAXE_BALANCE = Object.freeze({ basePower: 10, powerPerLevel: 5, baseSpeed: 2, speedEvery: 5, speedMultiplier: 2, maxSpeed: 16 });
export function pickaxeStats(level: number) {
  if (!integer(level, '镐子等级')) throw new Error('镐子等级必须大于 0');
  const c = PICKAXE_BALANCE;
  const basePower = integer(c.basePower + (level - 1) * c.powerPerLevel, '基础力量');
  const uncappedSpeed = integer(c.baseSpeed * c.speedMultiplier ** Math.floor((level - 1) / c.speedEvery), '理论攻速');
  const speed = Math.min(c.maxSpeed, uncappedSpeed);
  // Preserve uncapped damage per second after the attack-rate cap. Round once,
  // before pet bonuses; use integer arithmetic even for large saved levels.
  const power = integer(Number(BigInt(basePower) * BigInt(uncappedSpeed) / BigInt(speed)), '力量');
  return Object.freeze({ level, basePower, power, speed, uncappedSpeed,
    overflowPower: power - basePower, levelsUntilSpeed: speed >= c.maxSpeed ? null : c.speedEvery - (level - 1) % c.speedEvery });
}
export class Pickaxe {
  private snapshot;
  constructor(level = 1) { this.snapshot = pickaxeStats(level); }
  exportData() { return { version: 1 as const, level: this.snapshot.level }; }
  static fromData(value: unknown) { return new Pickaxe(versionOne(value).level as number); }
  getSnapshot = () => this.snapshot;
  setLevel(level: number) { this.snapshot = pickaxeStats(level); }
}
