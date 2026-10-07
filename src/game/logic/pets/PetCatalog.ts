import { integer } from '../numbers.ts';
import { petId, type PetContent, type PetDefinition, type EggDefinition } from './types.ts';

export class PetCatalog {
  readonly content: PetContent;
  private readonly pets = new Map<string, PetDefinition>();
  private readonly eggs = new Map<string, EggDefinition>();

  constructor(content: PetContent) {
    if (!integer(content.equipSlots, '宠物槽位')) throw Error('宠物槽位必须大于 0');
    for (const pet of content.pets) {
      petId(pet.id); petId(pet.name);
      if (this.pets.has(pet.id)) throw Error(`重复宠物种类: ${pet.id}`);
      if (!['common', 'rare', 'epic', 'legendary'].includes(pet.rarity)) throw Error(`无效稀有度: ${pet.id}`);
      integer(pet.powerBonusBps, '宠物力量加成');
      this.pets.set(pet.id, Object.freeze({ ...pet }));
    }
    const largestBonus = Math.max(0, ...content.pets.map(pet => pet.powerBonusBps));
    integer(Number(BigInt(largestBonus) * BigInt(content.equipSlots)), '满装备宠物加成');
    for (const egg of content.eggs) {
      petId(egg.id); petId(egg.name); integer(egg.price, '蛋价格');
      if (this.eggs.has(egg.id)) throw Error(`重复蛋池: ${egg.id}`);
      if (!egg.outcomes.length) throw Error(`空蛋池: ${egg.id}`);
      let total = 0;
      const seen = new Set<string>();
      for (const outcome of egg.outcomes) {
        this.pet(outcome.speciesId);
        if (seen.has(outcome.speciesId)) throw Error(`蛋池重复种类: ${outcome.speciesId}`);
        seen.add(outcome.speciesId);
        if (!integer(outcome.weight, '蛋池权重')) throw Error('蛋池权重必须大于 0');
        total = integer(total + outcome.weight, '蛋池总权重');
      }
      this.eggs.set(egg.id, Object.freeze({ ...egg, outcomes: Object.freeze(egg.outcomes.map(o => Object.freeze({ ...o }))) }));
    }
    this.content = Object.freeze({
      equipSlots: content.equipSlots,
      pets: Object.freeze([...this.pets.values()]),
      eggs: Object.freeze([...this.eggs.values()]),
    });
  }

  pet(id: string): PetDefinition {
    const definition = this.pets.get(id);
    if (!definition) throw Error(`未知宠物种类: ${id}`);
    return definition;
  }
  egg(id: string): EggDefinition | null { return this.eggs.get(id) ?? null; }
}
