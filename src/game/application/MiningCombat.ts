import { BlockHealth } from '../logic/BlockHealth.ts';
import { AttackCooldown } from '../logic/AttackCooldown.ts';
type HitResult = Readonly<{ status: 'locked'; requiredLevel: number }> | Readonly<{ status: 'hit' | 'breaking'; remaining: number; damage: number }> | Readonly<{ status: 'full' | 'cooldown' | 'pending' | 'unavailable' }>;
type CombatPorts<Target> = {
  isFull(): boolean;
  stats(): { power: number; speed: number };
  level?(): number;
  read(target: Target): { key: string; maximum: number; requiredLevel?: number } | null;
  pending(target: Target): boolean;
  destroy(target: Target): boolean;
};
export class MiningCombat<Target> {
  private ports: CombatPorts<Target>;
  readonly health = new BlockHealth<string>();
  readonly cooldown = new AttackCooldown();
  constructor(ports: CombatPorts<Target>) { this.ports = ports; }
  hit(target: Target, now: number): HitResult {
    if (this.ports.isFull()) return { status: 'full' };
    const block = this.ports.read(target);
    if (!block) return { status: 'unavailable' };
    if ((block.requiredLevel ?? 0) > (this.ports.level?.() ?? 1)) return { status: 'locked', requiredLevel: block.requiredLevel! };
    if (this.ports.pending(target)) return { status: 'pending' };
    if (!this.cooldown.ready(now)) return { status: 'cooldown' };
    const { power, speed } = this.ports.stats();
    const hp = this.health.get(block.key, block.maximum);
    // Queue rejection must not consume a final hit. A cancelled zero-HP cell
    // keeps its damage and can be resubmitted, without granting a second hit/reward.
    if (hp <= power && !this.ports.destroy(target)) return { status: 'unavailable' };
    if (hp === 0) return { status: 'breaking', remaining: 0, damage: 0 };
    const remaining = this.health.damage(block.key, block.maximum, power);
    this.cooldown.consume(now, speed);
    return { status: remaining ? 'hit' : 'breaking', remaining, damage: Math.min(hp, power) };
  }
  destroyed(key: string) { this.health.forget(key); }
}
