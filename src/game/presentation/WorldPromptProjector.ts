import { Vector3, type Camera } from 'three';

// Uses the existing frame loop. No per-frame React state, DOM measurements, or
// clamping offscreen eggs into a misleading fixed HUD position.
export class WorldPromptProjector {
  private readonly point = new Vector3();
  update(camera: Camera, anchor: readonly [number, number, number] | null, element: HTMLElement | null) {
    if (!element) return;
    if (!anchor) { element.style.visibility = 'hidden'; return; }
    this.point.set(...anchor).project(camera);
    const visible = this.point.z >= -1 && this.point.z <= 1 && Math.abs(this.point.x) < .94 && Math.abs(this.point.y) < .9;
    element.style.visibility = visible ? 'visible' : 'hidden';
    if (visible) {
      element.style.left = `${(this.point.x + 1) * 50}%`;
      element.style.top = `${(1 - this.point.y) * 50}%`;
    }
  }
}
