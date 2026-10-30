// The capsule machine stands where the pet house used to, north of the egg terraces, turned toward the
// walkway that comes past the terrace stairs (its model, Capsule_Cabinet, brings its collider).
export const CAPSULE_MACHINE_AT = [31.5, 0, 9] as const;
/** Yaw of the capsule machine's front (0 faces +Z): toward the walkway from the stairs. */
export const CAPSULE_MACHINE_YAW = -56 * Math.PI / 180;
const front = (distance: number) => [CAPSULE_MACHINE_AT[0] + Math.sin(CAPSULE_MACHINE_YAW) * distance, CAPSULE_MACHINE_AT[2] + Math.cos(CAPSULE_MACHINE_YAW) * distance] as const;
export const CAPSULE_MACHINE_ZONE = {
  x: front(1.8)[0], y: 0, z: front(1.8)[1], radius: 2.2, heightTolerance: .4, hysteresis: .3,
  lookAt: [CAPSULE_MACHINE_AT[0], 1.5, CAPSULE_MACHINE_AT[2]] as const,
} as const;
