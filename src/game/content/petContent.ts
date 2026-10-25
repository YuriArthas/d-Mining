import type { PetContent, PetDefinition, EggDefinition as EggOffer } from '../logic/pets/types.ts';
import { EGG_DEFINITIONS } from './pets.ts';
import { ECONOMY } from './economy.ts';
import { JOURNEY_WORLDS } from './journeyWorlds.ts';

/** The eggs and pets the game sells: names and rarity from pets.ts, prices, draw weights and bonuses from
 *  economy.json. An egg unlocks with its world, and below the surface with its layer's rest room; its pets add
 *  income in its world's currency, and mining speed everywhere. Table entries without an egg yet (`id: null`) are skipped. */
const entries = ECONOMY.eggs.flatMap(numbers => {
  if (numbers.id === null) return [];
  const definition = EGG_DEFINITIONS.find(d => d.id === numbers.id);
  if (!definition || definition.world !== numbers.world || definition.layer !== numbers.layer || definition.premium !== numbers.premium)
    throw Error(`economy.json 的蛋 ${numbers.id} 与 pets.ts 不一致`);
  const pets: PetDefinition[] = numbers.pets.map((pet, i) => {
    const [id, name, rarity] = definition.pets[i] ?? [];
    if (id !== pet.id) throw Error(`economy.json 的宠物 ${pet.id} 与 pets.ts 不一致`);
    return Object.freeze({ id, name, rarity, bonusPct: pet.bonusPct, currency: numbers.currency, miningPct: pet.miningPct });
  });
  const layer = numbers.layer ? JOURNEY_WORLDS[numbers.world - 1].layers[numbers.layer] : null;
  const offer: EggOffer = Object.freeze({
    id: numbers.id, name: definition.name, price: numbers.price, currency: numbers.currency,
    requiredWorld: numbers.world > 1 ? numbers.world : undefined,
    requiredDestination: layer?.id, unlockName: layer?.name ?? (numbers.world > 1 ? JOURNEY_WORLDS[numbers.world - 1].name : undefined),
    outcomes: numbers.pets.map(pet => Object.freeze({ speciesId: pet.id!, weight: pet.weight })),
  });
  return [{ pets, offer }];
});
export const PET_CONTENT: PetContent = Object.freeze({
  equipSlots: ECONOMY.start.petSlots,
  maxEquipSlots: ECONOMY.start.petSlots + ECONOMY.petSlots.length,
  goldenNeed: ECONOMY.golden.need,
  pets: Object.freeze(entries.flatMap(e => e.pets)),
  eggs: Object.freeze(entries.map(e => e.offer)),
});
