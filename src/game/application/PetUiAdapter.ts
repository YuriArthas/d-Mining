import type { PetInstance, PetRarity, PetBonus, MiningStats } from '../logic/pets/types.ts';
import type { PetService, HatchResult, EquipOwnedResult } from './PetService.ts';

export type PetCardView = Readonly<{
  pet: PetInstance; name: string; rarity: PetRarity; powerBonusBps: number; equippedSlot: number | null;
}>;
export type EggOfferView = Readonly<{
  id: string; name: string; price: number; canAfford: boolean;
  outcomes: readonly Readonly<{ speciesId: string; name: string; rarity: PetRarity; probability: number; powerBonusBps: number }>[];
}>;
export type PetPanelSnapshot = Readonly<{
  coins: number;
  pets: readonly PetCardView[];
  slots: readonly (string | null)[];
  bonus: PetBonus;
  baseStats: MiningStats;
  effectiveStats: MiningStats;
  eggs: readonly EggOfferView[];
}>;
export interface PetUiApi {
  getSnapshot(): PetPanelSnapshot;
  subscribe(listener: () => void): () => void;
  hatch(eggId: string): HatchResult;
  equip(id: string): EquipOwnedResult;
  unequip(id: string): boolean;
  equipBest(): boolean;
  unequipAll(): boolean;
}
type PetUiPorts = {
  balance(): number;
  baseStats(): MiningStats;
  effectiveStats(): MiningStats;
  publish(): void;
  subscribe(listener: () => void): () => void;
};

export class PetUiAdapter implements PetUiApi {
  private readonly service: PetService;
  private readonly ports: PetUiPorts;
  private inventory;
  private equipment;
  private snapshot: PetPanelSnapshot | null = null;

  constructor(service: PetService, ports: PetUiPorts) {
    this.service = service; this.ports = ports;
    this.inventory = service.getInventory(); this.equipment = service.getEquipment();
  }
  getSnapshot = (): PetPanelSnapshot => {
    const inventory = this.service.getInventory(), equipment = this.service.getEquipment();
    const coins = this.ports.balance(), baseStats = this.ports.baseStats(), previous = this.snapshot;
    if (previous && inventory === this.inventory && equipment === this.equipment && previous.coins === coins && previous.baseStats === baseStats) return previous;
    const catalog = this.service.catalog;
    const equippedSlots = new Map(equipment.slots.map((id, slot) => [id, slot]));
    const pets = previous && inventory === this.inventory && equipment === this.equipment ? previous.pets : Object.freeze(inventory.pets.map(pet => {
      const definition = catalog.pet(pet.speciesId);
      return Object.freeze({ pet, name: definition.name, rarity: definition.rarity, powerBonusBps: definition.powerBonusBps, equippedSlot: equippedSlots.get(pet.id) ?? null });
    }));
    const eggs = previous?.coins === coins ? previous.eggs : Object.freeze(catalog.content.eggs.map(egg => {
      const total = egg.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
      return Object.freeze({
        id: egg.id, name: egg.name, price: egg.price, canAfford: coins >= egg.price,
        outcomes: Object.freeze(egg.outcomes.map(outcome => {
          const pet = catalog.pet(outcome.speciesId);
          return Object.freeze({ speciesId: pet.id, name: pet.name, rarity: pet.rarity, probability: outcome.weight / total, powerBonusBps: pet.powerBonusBps });
        })),
      });
    }));
    this.inventory = inventory; this.equipment = equipment;
    return this.snapshot = Object.freeze({ coins, pets, slots: equipment.slots, bonus: this.service.getBonus(), baseStats, effectiveStats: this.ports.effectiveStats(), eggs });
  };
  // Each subscriber owns exactly one session subscription, released on UI unmount.
  subscribe = (listener: () => void) => {
    let previous = this.getSnapshot();
    return this.ports.subscribe(() => {
      const next = this.getSnapshot();
      if (next !== previous) { previous = next; listener(); }
    });
  };
  hatch = (eggId: string) => {
    const result = this.service.hatch(eggId);
    if (result.status === 'hatched') this.ports.publish();
    return result;
  };
  equip = (id: string) => {
    const result = this.service.equip(id);
    if (result.status === 'equipped') this.ports.publish();
    return result;
  };
  unequip = (id: string) => this.publishChange(this.service.unequip(id));
  equipBest = () => this.publishChange(this.service.equipBest());
  unequipAll = () => this.publishChange(this.service.unequipAll());
  private publishChange(changed: boolean) {
    if (changed) this.ports.publish();
    return changed;
  }
}
