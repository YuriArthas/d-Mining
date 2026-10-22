import {
  Color,
  Fog,
  type Scene,
  type HemisphereLight,
  type DirectionalLight,
} from "three";
import type { SurfaceEnvironment, SkyConfig } from "./SurfaceEnvironment.ts";
import type { SceneLightingRig } from "./SceneLightingRig.ts";
import type { SurfaceTime } from "../world/SceneLighting.ts";
import { DayNightCycle } from '../logic/DayNightCycle.ts';

export type EnvironmentConfig = Readonly<{
  initialTime?: SurfaceTime;
  sky: SkyConfig;
  initialBackground: string;
  transitionSpeed: number;
  fog: Readonly<{ near: number; far: number }>;
  surface: Readonly<
    Record<
      SurfaceTime,
      Readonly<{
        skyColor: string;
        groundColor: string;
        ambientIntensity: number;
        moonPosition: readonly [number, number, number];
        moonColor: string;
        moonIntensity: number;
      }>
    >
  >;
  underground: Readonly<{
    skyColor: string;
    ambientIntensity: number;
    keyColor: string;
    keyIntensity: number;
    keyOffset: readonly [number, number, number];
  }>;
}>;
export type EnvironmentFrame = Readonly<{
  surface: boolean;
  surfaceLightStrength: number;
  time: SurfaceTime | 'auto';
  depth: number;
  sky: string;
  groundLight: string;
  sceneryRevision: number;
}>;
type Sky = Pick<
  SurfaceEnvironment,
  "setDaylight" | "setEnabled" | "setLightingStrength" | "prepareDraw" | "markSubmitted" | "dispose" | "diagnostics" | "active"
>;
type Lights = Pick<
  SceneLightingRig,
  "setDaylight" | "setSurfaceStrength" | "dispose" | "diagnostics"
>;

// Owns the sky and local-light rig. Scene and React-owned ambient/key lights are borrowed.
// It knows environment parameters, never layer IDs, facilities, input or terrain.
export class EnvironmentController {
  private readonly scene: Scene;
  private readonly ambient: HemisphereLight;
  private readonly key: DirectionalLight;
  readonly sky: Sky;
  readonly lights: Lights;
  private readonly config: EnvironmentConfig;
  private readonly previousFog;
  private readonly previousBackground;
  private readonly blended: Color;
  private readonly target = new Color();
  private readonly colorTarget = new Color();
  private readonly cycle = new DayNightCycle();
  private daylight = 0;
  private surfaceStrength = 0;
  private lastKey = "";
  private disposed = false;
  updates = 0;

  constructor(
    scene: Scene,
    ambient: HemisphereLight,
    key: DirectionalLight,
    sky: Sky,
    lights: Lights,
    config: EnvironmentConfig,
  ) {
    this.scene = scene;
    this.ambient = ambient;
    this.key = key;
    this.sky = sky;
    this.lights = lights;
    this.config = config;
    this.previousFog = scene.fog;
    this.previousBackground = scene.background;
    this.blended = new Color(config.initialBackground);
    if(config.initialTime === "day") this.cycle.advance(this.cycle.phaseSeconds);
  }

  prepare(frame: EnvironmentFrame) {
    this.apply(frame);
    // Startup shader warmup owns its draws before the runtime gate exists.
    this.prepareDraw();
  }
  update(frame: EnvironmentFrame, delta: number, cycleElapsed = delta) {
    this.apply(frame, delta, cycleElapsed);
  }
  prepareDraw() {
    if (this.disposed) throw new Error('EnvironmentController has been disposed');
    this.sky.prepareDraw();
  }
  markSubmitted() {
    if (this.disposed) throw new Error('EnvironmentController has been disposed');
    this.sky.markSubmitted();
  }
  get daylightBlend() { return this.daylight; }
  get dayNightSnapshot() { return this.cycle.getSnapshot(); }
  get cameraDaylightBlend() { return this.daylight * this.surfaceStrength; }
  get environmentLightingStrength() { return this.surfaceStrength; }
  get ambientSnapshot() { return { color:this.ambient.color.getHex(), groundColor:this.ambient.groundColor.getHex(), intensity:this.ambient.intensity }; }
  get surfaceTime(): SurfaceTime { return this.daylight >= .5 ? 'day' : 'night'; }
  // Exposed by the debug adapter only. The next normal frame owns all rendering updates.
  advanceDayNight(seconds: number) { return this.cycle.advance(seconds); }

  private apply(frame: EnvironmentFrame, delta?: number, cycleElapsed = 0) {
    if (this.disposed)
      throw new Error("EnvironmentController has been disposed");
    const { scene, ambient, key, config } = this;
    // The first mine theme spans 0–400m. Its visible sky must not make the
    // deep shaft inherit daylight: reuse the entrance's existing smooth fade.
    const strength = this.surfaceStrength = frame.surface ? Math.max(0, Math.min(1, frame.surfaceLightStrength)) : 0;
    this.daylight = frame.time === 'auto' ? this.cycle.advance(cycleElapsed).daylight : frame.time === 'day' ? 1 : 0;
    const { day, night } = config.surface, underground = config.underground;
    const blend = (a: number, b: number) => a + (b - a) * this.daylight;
    this.target.set(frame.sky);
    // Prewarm is immediate; normal frames retain the existing sky transition history.
    if (delta !== undefined)
      this.blended.lerp(
        this.target,
        1 - Math.exp(-delta * config.transitionSpeed),
      );
    this.sky.setDaylight(this.daylight);
    this.sky.setLightingStrength(strength);
    this.sky.setEnabled(frame.surface);
    this.lights.setDaylight(this.daylight);
    this.lights.setSurfaceStrength(frame.surfaceLightStrength);
    if (frame.surface) scene.fog = null;
    else {
      const color = delta === undefined ? this.target : this.blended;
      scene.background = color;
      if (!(scene.fog instanceof Fog))
        scene.fog = new Fog(color, config.fog.near, config.fog.far);
      scene.fog.color.copy(color);
      scene.fog.near = config.fog.near;
      scene.fog.far = config.fog.far;
    }
    if (strength > 0) {
      ambient.color.set(night.skyColor).lerp(this.colorTarget.set(day.skyColor), this.daylight);
      ambient.color.lerp(this.colorTarget.set(underground.skyColor), 1 - strength);
      ambient.groundColor.set(night.groundColor).lerp(this.colorTarget.set(day.groundColor), this.daylight);
      ambient.groundColor.lerp(this.colorTarget.set(frame.groundLight), 1 - strength);
      ambient.intensity = underground.ambientIntensity + (blend(night.ambientIntensity, day.ambientIntensity) - underground.ambientIntensity) * strength;
    } else {
      ambient.color.set(underground.skyColor);
      ambient.groundColor.set(frame.groundLight);
      ambient.intensity = underground.ambientIntensity;
    }
    key.castShadow = false;
    const stamp = `${strength}:${strength > 0 ? this.daylight : 0}:${frame.depth}:${frame.sceneryRevision}`;
    if (stamp !== this.lastKey) {
      if (strength > 0) {
        key.position.set(blend(night.moonPosition[0], day.moonPosition[0]), blend(night.moonPosition[1], day.moonPosition[1]), blend(night.moonPosition[2], day.moonPosition[2]));
        const p = underground.keyOffset;
        key.position.x = p[0] + (key.position.x - p[0]) * strength;
        key.position.y = p[1] - frame.depth + (key.position.y - p[1] + frame.depth) * strength;
        key.position.z = p[2] + (key.position.z - p[2]) * strength;
        key.color.set(night.moonColor).lerp(this.colorTarget.set(day.moonColor), this.daylight);
        key.color.lerp(this.colorTarget.set(underground.keyColor), 1 - strength);
        key.intensity = underground.keyIntensity + (blend(night.moonIntensity, day.moonIntensity) - underground.keyIntensity) * strength;
      } else {
        const p = underground.keyOffset;
        key.position.set(p[0], p[1] - frame.depth, p[2]);
        key.color.set(underground.keyColor);
        key.intensity = underground.keyIntensity;
      }
      key.target.position.set(0, -frame.depth, 0);
      key.target.updateMatrixWorld();
      this.lastKey = stamp;
      this.updates++;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.lights.dispose();
    this.sky.dispose();
    this.scene.fog = this.previousFog;
    this.scene.background = this.previousBackground;
  }
}
