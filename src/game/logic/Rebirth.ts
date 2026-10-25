import { versionOne } from './data.ts';
import { integer } from './numbers.ts';

/** Rebirth trades every coin, the tool and the backpack for a bigger coin multiplier on ore sales.
 *  First values from the user (2026-10-25), to be tuned with the rest of the economy: the first rebirth costs
 *  400M and sells at ×10, each next one adds ×10; the price grows factorially (400M, 800M, 2.4B, 9.6B, ...). */
export const REBIRTH = { firstCost: 400_000_000, step: 10 } as const;
export type RebirthData = { version: 1; count: number; offered: boolean };

/** The coin multiplier after `count` rebirths: ×1, then ×10, ×20, ×30, ... */
export const rebirthMultiplier = (count: number) => count === 0 ? 1 : REBIRTH.step * count;
/** What the next rebirth costs after `count` of them: 400M × (count + 1)!; null once past a safe integer. */
export function rebirthCost(count: number) {
  let cost = REBIRTH.firstCost;
  for (let k = 2; k <= count + 1; k++) cost *= k;
  return Number.isSafeInteger(cost) ? cost : null;
}

export class RebirthRecord {
  count: number;
  /** Shown once the player first got near the price; the HUD button stays from then on. */
  offered: boolean;
  constructor(data?: unknown) {
    const saved = data === undefined ? null : versionOne(data);
    this.count = saved ? integer(saved.count as number, '重生次数') : 0;
    this.offered = saved ? saved.offered === true : false;
  }
  exportData(): RebirthData { return { version: 1, count: this.count, offered: this.offered }; }
}
