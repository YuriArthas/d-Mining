import { versionOne } from './data.ts';

/** One-time tips, in the order a new player meets them. Each is shown at most once per save. */
export const TIP_IDS = ['dig', 'sell', 'shop', 'pets'] as const;
export type TipId = (typeof TIP_IDS)[number];
type Status = 'active' | 'skipped' | 'completed' | 'legacy';

/** Saved under `onboarding`. `seen` drives the tips; the other fields are facts that older test builds
 *  sharing this save still read, so they stay valid and up to date. */
export type OnboardingData = Readonly<{
  version: 1;
  seen: readonly TipId[];
  status: Status;
  minedOnce: boolean;
  soldOnce: boolean;
  equippedOnce: boolean;
  longTaskIntroduced: boolean;
  minedCount: number;
}>;
/** What the player has already shown they know, for saves made before tips existed. */
export type LearningEvidence = { level: number; pets: number; equipped: boolean };

export class Onboarding {
  private data: OnboardingData;

  constructor(saved: unknown, restored: boolean, evidence: LearningEvidence) {
    if (saved === undefined) {
      // A restored save without onboarding data predates tutorials: it is played, stay quiet.
      this.data = Object.freeze({
        version: 1, seen: restored ? [...TIP_IDS] : [], status: restored ? 'legacy' : 'active',
        minedOnce: false, soldOnce: false, equippedOnce: false, longTaskIntroduced: false, minedCount: 0,
      });
      return;
    }
    const d = versionOne(saved);
    if (!['active', 'skipped', 'completed', 'legacy'].includes(d.status as string)
      || ['minedOnce', 'soldOnce', 'equippedOnce'].some(k => typeof d[k] !== 'boolean')
      || (d.longTaskIntroduced !== undefined && typeof d.longTaskIntroduced !== 'boolean')
      || (d.minedCount !== undefined && (!Number.isSafeInteger(d.minedCount) || (d.minedCount as number) < 0))
      || (d.seen !== undefined && (!Array.isArray(d.seen) || d.seen.some(id => typeof id !== 'string')))) {
      throw Error('新手引导存档数据错误');
    }
    const facts = {
      status: d.status as Status, minedOnce: d.minedOnce as boolean, soldOnce: d.soldOnce as boolean,
      equippedOnce: d.equippedOnce as boolean, longTaskIntroduced: (d.longTaskIntroduced as boolean | undefined) ?? false,
      minedCount: (d.minedCount as number | undefined) ?? 0,
    };
    // Skipped or finished in any build (older test builds share this save) means no more tips.
    // Unknown ids from a newer build are dropped; a save written before tips derives them from facts.
    const seen = facts.status !== 'active' ? [...TIP_IDS]
      : Array.isArray(d.seen) ? TIP_IDS.filter(id => (d.seen as string[]).includes(id))
      : TIP_IDS.filter(id => ({ dig: facts.minedOnce, sell: facts.soldOnce, shop: evidence.level >= 2, pets: evidence.pets > 0 || evidence.equipped || facts.equippedOnce })[id]);
    this.data = Object.freeze({ version: 1, seen, ...facts });
  }

  getSnapshot = () => this.data;
  has(id: TipId) { return this.data.seen.includes(id); }

  /** Mark a tip as shown for good. Returns true when this changed the save. */
  markSeen(id: TipId) {
    if (this.has(id)) return false;
    const seen = TIP_IDS.filter(tip => tip === id || this.has(tip));
    return this.patch({ seen, ...(seen.length === TIP_IDS.length && this.data.status === 'active' ? { status: 'completed' as const } : {}) });
  }

  record(fact: 'minedOnce' | 'soldOnce' | 'equippedOnce') { return this.patch({ [fact]: true }); }

  recordCollected(count: number) {
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(this.data.minedCount + count)) throw Error('累计采矿数量错误');
    if (count === 0) return false;
    return this.patch({ minedOnce: true, minedCount: this.data.minedCount + count });
  }

  private patch(change: Partial<OnboardingData>) {
    if (Object.entries(change).every(([key, value]) => {
      const current = this.data[key as keyof OnboardingData];
      return Array.isArray(value) ? Array.isArray(current) && current.length === value.length && value.every((v, i) => current[i] === v) : current === value;
    })) return false;
    this.data = Object.freeze({ ...this.data, ...change });
    return true;
  }
}
