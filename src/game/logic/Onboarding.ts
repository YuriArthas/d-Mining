import { versionOne } from './data.ts';

export const DEEPER_MINING_GOAL = 20;
export const LONG_MINING_GOAL = 100;
export type OnboardingData = Readonly<{
  version: 1;
  status: 'active' | 'skipped' | 'completed' | 'legacy';
  minedOnce: boolean;
  soldOnce: boolean;
  equippedOnce: boolean;
  longTaskIntroduced: boolean;
  minedCount: number;
}>;
export type LearningEvidence = {
  coins: number; level: number; capacity: number; items: number;
  pets: number; equipped: boolean; maxDepth: number;
};

export class Onboarding {
  private data: OnboardingData;
  constructor(saved: unknown, restored: boolean, evidence: LearningEvidence) {
    if (saved !== undefined) {
      const d = versionOne(saved);
      if (!['active', 'skipped', 'completed', 'legacy'].includes(d.status as string)
        || ['minedOnce', 'soldOnce', 'equippedOnce'].some(k => typeof d[k] !== 'boolean')
        || (d.longTaskIntroduced !== undefined && typeof d.longTaskIntroduced !== 'boolean')
        || (d.minedCount !== undefined && (!Number.isSafeInteger(d.minedCount) || (d.minedCount as number) < 0))) {
        throw Error('新手引导存档数据错误');
      }
      this.data = Object.freeze({
        version: 1, status: d.status as OnboardingData['status'],
        minedOnce: d.minedOnce as boolean, soldOnce: d.soldOnce as boolean,
        equippedOnce: d.equippedOnce as boolean,
        longTaskIntroduced: (d.longTaskIntroduced as boolean | undefined) ?? false,
        // Old saves never recorded lifetime collection. Do not reconstruct it
        // from held ore, wallet balance, or excavated terrain.
        minedCount: (d.minedCount as number | undefined) ?? 0,
      });
    } else {
      this.data = Object.freeze({
        version: 1, status: restored ? 'legacy' : 'active',
        minedOnce: false, soldOnce: false, equippedOnce: false,
        longTaskIntroduced: false, minedCount: 0,
      });
    }
    if (restored) {
      if (saved === undefined) this.inferObservableFacts(evidence);
      // Previously completed tutorials remain complete after adding steps.
      // Restoring or resuming never creates a completion celebration.
      if (this.data.status === 'active' && this.complete(evidence)) this.patch({ status: 'completed' });
    }
  }
  getSnapshot = () => this.data;
  private patch(change: Partial<OnboardingData>) {
    if (Object.entries(change).every(([key, value]) => this.data[key as keyof OnboardingData] === value)) return false;
    this.data = Object.freeze({ ...this.data, ...change });
    return true;
  }
  private inferObservableFacts(e: LearningEvidence) {
    // Rewards can fund every purchase. Neither coins, upgrades nor owned pets
    // prove that a sale happened; soldOnce only comes from a sale settlement.
    this.patch({ minedOnce: this.data.minedOnce || e.items > 0, equippedOnce: this.data.equippedOnce || e.equipped });
  }
  private mainLoopComplete(e: LearningEvidence) {
    return this.data.minedOnce && this.data.soldOnce && e.level >= 2
      && e.maxDepth >= DEEPER_MINING_GOAL && e.capacity > 50;
  }
  private complete(e: LearningEvidence) {
    return this.mainLoopComplete(e) && this.data.longTaskIntroduced && this.data.equippedOnce;
  }
  record(fact: 'minedOnce' | 'soldOnce' | 'equippedOnce') { return this.patch({ [fact]: true }); }
  recordCollected(count: number) {
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(this.data.minedCount + count)) {
      throw Error('累计采矿数量错误');
    }
    if (count === 0) return false;
    return this.patch({ minedOnce: true, minedCount: this.data.minedCount + count });
  }
  introduceLongTask(e: LearningEvidence) {
    return this.data.status === 'active' && this.mainLoopComplete(e) && this.patch({ longTaskIntroduced: true });
  }
  settle(e: LearningEvidence) {
    return this.data.status === 'active' && this.complete(e) ? this.patch({ status: 'completed' }) : false;
  }
  skip() { return this.data.status === 'active' && this.patch({ status: 'skipped' }); }
  resume(e: LearningEvidence) {
    if (this.data.status !== 'skipped' && this.data.status !== 'legacy') return false;
    this.inferObservableFacts(e);
    return this.patch({ status: this.complete(e) ? 'completed' : 'active' });
  }
}
