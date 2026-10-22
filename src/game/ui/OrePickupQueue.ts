import type { ItemBatch } from '../logic/Inventory.ts';

export type OrePickup = Readonly<{ id: number; itemId: string; count: number; revision: number }>;
type Entry = { id: number; itemId: string; count: number; revision: number; expiresAt: number };

// Only collection receipts enter this short-lived queue; inventory snapshots never do.
// Overflow waits its turn, so a wide mining receipt cannot hide individual minerals.
export class OrePickupQueue {
  readonly lifetimeMs = 2200;
  private serial = 0;
  private active: Entry[] = [];
  private pending: Entry[] = [];

  private promote(now: number) {
    while (this.active.length < 4 && this.pending.length) {
      const entry = this.pending.shift()!;
      entry.expiresAt = now + this.lifetimeMs;
      this.active.push(entry);
    }
  }

  advance(now: number) {
    this.active = this.active.filter(entry => entry.expiresAt > now);
    this.promote(now);
    return this.snapshot();
  }

  collect(batch: ItemBatch, now: number) {
    this.advance(now);
    for (const item of batch) {
      const existing = this.active.find(entry => entry.itemId === item.itemId) ?? this.pending.find(entry => entry.itemId === item.itemId);
      if (existing) {
        existing.count += item.count;
        existing.revision++;
        if (this.active.includes(existing)) existing.expiresAt = now + this.lifetimeMs;
      } else {
        this.pending.push({ id: ++this.serial, itemId: item.itemId, count: item.count, revision: 0, expiresAt: 0 });
      }
    }
    this.promote(now);
    return this.snapshot();
  }

  nextExpiry() { return this.active.length ? Math.min(...this.active.map(entry => entry.expiresAt)) : null; }
  snapshot(): readonly OrePickup[] {
    return this.active.map(({ id, itemId, count, revision }) => ({ id, itemId, count, revision }));
  }
}
