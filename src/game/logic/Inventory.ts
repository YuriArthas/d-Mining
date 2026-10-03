import { integer } from './numbers.ts';
export type ItemBatch = readonly Readonly<{ itemId: string; count: number }>[];
export type UnitVolume = (itemId: string) => number;
export type InventoryDataV1 = { version: 1; capacity: number; items: Record<string, number> };
export type InventorySnapshot = Readonly<{ capacity: number; used: number; totalCount: number; isFull: boolean; items: Readonly<Record<string, number>> }>;
const oneUnit: UnitVolume = () => 1;
function counts(batch: ItemBatch) {
  const result = new Map<string, number>();
  for (const { itemId, count } of batch) {
    if (typeof itemId !== 'string' || !itemId.length || integer(count) === 0) throw new Error('物品 ID 不能为空，数量必须大于 0');
    result.set(itemId, integer((result.get(itemId) ?? 0) + count));
  }
  return result;
}
export class Inventory {
  private items = new Map<string, number>();
  private snapshot: InventorySnapshot;
  private capacityValue: number;
  // Item definitions are fixed for this inventory's lifetime; no mineral/price dependency.
  private readonly unitVolume: UnitVolume;
  get capacity() { return this.capacityValue; }
  constructor(capacity: number, unitVolume: UnitVolume = oneUnit) {
    this.capacityValue = integer(capacity, '容量'); this.unitVolume = unitVolume;
    this.snapshot = this.makeSnapshot(this.items, capacity);
  }
  // Changing capacity never removes contents or imposes a limit on add().
  setCapacity(capacity: number) {
    integer(capacity, '容量');
    if (capacity === this.capacityValue) return;
    const snapshot = this.makeSnapshot(this.items, capacity);
    this.capacityValue = capacity; this.snapshot = snapshot;
  }
  private makeSnapshot(items: ReadonlyMap<string, number>, capacity: number): InventorySnapshot {
    let used = 0, totalCount = 0;
    for (const [id, count] of items) {
      const volume = integer(this.unitVolume(id), '物品体积');
      if (!volume) throw new Error('物品体积必须大于 0');
      used = integer(used + integer(count * volume, '占用体积'), '占用体积');
      totalCount = integer(totalCount + count, '物品总数');
    }
    return Object.freeze({ capacity, used, totalCount, isFull: used >= capacity, items: Object.freeze(Object.fromEntries(items)) });
  }
  private commit(items: Map<string, number>) {
    // Resolve/validate the entire batch before changing either contents or snapshot.
    const snapshot = this.makeSnapshot(items, this.capacity);
    this.items = items; this.snapshot = snapshot;
  }
  getSnapshot = () => this.snapshot;
  isFull() { return this.snapshot.isFull; }
  // Capacity is information, never an admission rule. Every valid batch is added.
  add(batch: ItemBatch) {
    const incoming = counts(batch);
    if (!incoming.size) return;
    const next = new Map(this.items);
    for (const [id, count] of incoming) next.set(id, integer((next.get(id) ?? 0) + count));
    this.commit(next);
  }
  remove(batch: ItemBatch): boolean {
    const outgoing = counts(batch);
    for (const [id, count] of outgoing) if ((this.items.get(id) ?? 0) < count) return false;
    if (!outgoing.size) return true;
    const next = new Map(this.items);
    for (const [id, count] of outgoing) {
      const left = next.get(id)! - count;
      if (left) next.set(id, left); else next.delete(id);
    }
    this.commit(next); return true;
  }
  // Save quantities and capacity, never derived used/count/full or copied item definitions.
  exportData(): InventoryDataV1 { return { version: 1, capacity: this.capacity, items: { ...this.snapshot.items } }; }
  static fromData(value: unknown, unitVolume: UnitVolume = oneUnit) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('背包数据格式错误');
    const data = value as InventoryDataV1;
    if (data.version !== 1 || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) throw new Error('背包版本或物品数据错误');
    const inventory = new Inventory(data.capacity, unitVolume);
    inventory.add(Object.entries(data.items).map(([itemId, count]) => ({ itemId, count })));
    return inventory;
  }
}
