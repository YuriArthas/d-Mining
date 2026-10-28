import type { PetInstance, PetRarity, PetBonus } from '../logic/pets/types.ts';
import type { PetService, HatchResult, EquipOwnedResult, MergeResult } from './PetService.ts';
import { petStats } from '../logic/pets/petRules.ts';
import type { CurrencyId } from '../content/economy.ts';

import { tr } from '../i18n/i18n.ts';
/** A pet's bonuses: extra income in its own currency (`bonusPct`, only in that world) and faster mining
 *  (`miningPct`, every world), both in percent. */
export type PetCardView = Readonly<{
  pet: PetInstance; name: string; rarity: PetRarity; bonusPct: number; currency: CurrencyId; miningPct: number; equippedSlot: number | null;
  /** A golden pet; for an ordinary one, how many identical ordinary pets are owned towards merging. */
  golden: boolean; mergeable: number;
}>;
type EggOfferView = Readonly<{
  id: string; name: string; price: number; currency: CurrencyId; canAfford: boolean; unlocked: boolean; unlockName?: string;
  outcomes: readonly Readonly<{ speciesId: string; name: string; rarity: PetRarity; probability: number; bonusPct: number; currency: CurrencyId; miningPct: number }>[];
}>;
export type PetPanelSnapshot = Readonly<{
  /** The current world's currency, the one "equip best" and the team bonus are about. */
  currency: CurrencyId;
  balances: Readonly<Record<CurrencyId, number>>;
  pets: readonly PetCardView[];
  slots: readonly (string | null)[];
  bonus: PetBonus;
  eggs: readonly EggOfferView[];
  /** Identical ordinary pets that merge into one golden pet. */
  goldenNeed: number;
}>;
interface PetUiApi {
  getSnapshot(): PetPanelSnapshot;
  subscribe(listener: () => void): () => void;
  hatch(eggId: string): HatchResult;
  equip(id: string): EquipOwnedResult;
  unequip(id: string): boolean;
  equipBest(): boolean;
  unequipAll(): boolean;
  mergeGolden(speciesId: string): MergeResult;
}
type PetUiPorts = {
  balances(): Readonly<Record<CurrencyId, number>>;
  currency(): CurrencyId;
  commands: Pick<PetUiApi, 'hatch' | 'equip' | 'unequip' | 'equipBest' | 'unequipAll' | 'mergeGolden'>;
  subscribe(listener: () => void): () => void;
};

export class PetUiAdapter implements PetUiApi {
  private readonly service: PetService;
  private readonly ports: PetUiPorts;
  private inventory;
  private equipment;
  private snapshot: PetPanelSnapshot | null = null;
  private accessKey = "";

  constructor(service: PetService, ports: PetUiPorts) {
    this.service = service; this.ports = ports;
    this.inventory = service.getInventory(); this.equipment = service.getEquipment();
  }
  getSnapshot = (): PetPanelSnapshot => {
    const inventory = this.service.getInventory(), equipment = this.service.getEquipment();
    const balances = this.ports.balances(), currency = this.ports.currency(), previous = this.snapshot;
    const sameMoney = !!previous && previous.currency === currency && Object.entries(balances).every(([id, n]) => previous.balances[id as CurrencyId] === n);
    const accessKey = `${this.service.lucky}:` + this.service.catalog.content.eggs.map(egg => this.service.isUnlocked(egg.id) ? "1" : "0").join("");
    if (previous && sameMoney && this.accessKey === accessKey && inventory === this.inventory && equipment === this.equipment) return previous;
    const catalog = this.service.catalog;
    const equippedSlots = new Map(equipment.slots.map((id, slot) => [id, slot]));
    const pets = previous && inventory === this.inventory && equipment === this.equipment ? previous.pets : Object.freeze(inventory.pets.map(pet => {
      const definition = petStats(pet, id => catalog.pet(id));
      return Object.freeze({ pet, name: pet.golden ? tr('金色{name}', { name: definition.name }) : definition.name, rarity: definition.rarity, bonusPct: definition.bonusPct, currency: definition.currency,
        miningPct: definition.miningPct, equippedSlot: equippedSlots.get(pet.id) ?? null, golden: !!pet.golden,
        mergeable: pet.golden ? 0 : inventory.pets.filter(p => p.speciesId === pet.speciesId && !p.golden).length });
    }));
    const eggs = previous && sameMoney && this.accessKey === accessKey ? previous.eggs : Object.freeze(catalog.content.eggs.map(original => {
      const egg = this.service.effectiveEgg(original.id)!;
      const total = egg.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
      return Object.freeze({
        id: egg.id, name: egg.name, price: egg.price, currency: egg.currency, canAfford: this.service.isUnlocked(egg.id) && balances[egg.currency] >= egg.price,
        unlocked: this.service.isUnlocked(egg.id), unlockName: egg.unlockName,
        outcomes: Object.freeze(egg.outcomes.map(outcome => {
          const pet = catalog.pet(outcome.speciesId);
          return Object.freeze({ speciesId: pet.id, name: pet.name, rarity: pet.rarity, probability: outcome.weight / total, bonusPct: pet.bonusPct, currency: pet.currency, miningPct: pet.miningPct });
        })),
      });
    }));
    this.accessKey = accessKey;
    this.inventory = inventory; this.equipment = equipment;
    return this.snapshot = Object.freeze({ currency, balances, pets, slots: equipment.slots, bonus: this.service.getBonus(), eggs, goldenNeed: catalog.content.goldenNeed ?? 5 });
  };
  // Each subscriber owns exactly one session subscription, released on UI unmount.
  subscribe = (listener: () => void) => {
    let previous = this.getSnapshot();
    return this.ports.subscribe(() => {
      const next = this.getSnapshot();
      if (next !== previous) { previous = next; listener(); }
    });
  };
  hatch = (eggId: string) => this.ports.commands.hatch(eggId);
  equip = (id: string) => this.ports.commands.equip(id);
  unequip = (id: string) => this.ports.commands.unequip(id);
  equipBest = () => this.ports.commands.equipBest();
  unequipAll = () => this.ports.commands.unequipAll();
  mergeGolden = (speciesId: string) => this.ports.commands.mergeGolden(speciesId);
}
