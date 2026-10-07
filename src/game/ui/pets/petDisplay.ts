import type { PetRarity } from '../../logic/pets/types.ts';

export const RARITY_NAMES: Record<PetRarity, string> = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
export const bonusLabel = (bps: number) => `+${bps / 100}%`;
