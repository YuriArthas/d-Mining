// Deterministic placement parameters; algorithm and obstacle queries live in GrassLayout.
export const GRASS_CONFIG = {
  count: 780,
  seed: 58021,
  attempts: 100000,
  cellSize: 0.58,
  spacing: 0.48,
  patches: {
    minX: -32,
    width: 77,
    minZ: -22,
    depth: 85,
    radius: 1.7,
    blades: 12,
  },
  scale: { min: 0.65, range: 0.35 },
} as const;
