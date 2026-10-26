import { record } from './data.ts';
import { integer } from './numbers.ts';
import type { ItemBatch } from './Inventory.ts';
export type MaterialStoreData = { version: 1; items: Record<string, number> };
/** 材料仓: the minerals the world tickets ask for, kept apart from the bag (they take no space and are never sold)
 *  until a ticket is paid. Ore comes in only while a ticket still lacks it; the rest goes to the bag. */
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
  /** Splits a batch: up to `wanted(id)` more of each mineral goes into the store, the rest is returned for the bag. */
  take(batch: ItemBatch, wanted: (id: string) => number) {
    const stored: { itemId: string; count: number }[] = [], rest: { itemId: string; count: number }[] = [];
    for (const { itemId, count } of batch) {
      const keep = Math.max(0, Math.min(count, wanted(itemId) - this.count(itemId)));
      if (keep) { this.items.set(itemId, this.count(itemId) + keep); stored.push({ itemId, count: keep }); }
      if (count > keep) rest.push({ itemId, count: count - keep });
    }
    return { stored, rest };
  }
  /** Pays a ticket's minerals: all of them, or nothing when one falls short. */
  pay(materials: ItemBatch) {
    if (materials.some(m => this.count(m.itemId) < m.count)) return false;
    for (const { itemId, count } of materials) { const left = this.count(itemId) - count; if (left) this.items.set(itemId, left); else this.items.delete(itemId); }
    return true;
  }
  /** Rebirth: the store empties with the worlds. */
  clear() { this.items.clear(); }
}
