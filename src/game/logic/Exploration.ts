import { versionOne } from './data.ts';
// Depth milestones know neither rooms, UI, physics nor persistence.
export class Exploration {
  private maximum = 0;
  private unlocked = new Set<string>();
  private access = new Set<string>();
  private readonly milestones: readonly Readonly<{ id: string; depth: number }>[];
  constructor(milestones: readonly Readonly<{ id: string; depth: number }>[], initiallyUnlocked:readonly string[] = []) {
    this.milestones = milestones;
    for(const id of initiallyUnlocked){
      if(!milestones.some(m=>m.id===id))throw Error(`未知初始解锁目的地: ${id}`);
      this.access.add(id);
    }
  }
  visit(depth: number) {
    if (!Number.isFinite(depth) || depth < 0) return [];
    this.maximum = Math.max(this.maximum, depth);
    const added: string[] = [];
    for (const point of this.milestones) if (this.maximum >= point.depth && !this.unlocked.has(point.id)) {
      this.unlocked.add(point.id); added.push(point.id);
    }
    return added;
  }
  has(id: string) { return this.access.has(id) || this.unlocked.has(id); }
  exportData() { return { version: 1 as const, maxDepth: this.maximum, unlockedDestinationIds: [...this.unlocked] }; }
  static fromData(value: unknown, milestones: readonly Readonly<{id:string;depth:number}>[], access: readonly string[] = []) {
    const data = versionOne(value), maximum = data.maxDepth;
    if (typeof maximum !== 'number' || !Number.isFinite(maximum) || maximum < 0 || !Array.isArray(data.unlockedDestinationIds)) throw Error('探索数据错误');
    const result = new Exploration(milestones, access);
    for (const id of data.unlockedDestinationIds) {
      if (typeof id !== 'string' || !milestones.some(m => m.id === id) || result.unlocked.has(id)) throw Error('未知或重复的解锁目的地');
      result.unlocked.add(id);
    }
    result.maximum = maximum;
    return result;
  }
  get maxDepth() { return this.maximum; }
}
