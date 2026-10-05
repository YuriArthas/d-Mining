import { GAME_CONFIG } from './config.ts';

// A gesture chooses exactly one role until release. Browser timing/capture lives
// in bindInput; this state machine is independent of rendering and timers.
export class TouchGesture {
  phase: 'pending' | 'look' | 'mine' | 'ended' = 'pending';
  private startX: number;
  private startY: number;
  private x: number;
  private y: number;
  private started: number;
  constructor(x: number, y: number, now: number) {
    this.startX = this.x = x; this.startY = this.y = y; this.started = now;
  }
  hold(now: number) {
    if (this.phase === 'pending' && now - this.started >= GAME_CONFIG.input.mineHoldMs) this.phase = 'mine';
    return this.phase;
  }
  move(x: number, y: number) {
    let dx = x - this.x, dy = y - this.y;
    if (this.phase === 'pending') {
      dx = x - this.startX; dy = y - this.startY;
      if (Math.hypot(dx, dy) > GAME_CONFIG.input.lookThresholdPx) this.phase = 'look';
    }
    this.x = x; this.y = y;
    return this.phase === 'look' ? { x: dx, y: dy } : { x: 0, y: 0 };
  }
  end(released = false) {
    const tap = released && this.phase === 'pending';
    this.phase = 'ended';
    return tap;
  }
}
