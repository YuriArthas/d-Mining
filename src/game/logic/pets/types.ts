import type { TextRef } from "../../i18n/messages.ts";
import type { CurrencyId } from '../../content/economy.ts';
type PetId = string;
type PetSpeciesId = string;
type EggId = string;
export type PetRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type PetDefinition = Readonly<{
  id: PetSpeciesId;
  name: TextRef;
  rarity: PetRarity;
  /** Extra income in `currency` (the currency of the world its egg comes from), in percent: 50 = +50 %. */
  bonusPct: number;
  currency: CurrencyId;
  /** Faster mining in every world, in percent: swing speed up to the cap, the rest as damage. */
  miningPct: number;
}>;
export type EggDefinition = Readonly<{
  id: EggId;
  name: TextRef;
  price: number;
  currency: CurrencyId;
  /** The egg's world must be open, and (below its surface) its layer's rest room reached. */
  requiredWorld?: number;
  requiredDestination?: string;
  unlockName?: TextRef;
  outcomes: readonly Readonly<{ speciesId: PetSpeciesId; weight: number }>[];
}>;
export type PetContent = Readonly<{
  pets: readonly PetDefinition[];
  eggs: readonly EggDefinition[];
  /** Slots every player has; up to `maxEquipSlots` with bought ones. */
  equipSlots: number;
  maxEquipSlots?: number;
  /** How many identical pets merge into one golden pet. */
  goldenNeed?: number;
}>;
/** `golden`: merged from several identical pets; both bonuses multiplied (economy.json `golden`). */
export type PetInstance = Readonly<{ id: PetId; speciesId: PetSpeciesId; level: 1; golden?: true }>;
export type PetInventorySnapshot = Readonly<{ pets: readonly PetInstance[]; count: number }>;
export type PetEquipmentSnapshot = Readonly<{ slots: readonly (PetId | null)[] }>;
/** The equipped team's totals, in percent: income per currency, and mining (every world). */
export type PetBonus = Readonly<Record<CurrencyId, number> & { mining: number }>;
export type MiningStats = Readonly<{ power: number; speed: number }>;
export type PetInventoryDataV1 = { version: 1; pets: Array<{ id: string; speciesId: string; level: 1; golden?: true }> };
export type PetEquipmentDataV1 = { version: 1; slots: Array<string | null> };
export type PetStateDataV1 = { version: 1; inventory: PetInventoryDataV1; equipment: PetEquipmentDataV1 };
export type EquipResult =
  | Readonly<{ status: 'equipped' | 'already-equipped'; slot: number }>
  | Readonly<{ status: 'full' }>;

export function petId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw Error('宠物 ID 必须是非空字符串');
  return value;
}
export function petRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('无效宠物数据');
  return value as Record<string, unknown>;
}
export function readPet(value: unknown): PetInstance {
  const data = petRecord(value);
  if (data.level !== 1) throw Error('当前宠物仅支持 Lv.1');
  if (data.golden !== undefined && data.golden !== true) throw Error('无效金色宠物标记');
  return Object.freeze({ id: petId(data.id), speciesId: petId(data.speciesId), level: 1, ...(data.golden ? { golden: true as const } : {}) });
}
