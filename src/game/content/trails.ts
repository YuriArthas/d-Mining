export type Trail = { points: [number, number, number][]; width: number };
export const SURFACE_TRAILS: Trail[] = [
  {
    points: [
      [0, 0, 12],
      [0, 0, 51.3],
    ],
    width: 6,
  },
  {
    points: [
      [-24, 0, 30],
      [25, 0, 30],
    ],
    width: 4,
  },
  {
    points: [
      [-14, 0, 49.3],
      [14, 0, 49.3],
    ],
    width: 4,
  },
  // Right: browsing apron and two unobstructed side stair landings.
  {
    points: [
      [22, 0, 14],
      [22, 0, 46],
    ],
    width: 6,
  },
  ...[15.5, 44.5].map((z) => ({
    points: [
      [22, 0, z],
      [25, 0, z],
    ] as [number, number, number][],
    width: 3,
  })),
  // Left: safe continuous lane; short branches alone enter destination triggers.
  {
    points: [
      [-22, 0, 14],
      [-22, 0, 50],
    ],
    width: 4,
  },
  ...Array.from({ length: 9 }, (_, i) => ({
    points: [
      [-22, 0, 16 + i * 4],
      [-27, 0, 16 + i * 4],
    ] as [number, number, number][],
    width: 1.6,
  })),
];
