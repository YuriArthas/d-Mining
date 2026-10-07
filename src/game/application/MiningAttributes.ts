import { calculateMiningStats } from '../logic/pets/petRules.ts';
import type { MiningStats, PetBonus } from '../logic/pets/types.ts';

// Shared by combat and UI. UI lifetime never owns the player's effective stats.
export class MiningAttributes {
  private readonly readBase: () => MiningStats;
  private readonly readBonus: () => PetBonus;
  private base: MiningStats | null = null;
  private bonus: PetBonus | null = null;
  private snapshot: MiningStats | null = null;

  constructor(readBase: () => MiningStats, readBonus: () => PetBonus) {
    this.readBase = readBase; this.readBonus = readBonus;
  }
  getSnapshot = (): MiningStats => {
    const base = this.readBase(), bonus = this.readBonus();
    if (base !== this.base || bonus !== this.bonus) {
      this.snapshot = calculateMiningStats(base, bonus);
      this.base = base; this.bonus = bonus;
    }
    return this.snapshot!;
  };
}
