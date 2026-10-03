// Depth milestones know neither rooms, UI, physics nor persistence.
export class Exploration {
  private maximum = 0;
  private unlocked = new Set<string>();
  private readonly milestones: readonly Readonly<{ id: string; depth: number }>[];
  constructor(milestones: readonly Readonly<{ id: string; depth: number }>[]) { this.milestones = milestones; }
  visit(depth: number) {
    if (!Number.isFinite(depth) || depth < 0) return [];
    this.maximum = Math.max(this.maximum, depth);
    const added: string[] = [];
    for (const point of this.milestones) if (this.maximum >= point.depth && !this.unlocked.has(point.id)) {
      this.unlocked.add(point.id); added.push(point.id);
    }
    return added;
  }
  has(id: string) { return this.unlocked.has(id); }
  get maxDepth() { return this.maximum; }
}
