export type InputSnapshot = Readonly<{
  moveX: number;
  moveY: number; // Forward is positive; the movement controller will map it to world space.
  mining: boolean;
  jumpHeld: boolean;
  jumpCount: number;
}>;

const moveKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space']);
export function isGameKey(code: string) { return moveKeys.has(code); }

export function stickVector(dx: number, dy: number, radius: number, deadZone: number) {
  const length = Math.hypot(dx, dy);
  const ratio = Math.min(length / radius, 1);
  if (ratio <= deadZone) return { x: 0, y: 0 };
  const strength = (ratio - deadZone) / (1 - deadZone);
  return { x: dx / length * strength, y: -dy / length * strength };
}

// Plain action state: browser adapters write actions; rendering/controller code consumes them.
export class GameInput {
  private keys = new Set<string>();
  private miners = new Set<string>();
  private jumpers = new Set<string>();
  private touchX = 0;
  private touchY = 0;
  private lookX = 0;
  private lookY = 0;
  private jumpQueued = false;
  private jumps = 0;
  private listeners = new Set<() => void>();
  private snapshot: InputSnapshot = { moveX: 0, moveY: 0, mining: false, jumpHeld: false, jumpCount: 0 };

  private aim = { x: 0, y: 0, active: false, mode: 'touch' as 'touch' | 'mouse' };
  private minePress: typeof this.aim | null = null;
  getAim = () => this.aim;
  consumeMinePress() { const press = this.minePress; this.minePress = null; return press; }
  // Pointer motion is polled by the scene, without publishing React state each event.
  point(x: number, y: number, active: boolean) { this.aim = { x, y, active, mode: 'mouse' }; }
  touchAim(x = 0, y = 0, active = false) { this.aim = { x, y, active, mode: 'touch' }; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private publish() {
    const has = (...codes: string[]) => codes.some(code => this.keys.has(code)) ? 1 : 0;
    let x = has('KeyD', 'ArrowRight') - has('KeyA', 'ArrowLeft') + this.touchX;
    let y = has('KeyW', 'ArrowUp') - has('KeyS', 'ArrowDown') + this.touchY;
    const scale = Math.max(1, Math.hypot(x, y));
    x /= scale; y /= scale;
    this.snapshot = { moveX: x, moveY: y, mining: this.miners.size > 0, jumpHeld: this.jumpers.size > 0, jumpCount: this.jumps };
    for (const listener of this.listeners) listener();
  }

  key(code: string, down: boolean) {
    if (!isGameKey(code) || this.keys.has(code) === down) return;
    if (down) this.keys.add(code); else this.keys.delete(code);
    if (code === 'Space') this.jump('keyboard', down); else this.publish();
  }

  move(x: number, y: number) { this.touchX = x; this.touchY = y; this.publish(); }
  mine(source: string, down: boolean) {
    if (this.miners.has(source) === down) return;
    if (down) {
      if (this.miners.size === 0 && this.aim.active && this.aim.mode === 'mouse') this.minePress = { ...this.aim };
      this.miners.add(source);
    } else this.miners.delete(source);
    this.publish();
  }
  jump(source: string, down: boolean) {
    if (this.jumpers.has(source) === down) return;
    if (down) {
      if (this.jumpers.size === 0) { this.jumps++; this.jumpQueued = true; }
      this.jumpers.add(source);
    } else this.jumpers.delete(source);
    this.publish();
  }
  look(dx: number, dy: number) {
    this.lookX += dx; this.lookY += dy;
    for (const listener of this.listeners) listener();
  }
  consumeLook() {
    const delta = { x: this.lookX, y: this.lookY };
    this.lookX = 0; this.lookY = 0;
    return delta;
  }
  consumeJump() { const pressed = this.jumpQueued; this.jumpQueued = false; return pressed; }
  resetRevision = 0;
  reset() {
    this.resetRevision++;
    this.keys.clear(); this.miners.clear(); this.jumpers.clear();
    this.touchX = this.touchY = this.lookX = this.lookY = 0;
    this.jumpQueued = false; this.minePress = null;
    this.aim = { ...this.aim, active: false };
    this.publish();
  }
}
