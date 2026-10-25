import { PetCatalog } from '../logic/pets/PetCatalog.ts';
import { PetInventory } from '../logic/pets/PetInventory.ts';
import { PetEquipment } from '../logic/pets/PetEquipment.ts';
import { calculatePetBonus, drawEgg, selectBestPets } from '../logic/pets/petRules.ts';
import { petId, petRecord, readPet, type EquipResult, type PetBonus, type PetContent, type PetInstance, type PetStateDataV1 } from '../logic/pets/types.ts';
import type { Wallet } from '../logic/Wallet.ts';
import type { CurrencyId } from '../content/economy.ts';

export type HatchResult =
  | Readonly<{ status: 'hatched'; eggId: string; pet: PetInstance; spent: number; currency: CurrencyId }>
  | Readonly<{ status: 'unknown-egg' | 'insufficient-coins' | 'locked' | 'unavailable' }>;
export type EquipOwnedResult = EquipResult | Readonly<{ status: 'not-owned' }>;
export type MergeResult = Readonly<{ status: 'merged'; pet: PetInstance }> | Readonly<{ status: 'not-enough' | 'unknown' }>;
type PetServiceDependencies = {
  content: PetContent;
  wallet: Pick<Wallet, 'getBalance' | 'debit'>;
  random: () => number;
  createPetId: () => string;
  hasDestination?: (id: string) => boolean;
  /** Whether a world is open (an egg of a later world waits for it). */
  worldOpen?: (world: number) => boolean;
  /** The current world's currency: "equip best" picks for it. */
  currency?: () => CurrencyId;
  lucky?: () => boolean;
};

// Synchronous use cases only. Neither rendering nor event delivery runs inside settlement.
export class PetService {
  readonly catalog: PetCatalog;
  private inventory = new PetInventory();
  private equipment: PetEquipment;
  private readonly deps: PetServiceDependencies;
  private bonus: PetBonus = Object.freeze({ gold: 0, tech: 0, star: 0, mining: 0 });

  constructor(deps: PetServiceDependencies) {
    this.deps = { ...deps };
    this.catalog = new PetCatalog(deps.content);
    this.equipment = new PetEquipment(this.catalog.content.equipSlots);
  }
  getInventory = () => this.inventory.getSnapshot();
  getEquipment = () => this.equipment.getSnapshot();
  getBonus = () => this.bonus;
  isUnlocked = (eggId: string) => {
    const egg = this.catalog.egg(eggId);
    return !!egg && (!egg.requiredWorld || egg.requiredWorld === 1 || this.deps.worldOpen?.(egg.requiredWorld) === true)
      && (!egg.requiredDestination || this.deps.hasDestination?.(egg.requiredDestination) === true);
  };
  effectiveEgg = (eggId: string) => {
    const egg = this.catalog.egg(eggId);
    if (!egg || !this.deps.lucky?.()) return egg;
    const rare = egg.outcomes.reduce((sum,o) => sum+(this.catalog.pet(o.speciesId).rarity==='common'?0:o.weight),0);
    const common = egg.outcomes.reduce((sum,o) => sum+(this.catalog.pet(o.speciesId).rarity==='common'?o.weight:0),0);
    // Double the rare-or-better TOTAL probability, taking the difference from
    // common outcomes while preserving relative weights inside each group.
    return {...egg,outcomes:egg.outcomes.map(o => ({...o,weight:this.catalog.pet(o.speciesId).rarity==='common'?o.weight*Math.max(0,common-rare):o.weight*(common>rare?2*common:1)}))};
  };
  get lucky() { return this.deps.lucky?.() ?? false; }
  hatch(eggId: string): HatchResult {
    const egg = this.effectiveEgg(eggId);
    if (!egg) return { status: 'unknown-egg' };
    if (!this.isUnlocked(eggId)) return { status: 'locked' };
    if (this.deps.wallet.getBalance(egg.currency) < egg.price) return { status: 'insufficient-coins' };
    const speciesId = drawEgg(egg, this.deps.random());
    const id = petId(this.deps.createPetId());
    if (this.inventory.has(id)) throw Error(`重复宠物实例: ${id}`);
    const pet = readPet({ id, speciesId, level: 1 });
    if (!this.deps.wallet.debit(egg.currency, egg.price)) return { status: 'insufficient-coins' };
    this.inventory.add([pet]);
    return Object.freeze({ status: 'hatched', eggId, pet, spent: egg.price, currency: egg.currency });
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
    const slots = this.getEquipment().slots.length;
    const ids = selectBestPets(this.getInventory().pets, id => this.catalog.pet(id), slots, this.deps.currency?.() ?? 'gold');
    const changed = this.equipment.replace(Array.from({ length: slots }, (_, index) => ids[index] ?? null));
    if (changed) this.refreshBonus();
    return changed;
  }
  /** Identical ordinary pets of a species owned, towards a golden one. */
  mergeable(speciesId: string) { return this.getInventory().pets.filter(p => p.speciesId === speciesId && !p.golden).length; }
  /** Merges `goldenNeed` identical ordinary pets into one golden pet, unequipped ones first; the golden pet takes the
   *  slot of an equipped one it replaced. */
  mergeGolden(speciesId: string): MergeResult {
    try { this.catalog.pet(speciesId); } catch { return { status: 'unknown' }; }
    const need = this.catalog.content.goldenNeed ?? 5, slots = this.getEquipment().slots;
    const candidates = this.getInventory().pets.filter(p => p.speciesId === speciesId && !p.golden)
      .sort((a, b) => Number(slots.includes(a.id)) - Number(slots.includes(b.id)) || (a.id < b.id ? -1 : 1)).slice(0, need);
    if (candidates.length < need) return { status: 'not-enough' };
    const id = petId(this.deps.createPetId());
    if (this.inventory.has(id)) throw Error(`重复宠物实例: ${id}`);
    const golden = readPet({ id, speciesId, level: 1, golden: true }), removed = new Set(candidates.map(p => p.id));
    const freed = slots.findIndex(slot => slot !== null && removed.has(slot));
    this.inventory.remove([...removed]); this.inventory.add([golden]);
    this.equipment.replace(slots.map((slot, i) => i === freed ? golden.id : slot !== null && removed.has(slot) ? null : slot));
    this.refreshBonus();
    return Object.freeze({ status: 'merged', pet: golden });
  }
  /** One more equipment slot (bought); false once at the most. */
  addSlot(): boolean {
    if (this.getEquipment().slots.length >= (this.catalog.content.maxEquipSlots ?? this.catalog.content.equipSlots)) return false;
    this.equipment = this.equipment.widen(); return true;
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
    const equipment = PetEquipment.fromData(data.equipment, this.catalog.content.equipSlots, this.catalog.content.maxEquipSlots);
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
