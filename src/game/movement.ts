// Distances are metres; time is seconds. Tune movement here, independently of camera input.
export const MOVEMENT = {
  step: 1 / 60,
  maxFrameDelta: 0.1,
  maxSteps: 6, // Keep >= maxFrameDelta / step; prevents accumulating a catch-up backlog.
  speed: 6,
  gravity: 24,
  jumpSpeed: 9,
  terminalSpeed: 28,
  skin: 0.025, // Positive collision margin, metres.
  contactSlack: 0.002, // Extra separation for stable flat-face queries.
  probeLift: 0.05, // Begin the support sweep above the skin.
  snapGraceSteps: 2, // Short stair-lip transition; never grants a jump.
  supportProbe: 0.035,
  stepHeight: 0.45,
  stepWidth: 0.25,
  groundSnap: 0.48, // Smaller than a full 2 m mining cell.
  maxSlope: Math.PI / 4,
  slideSlope: Math.PI / 3,
  turnSharpness: 18, // Exponential response rate, per second.
} as const;

export class FixedStepClock {
  private remainder = 0;
  droppedSeconds = 0;
  get alpha() { return this.remainder / MOVEMENT.step; }
  reset() { this.remainder = 0; }
  advance(elapsed: number, tick: () => void) {
    const safe = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
    const accepted = Math.min(safe, MOVEMENT.maxFrameDelta);
    this.droppedSeconds += safe - accepted;
    this.remainder += accepted;
    let steps = 0;
    while (this.remainder + 1e-9 >= MOVEMENT.step && steps < MOVEMENT.maxSteps) {
      tick(); this.remainder = Math.max(0, this.remainder - MOVEMENT.step); steps++;
    }
    return steps;
  }
}

// Deadlines preserve an average 60 Hz cadence on e.g. 90 Hz screens (alternating RAF intervals).
export class RenderSchedule {
  private next: number | null = null;
  due(nowMs: number) {
    if (this.next === null) this.next = nowMs;
    if (nowMs < this.next - 0.25) return false;
    this.next += 1000 / 60;
    if (this.next <= nowMs) this.next = nowMs + 1000 / 60;
    return true;
  }
}
