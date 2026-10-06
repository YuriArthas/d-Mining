// Explicit station assignment by stable destination ID. Order and depth may change independently.
export const PORTAL_SLOTS = {
  old_mine: { x: -27, z: 48, yaw: Math.PI / 2, model: "portal-timber" },
  fungal: { x: -27, z: 44, yaw: Math.PI / 2, model: "portal-fungal" },
  crystal: { x: -27, z: 40, yaw: Math.PI / 2, model: "portal-crystal" },
  ruins: {
    x: -27,
    z: 36,
    yaw: Math.PI / 2,
    model: "portal-timber",
    tint: "#ffe4ad",
  },
  frozen: { x: -27, z: 32, yaw: Math.PI / 2, model: "portal-frozen" },
  volcanic: { x: -27, z: 28, yaw: Math.PI / 2, model: "portal-volcanic" },
  fossil: { x: -27, z: 24, yaw: Math.PI / 2, model: "portal-fossil" },
  machinery: {
    x: -27,
    z: 20,
    yaw: Math.PI / 2,
    model: "portal-timber",
    tint: "#8db5bd",
  },
  core: { x: -27, z: 16, yaw: Math.PI / 2, model: "portal-core" },
} as const;
export type PortalSlot = {
  x: number;
  z: number;
  yaw: number;
  model: (typeof PORTAL_SLOTS)[keyof typeof PORTAL_SLOTS]["model"];
  tint?: string;
};
