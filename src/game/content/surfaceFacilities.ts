export type SurfaceFacility = Readonly<{
  id: string;
  type: "sell" | "shop";
  anchor: Readonly<{ x: number; z: number; yaw: number }>;
  model: Readonly<{
    asset: "simulator-exchange" | "simulator-upgrade";
    width: number;
    depth: number;
    height: number;
    y: number;
  }>;
  trigger: Readonly<{
    x: number;
    z: number;
    radius: number;
    heightTolerance: number;
    hysteresis: number;
  }>;
  collider: Readonly<{
    x: number;
    y: number;
    z: number;
    half: readonly [number, number, number];
    yaw: number;
  }>;
  sign: Readonly<{
    title: string;
    color: string;
    background: string;
    width: number;
    y: number;
  }>;
  ringColor: string;
}>;
export const SURFACE_FACILITIES = {
  sale: {
    id: "surface-sale",
    type: "sell",
    anchor: { x: -12, z: 56, yaw: Math.PI },
    model: {
      asset: "simulator-exchange",
      width: 10,
      depth: 8,
      height: 9,
      y: -0.08,
    },
    trigger: {
      x: 0,
      z: 6.7,
      radius: 1.7,
      heightTolerance: 0.25,
      hysteresis: 0.25,
    },
    collider: { x: 0, y: 3, z: 0, half: [4.3, 3, 3.4], yaw: 0 },
    sign: {
      title: "SELL",
      color: "#ffe35c",
      background: "#18283d",
      width: 3.6,
      y: 4.5,
    },
    ringColor: "#ffe77d",
  },
  shop: {
    id: "surface-upgrade",
    type: "shop",
    anchor: { x: 12, z: 56, yaw: Math.PI },
    model: {
      asset: "simulator-upgrade",
      width: 10,
      depth: 8,
      height: 9,
      y: -0.08,
    },
    trigger: {
      x: 0,
      z: 6.7,
      radius: 1.7,
      heightTolerance: 0.25,
      hysteresis: 0.25,
    },
    collider: { x: 0, y: 3, z: 0, half: [4.3, 3, 3.4], yaw: 0 },
    sign: {
      title: "SHOP",
      color: "#40deff",
      background: "#18283d",
      width: 3.6,
      y: 4.5,
    },
    ringColor: "#44cfff",
  },
} as const satisfies Record<string, SurfaceFacility>;
