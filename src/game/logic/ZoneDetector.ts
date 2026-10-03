export type ZoneConfig = Readonly<{ x: number; y: number; z: number; radius: number; heightTolerance: number; hysteresis: number }>;
export class ZoneDetector {
  private inside = false;
  private config: ZoneConfig;
  constructor(config: ZoneConfig) { this.config = Object.freeze({ ...config }); }
  reset() { this.inside = false; }
  update(feet: readonly number[], grounded: boolean): 'enter' | 'exit' | null {
    const c = this.config, radius = c.radius + (this.inside ? c.hysteresis : 0);
    const next = grounded && Math.abs(feet[1] - c.y) <= c.heightTolerance && Math.hypot(feet[0] - c.x, feet[2] - c.z) <= radius;
    if (next === this.inside) return null;
    this.inside = next; return next ? 'enter' : 'exit';
  }
}
