import type { SurfaceTime } from '../world/SceneLighting.ts';

export type DayNightSnapshot = Readonly<{ phase: SurfaceTime; phaseElapsed: number; daylight: number }>;

// The clock consumes active foreground time only; loading or a background pause
// must not be supplied as a catch-up delta by the runtime.
export class DayNightCycle {
  readonly phaseSeconds = 450;
  readonly transitionSeconds = 12;
  private elapsed = 0;

  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('昼夜时钟步长必须是非负有限数');
    this.elapsed = (this.elapsed + seconds) % (this.phaseSeconds * 2);
    return this.getSnapshot();
  }

  getSnapshot(): DayNightSnapshot {
    const isDay = this.elapsed >= this.phaseSeconds;
    const phaseElapsed = this.elapsed % this.phaseSeconds;
    const t = Math.max(0, Math.min(1, (phaseElapsed - (this.phaseSeconds - this.transitionSeconds)) / this.transitionSeconds));
    const smooth = t * t * (3 - 2 * t);
    return { phase: isDay ? 'day' : 'night', phaseElapsed, daylight: isDay ? 1 - smooth : smooth };
  }
}
