import type { Sign, Solid, Shape } from "./sceneryKit.ts";
/** A surface service building: where it stands (`anchor`), and in its own frame the ring players step into,
 *  its collider and its floating word. */
export type SurfaceFacility = Readonly<{
  id: string;
  type: "sell" | "shop";
  anchor: Readonly<{ x: number; z: number; yaw: number }>;
  trigger: Readonly<{ x: number; z: number; radius: number; heightTolerance: number; hysteresis: number }>;
  collider: Readonly<{ x: number; y: number; z: number; half: readonly [number, number, number]; yaw: number }>;
  sign: Readonly<{ title: string; color: string; background: string; width: number; y: number }>;
  ringColor: string;
}>;
export function deriveFacility(config: SurfaceFacility) {
  const { anchor: a, trigger: t, collider: c, sign: s } = config;
  if (
    ![a.x, a.z, a.yaw, t.x, t.z, t.radius, ...c.half].every(Number.isFinite) ||
    t.radius <= 0 ||
    c.half.some((v) => v <= 0)
  )
    throw Error("无效设施: " + config.id);
  const point = (x: number, z: number) => ({
    x: a.x + Math.cos(a.yaw) * x + Math.sin(a.yaw) * z,
    z: a.z - Math.sin(a.yaw) * x + Math.cos(a.yaw) * z,
  });
  const trigger = {
    ...point(t.x, t.z),
    y: 0,
    radius: t.radius,
    heightTolerance: t.heightTolerance,
    hysteresis: t.hysteresis,
  };
  const collider = point(c.x, c.z);
  return {
    id: config.id,
    type: config.type,
    trigger,
    placement: { ...a },
    solid: {
      at: [collider.x, c.y, collider.z],
      half: [...c.half],
      yaw: a.yaw + c.yaw,
    } as Solid,
    sign: {
      at: [trigger.x, s.y, trigger.z],
      yaw: a.yaw,
      width: s.width,
      title: s.title,
      subtitle: "",
      color: s.color,
      background: s.background,
    } as Sign,
    ring: {
      type: "ring",
      at: [trigger.x, 0.055, trigger.z],
      size: [t.radius, 0.08, t.radius],
      color: config.ringColor,
      glow: true,
    } as Shape,
  };
}
