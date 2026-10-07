import { integer } from '../numbers.ts';
import type { EggDefinition, MiningStats, PetBonus, PetDefinition, PetInstance } from './types.ts';

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
  const total = equipped.reduce((sum, pet) => integer(sum + definition(pet.speciesId).powerBonusBps, '宠物总加成'), 0);
  return Object.freeze({ powerBonusBps: total });
}
export function calculateMiningStats(base: MiningStats, bonus: PetBonus): MiningStats {
  if (!integer(base.power, '基础力量') || !Number.isFinite(base.speed) || base.speed <= 0) throw Error('无效挖矿属性');
  integer(bonus.powerBonusBps, '宠物总加成');
  // Integer arithmetic prevents precision loss near the existing pickaxe's safe-integer limit.
  const power = Number(BigInt(base.power) * (10000n + BigInt(bonus.powerBonusBps)) / 10000n);
  integer(power, '有效力量');
  return Object.freeze({ power, speed: base.speed });
}
export function selectBestPets(owned: readonly PetInstance[], definition: DefinitionReader, slotCount: number): readonly string[] {
  integer(slotCount, '宠物槽位');
  return Object.freeze([...owned].sort((a, b) => {
    const difference = definition(b.speciesId).powerBonusBps - definition(a.speciesId).powerBonusBps;
    return difference || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }).slice(0, slotCount).map(pet => pet.id));
}
