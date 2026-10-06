// World-space metres and linear RGB. The layout/curbs are independent of paving.
export const ROAD_STYLE = {
  module: [2.8, 2.1],
  jointHalfWidth: 0.022,
  bevelWidth: 0.046,
  bevelHeight: 0.009,
  surfaceRelief: 0.018,
  textureContrast: 0.85,
  cornerCut: [0.045, 0.13],
  edgeMossWidth: 0.32,
  colors: {
    sandstone: [0.38, 0.345, 0.265],
    paleStone: [0.445, 0.41, 0.335],
    greyStone: [0.32, 0.35, 0.305],
    clayStone: [0.38, 0.295, 0.215],
    joint: [0.205, 0.19, 0.115],
    moss: [0.16, 0.255, 0.065],
  },
} as const;
