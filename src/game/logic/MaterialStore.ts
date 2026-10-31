import { record } from './data.ts';
import { integer } from './numbers.ts';
import type { ItemBatch } from './Inventory.ts';
export type MaterialStoreData = { version: 1; items: Record<string, number> };
/** 材料仓: the minerals the world tickets ask for, kept apart from the bag (they take no space and are never sold)
 *  until a ticket is paid. Only the ones the player locked in the bag come in (2026-10-31: early on they are worth
 *  selling), and only while a ticket still lacks them; the rest goes to the bag. A full one stays until paid. */
export class MaterialStore {
  private items = new Map<string, number>();
  constructor(items: Readonly<Record<string, number>> = {}) {
    for (const [id, count] of Object.entries(items)) if (integer(count, '材料数量')) this.items.set(id, count);
  }
  static fromData(value: unknown) {
    const data = record(value);
    if (data.version !== 1) throw Error('不支持的材料仓版本');
    return new MaterialStore(record(data.items) as Record<string, number>);
  }
  exportData(): MaterialStoreData { return { version: 1, items: Object.fromEntries(this.items) }; }
  count(id: string) { return this.items.get(id) ?? 0; }
  /** What is stored, by mineral. */
  kinds() { return [...this.items.keys()]; }
  /** Gives back everything stored of a mineral (unlocked: back to the bag). */
  release(id: string) { const released = this.count(id); this.items.delete(id); return released; }
  /** Splits a batch: up to `wanted(id)` in all of each mineral goes into the store, the rest is returned for the bag. */
  take(batch: ItemBatch, wanted: (id: string) => number) {
    const stored: { itemId: string; count: number }[] = [], rest: { itemId: string; count: number }[] = [];
    for (const { itemId, count } of batch) {
      const keep = Math.max(0, Math.min(count, wanted(itemId) - this.count(itemId)));
      if (keep) { this.items.set(itemId, this.count(itemId) + keep); stored.push({ itemId, count: keep }); }
      if (count > keep) rest.push({ itemId, count: count - keep });
    }
    return { stored, rest };
  }
  /** Pays as much of a ticket's minerals as the store holds; returns what is left to pay (from the bag). */
  pay(materials: ItemBatch) {
    return materials.map(({ itemId, count }) => {
      const paid = Math.min(count, this.count(itemId)), left = this.count(itemId) - paid;
      if (left) this.items.set(itemId, left); else this.items.delete(itemId);
      return { itemId, count: count - paid };
    }).filter(m => m.count > 0);
  }
  /** Rebirth: the store empties with the worlds. */
  clear() { this.items.clear(); }
}
