import { integer } from './numbers.ts';
import { versionOne } from './data.ts';
import { WORLD_REQUIREMENTS, worldRequirement, type WorldId } from '../content/worldJourney.ts';

export type WorldProgressData = { version: 1; minedVolume: number; openMines: WorldId[] };
export class WorldProgress {
  private mined = 0;
  private readonly mines = new Set<WorldId>([1]);
  constructor(saved?: unknown) {
    if (saved === undefined) return;
    const data = versionOne(saved);
    this.mined = integer(data.minedVolume as number, '历史累计挖掘量');
    if (!Array.isArray(data.openMines) || !data.openMines.includes(1)) throw Error('矿区开放记录错误');
    this.mines.clear();
    for (const id of data.openMines) {
      if (![1,2,3].includes(id) || this.mines.has(id) || !this.areaOpen(id)) throw Error('矿区开放记录错误');
      this.mines.add(id);
    }
    if (this.mines.has(3) && !this.mines.has(2)) throw Error('矿区开放顺序错误');
  }
  get minedVolume() { return this.mined; }
  previewCollection(volume: number) { return integer(this.mined + integer(volume, '采集量'), '历史累计挖掘量'); }
  collect(volume: number) { this.mined = this.previewCollection(volume); }
  areaOpen(id: WorldId) { return this.mined >= worldRequirement(id).mined; }
  mineOpen(id: WorldId) { return this.mines.has(id); }
  openMine(id: WorldId) {
    if (!this.areaOpen(id) || (id > 1 && !this.mineOpen((id - 1) as WorldId))) throw Error('尚未满足矿区开放条件');
    this.mines.add(id);
  }
  /** Testing shortcut: credits enough history to enter world `id` and opens its mine and every one before it. */
  openThrough(id: WorldId) {
    this.mined = Math.max(this.mined, worldRequirement(id).mined);
    for (const w of WORLD_REQUIREMENTS) if (w.id <= id) this.mines.add(w.id);
  }
  exportData(): WorldProgressData { return { version: 1, minedVolume: this.mined, openMines: WORLD_REQUIREMENTS.filter(w => this.mines.has(w.id)).map(w => w.id) }; }
}
