import { integer } from '../numbers.ts';
import type { EggDefinition, PetBonus, PetDefinition, PetInstance } from './types.ts';
import type { CurrencyId } from '../../content/economy.ts';

export function drawEgg(egg: EggDefinition, roll: number): string {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw Error('开蛋随机值必须在 [0, 1)');
  const total = egg.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  if (!integer(total, '蛋池总权重')) throw Error('空蛋池');
  let cumulative = 0;
  for (const outcome of egg.outcomes) {
    cumulative += outcome.weight;
    if (roll < cumulative / total) return outcome.speciesId;
  }
  throw Error('蛋池权重无效');
}
type DefinitionReader = (id: string) => PetDefinition;
export function calculatePetBonus(equipped: readonly PetInstance[], definition: DefinitionReader): PetBonus {
  const total: Record<CurrencyId, number> & { mining: number } = { gold: 0, tech: 0, star: 0, mining: 0 };
  for (const pet of equipped) {
    const d = definition(pet.speciesId);
    total[d.currency] = integer(total[d.currency] + d.bonusPct, '宠物总加成'); total.mining = integer(total.mining + d.miningPct, '宠物挖矿加成');
  }
  return Object.freeze(total);
}
/** What one pet adds in a world whose ore sells for `currency`: its bonus there, nothing elsewhere. */
export const petBonusIn = (pet: PetDefinition, currency: CurrencyId) => pet.currency === currency ? pet.bonusPct : 0;
/** The best team for the current world: its own currency's pets by income bonus, then the strongest miners for
 *  the slots left (every pet mines faster everywhere). */
export function selectBestPets(owned: readonly PetInstance[], definition: DefinitionReader, slotCount: number, currency: CurrencyId): readonly string[] {
  integer(slotCount, '宠物槽位');
  return Object.freeze([...owned].sort((a, b) => {
    const da = definition(a.speciesId), db = definition(b.speciesId);
    const difference = petBonusIn(db, currency) - petBonusIn(da, currency) || db.miningPct - da.miningPct;
    return difference || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }).slice(0, slotCount).map(pet => pet.id));
}
