import { record } from './data.ts';
import { integer } from './numbers.ts';
import { ECONOMY } from '../content/economy.ts';

/** Rebirth (economy.json `rebirth`): once the journey is complete (world 3's last layer reached with the last
 *  pickaxe), every currency, the tool, the backpack, the worlds and the layers start over; pets and pet slots stay.
 *  Each rebirth raises what ore sells for in every currency: ×1.5, ×2, ×2.5, ... */
export type RebirthData = { version: 2; count: number };
export const rebirthMultiplier = (count: number) => 1 + count * ECONOMY.rebirth.stepPct / 100;
export class RebirthRecord {
  count: number;
  constructor(data?: unknown) {
    const saved = data === undefined ? null : record(data);
    if (saved && saved.version !== 2) throw Error('不支持的重生记录版本');
    this.count = saved ? integer(saved.count as number, '重生次数') : 0;
  }
  exportData(): RebirthData { return { version: 2, count: this.count }; }
}
