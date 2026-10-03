import RAPIER from '@dimforge/rapier3d-compat';
import { GAME_CONFIG } from '../config.ts';
import { COURSE_BOXES } from './course.ts';
import { MOVEMENT } from '../movement.ts';
export { RAPIER };
let initialization: Promise<void> | undefined;
export function initPhysics() { return initialization ??= RAPIER.init(); }
export const STEP = MOVEMENT.step;
export const PLAYER = { ...MOVEMENT, spawn: GAME_CONFIG.player.spawn };
export const BOXES = [
  ...COURSE_BOXES,
  { center: [0, 1, 16], half: [5, 1, 6], color: '#b3a38a' },
  { center: [5.5, 2.5, 17], half: [0.5, 2.5, 4], color: '#859ba1' },
  { center: [-7, 0.2, 12], half: [1.5, 0.2, 1], color: '#a3b0a2' },
  { center: [-7, 0.4, 14], half: [1.5, 0.4, 1], color: '#a3b0a2' },
  { center: [-7, 0.6, 16], half: [1.5, 0.6, 1], color: '#a3b0a2' },
];
export const RAMP = {
  positions: new Float32Array([-3, 0, 4, 3, 0, 4, -3, 2, 10, 3, 2, 10, -3, 0, 10, 3, 0, 10]),
  indices: new Uint32Array([0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5, 2, 4, 5, 2, 5, 3, 0, 1, 4, 1, 5, 4]),
};
export class CharacterPhysics {
  readonly world = new RAPIER.World({ x: 0, y: -PLAYER.gravity, z: 0 });
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly controller: RAPIER.KinematicCharacterController;
  grounded = false;
  verticalSpeed = 0;
  steps = 0;
  jumps = 0;
  private snapFrames = 0;
  private previousFeet: [number, number, number] = [...PLAYER.spawn];
  private surfaceColliders: RAPIER.Collider[] = [];
  constructor() {
    this.world.timestep = STEP;
    const { radius, height } = GAME_CONFIG.player;
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(height / 2 - radius, radius), this.body);
    this.controller = this.world.createCharacterController(MOVEMENT.skin);
    this.controller.enableAutostep(MOVEMENT.stepHeight, MOVEMENT.stepWidth, false);
    // Rapier 0.19.3 snap-to-ground oscillated ~5 cm on this flat platform in the probe.
    // P1.3 uses an explicit downward capsule sweep, with a stable skin margin.
    this.controller.disableSnapToGround();
    this.controller.setMaxSlopeClimbAngle(MOVEMENT.maxSlope);
    this.controller.setMinSlopeSlideAngle(MOVEMENT.slideSlope);
    this.setSurfaceActive(true);
    // Finite mine boundary. These five simple static walls replace missing-world fall-through.
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(100, 1, 100).setTranslation(4, -4001, 4));
    for (const x of [-97, 105]) this.world.createCollider(RAPIER.ColliderDesc.cuboid(1, 2020, 100).setTranslation(x, -1980, 4));
    for (const z of [-97, 105]) this.world.createCollider(RAPIER.ColliderDesc.cuboid(100, 2020, 1).setTranslation(4, -1980, z));
    this.teleport(PLAYER.spawn);
  }
  setSurfaceActive(active: boolean) {
    if (active === (this.surfaceColliders.length > 0)) return;
    if (!active) {
      for (const collider of this.surfaceColliders) this.world.removeCollider(collider, false);
      this.surfaceColliders = []; return;
    }
    for (const box of BOXES) this.surfaceColliders.push(this.world.createCollider(RAPIER.ColliderDesc.cuboid(box.half[0], box.half[1], box.half[2]).setTranslation(box.center[0], box.center[1], box.center[2])));
    this.surfaceColliders.push(this.world.createCollider(RAPIER.ColliderDesc.trimesh(RAMP.positions, RAMP.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)));
  }
  feet(): [number, number, number] {
    const p = this.body.translation(); return [p.x, p.y - GAME_CONFIG.player.height / 2, p.z];
  }
  teleport(feet: readonly number[]) {
    const p = { x: feet[0], y: feet[1] + GAME_CONFIG.player.height / 2, z: feet[2] };
    this.body.setTranslation(p, true); this.body.setNextKinematicTranslation(p);
    this.verticalSpeed = 0; this.grounded = false; this.snapFrames = 0;
    this.world.step();
    this.previousFeet = this.feet();
  }
  interpolatedFeet(alpha: number): [number, number, number] {
    const feet = this.feet();
    return this.previousFeet.map((v, i) => v + (feet[i] - v) * Math.max(0, Math.min(1, alpha))) as [number, number, number];
  }
  private support(position: RAPIER.Vector, distance: number) {
    // Cast to real contact from slightly above the skin. Casting directly to the
    // skin threshold produces unstable zero-distance normals in Rapier 0.19.3.
    const lift = MOVEMENT.probeLift;
    const hit = this.world.castShape({ ...position, y: position.y + lift }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: -1, z: 0 }, this.collider.shape, 0, distance + lift + MOVEMENT.skin, true, undefined, undefined, this.collider);
    if (!hit || hit.normal1.y < Math.cos(MOVEMENT.maxSlope)) return null;
    // The contact plane is more stable than GJK's estimated time of impact on
    // large flat faces. Project the capsule's support point onto that plane.
    const { radius, height } = GAME_CONFIG.player, n = hit.normal1, point = hit.witness1;
    const separation = (position.x - point.x) * n.x + (position.y - point.y) * n.y + (position.z - point.z) * n.z - radius - (height / 2 - radius) * n.y;
    const drop = (separation - MOVEMENT.skin - MOVEMENT.contactSlack) / n.y;
    return drop <= distance && drop >= -MOVEMENT.supportProbe ? drop : null;
  }
  tick(x: number, forward: number, yaw: number, jump: boolean, ready: boolean) {
    // Apply no deferred displacement: this also refreshes broad phase after chunk collider swaps.
    this.body.setNextKinematicTranslation(this.body.translation());
    this.world.step();
    this.previousFeet = this.feet();
    if (!ready) return;
    const position = this.body.translation();
    // Re-check the actual supporting surface: a just-mined block must not grant a jump.
    const supported = this.verticalSpeed <= 0 && this.support(position, MOVEMENT.supportProbe) !== null;
    const jumping = jump && supported;
    if (jumping) { this.verticalSpeed = PLAYER.jumpSpeed; this.jumps++; this.snapFrames = 0; }
    else if (supported) this.verticalSpeed = 0;
    if (!supported || jumping) this.verticalSpeed = Math.max(-PLAYER.terminalSpeed, this.verticalSpeed - PLAYER.gravity * STEP);
    const scale = Math.max(1, Math.hypot(x, forward)); x /= scale; forward /= scale;
    const motion = {
      x: (Math.cos(yaw) * x - Math.sin(yaw) * forward) * PLAYER.speed * STEP,
      y: this.verticalSpeed * STEP,
      z: (-Math.sin(yaw) * x - Math.cos(yaw) * forward) * PLAYER.speed * STEP,
    };
    this.controller.computeColliderMovement(this.collider, motion, undefined, undefined, c => c.handle !== this.collider.handle);
    const result = this.controller.computedMovement();
    for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
      const collision = this.controller.computedCollision(i);
      if (this.verticalSpeed > 0 && collision && collision.normal1.y < -0.5) this.verticalSpeed = 0;
    }
    const next = { x: position.x + result.x, y: position.y + result.y, z: position.z + result.z };
    this.grounded = false;
    if (!jumping && this.verticalSpeed <= 0) {
      // Follow shallow downhill steps, but do not snap down full mining cells or during ascent.
      let ground = this.support(next, (supported || this.snapFrames > 0) ? MOVEMENT.groundSnap : MOVEMENT.supportProbe);
      if (ground === null && (supported || this.snapFrames > 0) && result.y <= 0.0001) {
        // A capsule catches the rounded lip of a descending step before its sweep
        // sees the next tread. Let the KCC slide around that lip, and accept the
        // correction only when the destination has a walkable supporting surface.
        this.body.setTranslation(next, true);
        this.world.propagateModifiedBodyPositionsToColliders();
        this.controller.setMinSlopeSlideAngle(MOVEMENT.maxSlope);
        this.controller.computeColliderMovement(this.collider, { x: 0, y: -MOVEMENT.groundSnap, z: 0 });
        this.controller.setMinSlopeSlideAngle(MOVEMENT.slideSlope);
        const down = this.controller.computedMovement();
        const candidate = { x: next.x + down.x, y: next.y + down.y, z: next.z + down.z };
        const support = this.support(candidate, MOVEMENT.supportProbe);
        if (support !== null) { Object.assign(next, candidate); ground = support; }
      }
      if (ground !== null) {
        if (ground >= 0) next.y -= ground;
        else {
          // Restore tiny contact-margin losses only if there is room overhead.
          const ceiling = this.world.castShape(next, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 1, z: 0 }, this.collider.shape, 0, -ground, true, undefined, undefined, this.collider);
          next.y += ceiling ? Math.max(0, ceiling.time_of_impact - 0.001) : -ground;
        }
        this.grounded = true; this.verticalSpeed = 0;
      }
    }
    // One transition step of snap eligibility bridges a rounded stair lip;
    // jumping still requires a fresh real support query above.
    this.snapFrames = this.grounded ? MOVEMENT.snapGraceSteps : Math.max(0, this.snapFrames - 1);
    this.body.setTranslation(next, true); this.body.setNextKinematicTranslation(next);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.steps++;
  }
  dispose() { this.world.free(); }
}
