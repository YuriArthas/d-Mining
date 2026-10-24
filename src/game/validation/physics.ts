import RAPIER from '@dimforge/rapier3d-compat';
import { GAME_CONFIG } from '../config.ts';
import { MOVEMENT } from '../movement.ts';
export { RAPIER };
let initialization: Promise<void> | undefined;
export function initPhysics() { return initialization ??= RAPIER.init(); }
export const STEP = MOVEMENT.step;
export const PLAYER = { ...MOVEMENT, spawn: GAME_CONFIG.player.spawn };
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
  /** The player's capsule less its skin, for overlap checks. */
  private core: RAPIER.Capsule | undefined;
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
    // Finite mine boundary around the three worlds. These five simple static walls replace missing-world fall-through.
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(100, 1, 324).setTranslation(4, -2801, 228));
    for (const x of [-97, 105]) this.world.createCollider(RAPIER.ColliderDesc.cuboid(1, 2020, 324).setTranslation(x, -1980, 228));
    for (const z of [-97, 553]) this.world.createCollider(RAPIER.ColliderDesc.cuboid(100, 2020, 1).setTranslation(4, -1980, z));
    this.teleport(PLAYER.spawn);
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
    let rejected: Set<number> | undefined;
    // A nearby curb can overlap the lifted capsule and be the first hit even
    // though its contact plane cannot support these feet. Continue the same
    // short sweep for real ground; never turn a rejected contact into support.
    // Each retry excludes one collider, so queries are bounded by the live set.
    for (let remaining = this.world.colliders.len(); remaining > 0; remaining--) {
      const hit = this.world.castShape({ ...position, y: position.y + lift }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: -1, z: 0 }, this.collider.shape, 0, distance + lift + MOVEMENT.skin, true, undefined, undefined, this.collider, undefined, rejected ? collider => !rejected!.has(collider.handle) : undefined);
      if (!hit) return null;
      if (hit.normal1.y >= Math.cos(MOVEMENT.maxSlope)) {
        // The contact plane is more stable than GJK's estimated time of impact
        // on large flat faces. Project the capsule's support point onto it.
        const { radius, height } = GAME_CONFIG.player, n = hit.normal1, point = hit.witness1;
        const separation = (position.x - point.x) * n.x + (position.y - point.y) * n.y + (position.z - point.z) * n.z - radius - (height / 2 - radius) * n.y;
        const drop = (separation - MOVEMENT.skin - MOVEMENT.contactSlack) / n.y;
        if (drop <= distance && drop >= -MOVEMENT.supportProbe) {
          // Ground found past a rejected collider must not pull the capsule into it: one mesh collider
          // can hold both a steep edge touching the capsule and the floor under its feet (the old bridge
          // end let the feet drop 0.4 m through its slab onto the path below).
          if (rejected && this.buries(position, drop, rejected)) return null;
          return drop;
        }
      }
      (rejected ??= new Set()).add(hit.collider.handle);
    }
    return null;
  }
  /** Whether lowering the capsule by `drop` would sink it deeper than its skin into one of the `skipped`
   *  colliders it does not already overlap (a curb the capsule stands against keeps overlapping it). The
   *  sweep reached the ground past only those, so no other collider lies in the way. */
  private buries(position: RAPIER.Vector, drop: number, skipped: ReadonlySet<number>) {
    const { radius, height } = GAME_CONFIG.player, still = { x: 0, y: 0, z: 0, w: 1 };
    this.core ??= new RAPIER.Capsule(height / 2 - radius, radius - MOVEMENT.skin);
    const overlapping = new Set<number>();
    this.world.intersectionsWithShape(position, still, this.core, collider => { overlapping.add(collider.handle); return true; }, undefined, undefined, this.collider, undefined, collider => skipped.has(collider.handle));
    return this.world.intersectionWithShape({ x: position.x, y: position.y - drop, z: position.z }, still, this.core, undefined, undefined, this.collider, undefined, collider => skipped.has(collider.handle) && !overlapping.has(collider.handle)) !== null;
  }
  tick(x: number, forward: number, yaw: number, jump: boolean, ready: boolean, speedMultiplier = 1) {
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
      x: (Math.cos(yaw) * x - Math.sin(yaw) * forward) * PLAYER.speed * speedMultiplier * STEP,
      y: this.verticalSpeed * STEP,
      z: (-Math.sin(yaw) * x - Math.cos(yaw) * forward) * PLAYER.speed * speedMultiplier * STEP,
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
