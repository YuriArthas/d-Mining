import { PAD_CURTAIN, type Sign, type Shape } from "./sceneryKit.ts";
/** A surface service building: where it stands (`anchor`), and in its own frame the ring players step into and
 *  its floating word (its collider is its model's). */
export type SurfaceFacility = Readonly<{
  id: string;
  type: "sell" | "shop";
  anchor: Readonly<{ x: number; z: number; yaw: number }>;
  trigger: Readonly<{ x: number; z: number; radius: number; heightTolerance: number; hysteresis: number }>;
  sign: Readonly<{ title: string; color: string; background: string; width: number; y: number }>;
  ringColor: string;
}>;
export function deriveFacility(config: SurfaceFacility) {
  const { anchor: a, trigger: t, sign: s } = config;
  if (![a.x, a.z, a.yaw, t.x, t.z, t.radius].every(Number.isFinite) || t.radius <= 0)
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
  return {
    id: config.id,
    type: config.type,
    trigger,
    placement: { ...a },
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
      type: "pad",
      // Just over the plaza's sand (3.5 cm up).
      at: [trigger.x, 0.06, trigger.z],
      size: [t.radius, PAD_CURTAIN, t.radius],
      color: config.ringColor,
      interaction: true,
    } as Shape,
  };
}
