import { versionOne } from './data.ts';
import { WORLD_REQUIREMENTS, worldRequirement, type WorldId } from '../content/worldJourney.ts';
export type ReservationData = { version: 1; manual: string[]; goals: WorldId[]; excluded: string[]; needed?: string[] };
export class MineralReservation {
  private manual = new Set<string>();
  private goals = new Set<WorldId>();
  private excluded = new Set<string>();
  private needed = new Set<string>();
  private readonly validItem: (id:string)=>boolean;
  constructor(saved: unknown, validItem: (id: string) => boolean) {
    this.validItem=validItem;
    if (saved === undefined) return;
    const data = versionOne(saved);
    for (const key of ['manual', 'excluded', 'needed'] as const) {
      if (key === 'needed' && data[key] === undefined) continue;
      if (!Array.isArray(data[key])) throw Error('矿产保留记录错误');
      for (const id of data[key]) {
        if (typeof id !== 'string' || !validItem(id) || this[key].has(id)) throw Error('矿产保留记录错误');
        this[key].add(id);
      }
    }
    if (!Array.isArray(data.goals)) throw Error('矿产备料目标错误');
    for (const id of data.goals) {
      if ((id !== 2 && id !== 3) || this.goals.has(id)) throw Error('矿产备料目标错误');
      this.goals.add(id);
    }
  }
  /** Rebirth: nothing kept any more. */
  reset() { this.manual.clear(); this.goals.clear(); this.excluded.clear(); this.needed.clear(); }
  reserveWorld(id: WorldId) { this.goals.add(id); for (const item of worldRequirement(id).materials) this.excluded.delete(item.itemId); }
  finishWorld(id: WorldId) { this.goals.delete(id); for (const item of worldRequirement(id).materials) this.needed.delete(item.itemId); }
  set(id: string, mode: 'none' | 'all' | 'needed') {
    if (!this.validItem(id)) throw Error('未知矿产');
    this.manual.delete(id); this.excluded.delete(id); this.needed.delete(id);
    if (mode === 'all') this.manual.add(id);
    else if (mode === 'none') this.excluded.add(id);
    else if (mode === 'needed') {
      this.needed.add(id);
    } else throw Error('未知保留方式');
  }
  quantity(id: string, owned: number) {
    if (this.manual.has(id)) return owned;
    if (this.excluded.has(id)) return 0;
    const need = WORLD_REQUIREMENTS.filter(w => this.goals.has(w.id) || this.needed.has(id)).flatMap(w => w.materials).filter(m => m.itemId === id).reduce((n,m) => n + m.count, 0);
    return Math.min(owned, need);
  }
  mode(id: string) { return this.manual.has(id) ? 'all' as const : !this.excluded.has(id) && (this.needed.has(id) || WORLD_REQUIREMENTS.some(w => this.goals.has(w.id) && w.materials.some(m => m.itemId === id))) ? 'needed' as const : 'none' as const; }
  sellable(items: Readonly<Record<string, number>>): Record<string, number> { return Object.fromEntries(Object.entries(items).map(([id,n]):[string,number] => [id, n - this.quantity(id,n)]).filter(([,n]) => n > 0)); }
  exportData(): ReservationData { return { version: 1, manual: [...this.manual], goals: [...this.goals], excluded: [...this.excluded], needed: [...this.needed] }; }
}
