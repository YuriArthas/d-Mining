import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { GAME_CONFIG } from './config.ts';

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const UP = { x: 0, y: 1, z: 0 };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// A sphere enclosing the near-plane corners protects the whole image, including
// wide landscape viewports. Reduce near only on unusually wide aspect ratios.
export function cameraClearance(aspect: number, fov: number) {
  const c = GAME_CONFIG.camera;
  const slope = Math.tan(fov * Math.PI / 360);
  const diagonal = Math.sqrt(1 + slope * slope * (1 + aspect * aspect));
  const near = Math.min(c.near, (c.maxProbeRadius - c.clearance) / diagonal);
  return { near, radius: Math.max(c.minProbeRadius, near * diagonal + c.clearance) };
}

export class ThirdPersonCamera {
  readonly position = new Vector3();
  readonly target = new Vector3();
  readonly direction = new Vector3(); // From target toward camera, independent of obstruction.
  distance = Number(GAME_CONFIG.camera.distance);
  safeDistance = this.distance;
  radius = 0;
  near = Number(GAME_CONFIG.camera.near);
  avatarOpacity = 1;
  private initialized = false;
  private targetY = 0;
  private readonly bodyCenter = new Vector3();
  private readonly segment = new Vector3();

  reset() { this.initialized = false; }
  update(world: RAPIER.World, player: RAPIER.Collider, feet: readonly number[], yaw: number, pitch: number, delta: number, aspect: number) {
    const c = GAME_CONFIG.camera, dt = clamp(delta, 0, 0.1);
    const clearance = cameraClearance(aspect, c.fov);
    this.radius = clearance.radius; this.near = clearance.near;
    const ball = new RAPIER.Ball(this.radius);
    this.bodyCenter.set(feet[0], feet[1] + GAME_CONFIG.player.height / 2, feet[2]);
    const desiredY = feet[1] + c.targetHeight;
    this.targetY = this.initialized ? this.targetY + (desiredY - this.targetY) * (1 - Math.exp(-c.followSharpness * dt)) : desiredY;
    // Limit follow lag during fast falls. Rebuild the pivot from inside the capsule
    // every frame, so a low ceiling or a new collider cannot trap it inside terrain.
    this.targetY = clamp(this.targetY, desiredY - c.maxVerticalLag, desiredY + c.maxVerticalLag);
    const rise = Math.max(0, this.targetY - this.bodyCenter.y);
    const roof = world.castShape(this.bodyCenter, IDENTITY, UP, ball, 0, rise, true, undefined, undefined, player);
    this.target.copy(this.bodyCenter); this.target.y += roof ? Math.max(0, roof.time_of_impact - c.clearance) : rise;
    this.targetY = this.target.y;
    this.direction.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const hit = world.castShape(this.target, IDENTITY, this.direction, ball, 0, c.distance, true, undefined, undefined, player);
    this.safeDistance = hit ? Math.max(0, hit.time_of_impact - c.clearance) : c.distance;
    // Hard contraction enforces collision safety; only recovery is smoothed.
    // Never interpolate world positions through a corner or force a minimum boom.
    const recovered = this.distance + (c.distance - this.distance) * (1 - Math.exp(-c.recoverSharpness * dt));
    this.distance = this.initialized ? Math.min(this.safeDistance, recovered) : this.safeDistance;
    this.position.copy(this.target).addScaledVector(this.direction, this.distance);
    this.initialized = true;

    // Fade only the player when the view approaches its actual volume. Terrain
    // remains opaque; close-range camera and aiming retain the requested angles.
    const nearestY = clamp(this.position.y, feet[1], feet[1] + GAME_CONFIG.player.height);
    const gap = Math.max(0, Math.hypot(this.position.x - feet[0], this.position.y - nearestY, this.position.z - feet[2]) - GAME_CONFIG.player.radius);
    this.avatarOpacity = clamp((gap - c.hideGap) / (c.showGap - c.hideGap), 0, 1);
  }
  snapshot() {
    return { position: this.position.toArray(), target: this.target.toArray(), direction: this.direction.toArray(), distance: this.distance, safeDistance: this.safeDistance, radius: this.radius, near: this.near, avatarOpacity: this.avatarOpacity };
  }
  // Debug/test-only geometric audit, queried on demand rather than every frame.
  obstructed(world: RAPIER.World, player: RAPIER.Collider) {
    this.segment.copy(this.position).sub(this.target);
    const length = this.segment.length();
    return !!world.intersectionWithShape(this.position, IDENTITY, new RAPIER.Ball(this.radius - 0.005), undefined, undefined, player)
      || (length > 0.001 && !!world.castShape(this.target, IDENTITY, this.segment.normalize(), new RAPIER.Ball(this.radius - 0.005), 0, length, true, undefined, undefined, player));
  }
}
