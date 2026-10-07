import { petId, petRecord, readPet, type PetInstance, type PetInventoryDataV1, type PetInventorySnapshot } from './types.ts';

export class PetInventory {
  private readonly pets = new Map<string, PetInstance>();
  private snapshot: PetInventorySnapshot = Object.freeze({ pets: Object.freeze([]), count: 0 });
  get(id: string): PetInstance | null { return this.pets.get(id) ?? null; }
  has(id: string): boolean { return this.pets.has(id); }
  getSnapshot = (): PetInventorySnapshot => this.snapshot;

  add(pets: readonly PetInstance[]): void {
    const batch = pets.map(readPet), seen = new Set<string>();
    for (const pet of batch) {
      if (seen.has(pet.id) || this.pets.has(pet.id)) throw Error(`重复宠物实例: ${pet.id}`);
      seen.add(pet.id);
    }
    if (!batch.length) return;
    for (const pet of batch) this.pets.set(pet.id, pet);
    this.refresh();
  }
  remove(ids: readonly string[]): boolean {
    const seen = new Set<string>();
    for (const id of ids) {
      petId(id);
      if (seen.has(id)) throw Error(`重复移除宠物: ${id}`);
      seen.add(id);
    }
    if (ids.some(id => !this.pets.has(id))) return false;
    if (ids.length) { for (const id of ids) this.pets.delete(id); this.refresh(); }
    return true;
  }
  exportData(): PetInventoryDataV1 {
    return { version: 1, pets: [...this.pets.values()].map(pet => ({ ...pet })) };
  }
  static fromData(value: unknown): PetInventory {
    const data = petRecord(value);
    if (data.version !== 1 || !Array.isArray(data.pets)) throw Error('无效宠物库存版本或数据');
    const inventory = new PetInventory();
    inventory.add(data.pets.map(readPet));
    return inventory;
  }
  private refresh() {
    this.snapshot = Object.freeze({ pets: Object.freeze([...this.pets.values()]), count: this.pets.size });
  }
}
