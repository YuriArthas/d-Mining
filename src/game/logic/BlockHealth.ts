import { integer } from './numbers.ts';
// Only damaged cells have entries. Rendering/physics residency never owns health.
export class BlockHealth<Key> {
  private remaining = new Map<Key, number>();
  private listeners = new Set<(key: Key, hp: number | null) => void>();
  observe(listener: (key: Key, hp: number | null) => void) {
    for (const [key, hp] of this.remaining) listener(key, hp);
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  get(key: Key, maximum: number) { return this.remaining.get(key) ?? maximum; }
  damage(key: Key, maximum: number, amount: number) {
    if (!integer(maximum) || !integer(amount)) throw new Error('血量与伤害必须大于 0');
    const hp = Math.max(0, this.get(key, maximum) - amount);
    this.remaining.set(key, hp);
    for (const listener of this.listeners) listener(key, hp);
    return hp;
  }
  forget(key: Key) { if (this.remaining.delete(key)) for (const listener of this.listeners) listener(key, null); }
  get size() { return this.remaining.size; }
}
