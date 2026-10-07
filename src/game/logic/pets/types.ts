export type PetId = string;
export type PetSpeciesId = string;
export type EggId = string;
export type PetRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type PetDefinition = Readonly<{
  id: PetSpeciesId;
  name: string;
  rarity: PetRarity;
  powerBonusBps: number;
}>;
export type EggDefinition = Readonly<{
  id: EggId;
  name: string;
  price: number;
  outcomes: readonly Readonly<{ speciesId: PetSpeciesId; weight: number }>[];
}>;
export type PetContent = Readonly<{
  pets: readonly PetDefinition[];
  eggs: readonly EggDefinition[];
  equipSlots: number;
}>;
export type PetInstance = Readonly<{ id: PetId; speciesId: PetSpeciesId; level: 1 }>;
export type PetInventorySnapshot = Readonly<{ pets: readonly PetInstance[]; count: number }>;
export type PetEquipmentSnapshot = Readonly<{ slots: readonly (PetId | null)[] }>;
export type PetBonus = Readonly<{ powerBonusBps: number }>;
export type MiningStats = Readonly<{ power: number; speed: number }>;
export type PetInventoryDataV1 = { version: 1; pets: Array<{ id: string; speciesId: string; level: 1 }> };
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
  return Object.freeze({ id: petId(data.id), speciesId: petId(data.speciesId), level: 1 });
}
