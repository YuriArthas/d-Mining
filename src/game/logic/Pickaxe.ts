import { versionOne } from './data.ts';
import { integer } from './numbers.ts';
export const PICKAXE_BALANCE = Object.freeze({ basePower: 10, powerPerLevel: 5, baseSpeed: 2, speedEvery: 5, speedMultiplier: 2, maxSpeed: 16 });
export function pickaxeStats(level: number) {
  if (!integer(level, '镐子等级')) throw new Error('镐子等级必须大于 0');
  const c = PICKAXE_BALANCE;
  const power = integer(c.basePower + (level - 1) * c.powerPerLevel, '力量');
  const speed = Math.min(c.maxSpeed, c.baseSpeed * c.speedMultiplier ** Math.min(Math.floor((level - 1) / c.speedEvery), Math.ceil(Math.log(c.maxSpeed / c.baseSpeed) / Math.log(c.speedMultiplier))));
  return Object.freeze({ level, power, speed, levelsUntilSpeed: speed >= c.maxSpeed ? null : c.speedEvery - (level - 1) % c.speedEvery });
}
export class Pickaxe {
  private snapshot;
  constructor(level = 1) { this.snapshot = pickaxeStats(level); }
  exportData() { return { version: 1 as const, level: this.snapshot.level }; }
  static fromData(value: unknown) { return new Pickaxe(versionOne(value).level as number); }
  getSnapshot = () => this.snapshot;
  setLevel(level: number) { this.snapshot = pickaxeStats(level); }
}
