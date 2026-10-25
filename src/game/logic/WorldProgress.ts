import { record } from './data.ts';
import { WORLD_REQUIREMENTS, type WorldId } from '../content/worldJourney.ts';

/** Which worlds are unlocked (paid for at a world portal). World 1 always is; each later world needs the one
 *  before it. Version 1 saves (an outer gate on lifetime volume, then a mine payment) load as their paid mines. */
export type WorldProgressData = { version: 2; openWorlds: WorldId[] };
export class WorldProgress {
  private readonly open = new Set<WorldId>([1]);
  constructor(saved?: unknown) {
    if (saved === undefined) return;
    const data = record(saved);
    const ids = data.version === 1 ? data.openMines : data.version === 2 ? data.openWorlds : undefined;
    if (!Array.isArray(ids) || !ids.includes(1)) throw Error('世界开放记录错误');
    for (const id of ids) {
      if (![1, 2, 3].includes(id) || (id > 1 && !ids.includes(id - 1))) throw Error('世界开放记录错误');
      this.open.add(id);
    }
  }
  isOpen(id: WorldId) { return this.open.has(id); }
  /** The next world to unlock: the one before it is open. Worlds beyond it stay unknown. */
  unlockable(id: WorldId) { return !this.open.has(id) && (id === 1 || this.open.has((id - 1) as WorldId)); }
  unlock(id: WorldId) {
    if (!this.unlockable(id)) throw Error('尚未满足世界开放条件');
    this.open.add(id);
  }
  /** Rebirth: back to world 1 alone. */
  reset() { this.open.clear(); this.open.add(1); }
  /** Testing shortcut: opens world `id` and every one before it. */
  openThrough(id: WorldId) { for (const w of WORLD_REQUIREMENTS) if (w.id <= id) this.open.add(w.id); }
  exportData(): WorldProgressData { return { version: 2, openWorlds: WORLD_REQUIREMENTS.filter(w => this.open.has(w.id)).map(w => w.id) }; }
}
