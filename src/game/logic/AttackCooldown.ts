// Keep the attack cadence across frame rounding, without banking missed attacks.
export class AttackCooldown {
  private next = 0;
  private started = false;
  ready(now: number) { return Number.isFinite(now) && now + 1e-9 >= this.next; }
  consume(now: number, attacksPerSecond: number) {
    if (!Number.isFinite(now) || !Number.isFinite(attacksPerSecond) || attacksPerSecond <= 0) throw new Error('攻击时间或攻速无效');
    const interval = 1 / attacksPerSecond;
    // Carry less than one interval of lateness. Pauses and long frames start a
    // fresh interval instead of releasing several overdue hits at once.
    this.next = this.started && now - this.next < interval - 1e-9 ? this.next + interval : now + interval;
    this.started = true;
  }
  get nextAt() { return this.next; }
}
