import type { ItemBatch } from '../logic/Inventory.ts';
export type MineResult = 'accepted' | 'full' | 'unavailable';
// World scheduling stays behind requestWorld. Completed excavation never rechecks capacity.
export class Mining<Target, Resource> {
  private inventory: { isFull(): boolean; add(items: ItemBatch): void };
  private requestWorld: (targets: readonly Target[]) => boolean;
  private drops: (resources: readonly Resource[]) => ItemBatch;
  constructor(inventory: Mining<Target, Resource>['inventory'], requestWorld: Mining<Target, Resource>['requestWorld'], drops: Mining<Target, Resource>['drops']) {
    this.inventory = inventory; this.requestWorld = requestWorld; this.drops = drops;
  }
  request(targets: readonly Target[]): MineResult {
    if (this.inventory.isFull()) return 'full';
    return this.requestWorld(targets) ? 'accepted' : 'unavailable';
  }
  collected(resources: readonly Resource[]) { this.inventory.add(this.drops(resources)); }
}
