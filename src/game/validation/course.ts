// Shared by voxel generation, ordinary colliders and their visible meshes.
export const SHAFT = { minX: -16, maxX: -9, minY: -4, minZ: -4, maxZ: 3 } as const;
export const COURSE_SPAWN = [-24, 0.1, 12] as const;
export const COURSE_BOXES = [
  // 1.4 m clear width, 2 m clear height; the capsule is 0.8 m wide / 1.65 m tall.
  { center: [-12, 1.5, 18], half: [0.5, 1.5, 4], color: '#819ca4' },
  { center: [-9.6, 1.5, 18], half: [0.5, 1.5, 4], color: '#819ca4' },
  { center: [-10.8, 2.15, 18], half: [0.7, 0.15, 2], color: '#b3a38a' },
  // L corner, with room to walk around the outer end.
  { center: [-18, 1.5, 19], half: [0.4, 1.5, 3], color: '#819ca4' },
  { center: [-16, 1.5, 22], half: [2.4, 1.5, 0.4], color: '#819ca4' },
  // Eight 1 m rises from the shaft floor (-8 m) to the surface, requiring jumps.
  ...Array.from({ length: 8 }, (_, i) => ({
    center: [-28, -8 + (i + 1) / 2, -7 + i * 2],
    half: [2, (i + 1) / 2, 1], color: i % 2 ? '#b3a38a' : '#c7b692',
  })),
];
