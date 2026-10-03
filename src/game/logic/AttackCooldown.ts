// Absolute monotonic time, independent of button/target/UI state. No catch-up bursts.
export class AttackCooldown {
  private next = 0;
  ready(now: number) { return Number.isFinite(now) && now >= this.next; }
  consume(now: number, attacksPerSecond: number) {
    if (!Number.isFinite(now) || !Number.isFinite(attacksPerSecond) || attacksPerSecond <= 0) throw new Error('攻击时间或攻速无效');
    this.next = now + 1 / attacksPerSecond;
  }
  get nextAt() { return this.next; }
}
