import { PetCatalog } from '../logic/pets/PetCatalog.ts';
import { PetInventory } from '../logic/pets/PetInventory.ts';
import { PetEquipment } from '../logic/pets/PetEquipment.ts';
import { calculatePetBonus, drawEgg, selectBestPets } from '../logic/pets/petRules.ts';
import { petId, petRecord, readPet, type EquipResult, type PetBonus, type PetContent, type PetInstance, type PetStateDataV1 } from '../logic/pets/types.ts';
import type { Wallet } from '../logic/Wallet.ts';

export type HatchResult =
  | Readonly<{ status: 'hatched'; eggId: string; pet: PetInstance; spent: number }>
  | Readonly<{ status: 'unknown-egg' | 'insufficient-coins' }>;
export type EquipOwnedResult = EquipResult | Readonly<{ status: 'not-owned' }>;
export type PetServiceDependencies = {
  content: PetContent;
  wallet: Pick<Wallet, 'getBalance' | 'debit'>;
  random: () => number;
  createPetId: () => string;
};

// Synchronous use cases only. Neither rendering nor event delivery runs inside settlement.
export class PetService {
  readonly catalog: PetCatalog;
  private inventory = new PetInventory();
  private equipment: PetEquipment;
  private readonly deps: PetServiceDependencies;
  private bonus: PetBonus = Object.freeze({ powerBonusBps: 0 });

  constructor(deps: PetServiceDependencies) {
    this.deps = { ...deps };
    this.catalog = new PetCatalog(deps.content);
    this.equipment = new PetEquipment(this.catalog.content.equipSlots);
  }
  getInventory = () => this.inventory.getSnapshot();
  getEquipment = () => this.equipment.getSnapshot();
  getBonus = () => this.bonus;
  hatch(eggId: string): HatchResult {
    const egg = this.catalog.egg(eggId);
    if (!egg) return { status: 'unknown-egg' };
    if (this.deps.wallet.getBalance() < egg.price) return { status: 'insufficient-coins' };
    const speciesId = drawEgg(egg, this.deps.random());
    const id = petId(this.deps.createPetId());
    if (this.inventory.has(id)) throw Error(`重复宠物实例: ${id}`);
    const pet = readPet({ id, speciesId, level: 1 });
    if (!this.deps.wallet.debit(egg.price)) return { status: 'insufficient-coins' };
    this.inventory.add([pet]);
    return Object.freeze({ status: 'hatched', eggId, pet, spent: egg.price });
  }
  grant(pets: readonly PetInstance[]): void {
    for (const pet of pets) this.catalog.pet(pet.speciesId);
    this.inventory.add(pets);
  }
  equip(id: string): EquipOwnedResult {
    if (!this.inventory.has(id)) return { status: 'not-owned' };
    const result = this.equipment.equip(id);
    if (result.status === 'equipped') this.refreshBonus();
    return result;
  }
  unequip(id: string): boolean {
    const changed = this.equipment.unequip(id);
    if (changed) this.refreshBonus();
    return changed;
  }
  equipBest(): boolean {
    const ids = selectBestPets(this.getInventory().pets, id => this.catalog.pet(id), this.catalog.content.equipSlots);
    const changed = this.equipment.replace(Array.from({ length: this.catalog.content.equipSlots }, (_, index) => ids[index] ?? null));
    if (changed) this.refreshBonus();
    return changed;
  }
  unequipAll(): boolean {
    const changed = this.equipment.clear();
    if (changed) this.refreshBonus();
    return changed;
  }
  remove(ids: readonly string[]): boolean {
    if (!this.inventory.remove(ids)) return false;
    const removed = new Set(ids);
    if (this.equipment.replace(this.getEquipment().slots.map(id => id !== null && removed.has(id) ? null : id))) this.refreshBonus();
    return true;
  }
  exportData(): PetStateDataV1 {
    return { version: 1, inventory: this.inventory.exportData(), equipment: this.equipment.exportData() };
  }
  restoreData(value: unknown): void {
    const data = petRecord(value);
    if (data.version !== 1) throw Error('无效宠物状态版本');
    const inventory = PetInventory.fromData(data.inventory);
    const equipment = PetEquipment.fromData(data.equipment, this.catalog.content.equipSlots);
    for (const pet of inventory.getSnapshot().pets) this.catalog.pet(pet.speciesId);
    const equipped = equipment.getSnapshot().slots.flatMap(id => {
      if (id === null) return [];
      const pet = inventory.get(id);
      if (!pet) throw Error(`装备引用未拥有宠物: ${id}`);
      return [pet];
    });
    const bonus = calculatePetBonus(equipped, id => this.catalog.pet(id));
    this.inventory = inventory; this.equipment = equipment; this.bonus = bonus;
  }
  private refreshBonus() {
    this.bonus = calculatePetBonus(this.getEquipment().slots.flatMap(id => id === null ? [] : [this.inventory.get(id)!]), id => this.catalog.pet(id));
  }
}
