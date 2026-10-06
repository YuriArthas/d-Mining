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

export type EnvironmentConfig = Readonly<{
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
  surfaceLightingActive: boolean;
  time: SurfaceTime;
  depth: number;
  sky: string;
  groundLight: string;
  sceneryRevision: number;
}>;
type Sky = Pick<
  SurfaceEnvironment,
  "setTime" | "setEnabled" | "dispose" | "diagnostics" | "active"
>;
type Lights = Pick<
  SceneLightingRig,
  "setTime" | "setSurfaceActive" | "dispose" | "diagnostics"
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
  }

  prepare(frame: EnvironmentFrame) {
    this.apply(frame);
  }
  update(frame: EnvironmentFrame, delta: number) {
    this.apply(frame, delta);
  }

  private apply(frame: EnvironmentFrame, delta?: number) {
    if (this.disposed)
      throw new Error("EnvironmentController has been disposed");
    const { scene, ambient, key, config } = this;
    const surface = config.surface[frame.time],
      underground = config.underground;
    this.target.set(frame.sky);
    // Prewarm is immediate; normal frames retain the existing sky transition history.
    if (delta !== undefined)
      this.blended.lerp(
        this.target,
        1 - Math.exp(-delta * config.transitionSpeed),
      );
    this.sky.setTime(frame.time);
    this.sky.setEnabled(frame.surface);
    this.lights.setTime(frame.time);
    this.lights.setSurfaceActive(frame.surfaceLightingActive);
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
    ambient.color.set(frame.surface ? surface.skyColor : underground.skyColor);
    ambient.groundColor.set(
      frame.surface ? surface.groundColor : frame.groundLight,
    );
    ambient.intensity = frame.surface
      ? surface.ambientIntensity
      : underground.ambientIntensity;
    key.castShadow = false;
    const stamp = `${frame.surface}:${frame.time}:${frame.depth}:${frame.sceneryRevision}`;
    if (stamp !== this.lastKey) {
      const p = frame.surface ? surface.moonPosition : underground.keyOffset;
      key.position.set(p[0], p[1] - (frame.surface ? 0 : frame.depth), p[2]);
      key.target.position.set(0, -frame.depth, 0);
      key.target.updateMatrixWorld();
      key.color.set(frame.surface ? surface.moonColor : underground.keyColor);
      key.intensity = frame.surface
        ? surface.moonIntensity
        : underground.keyIntensity;
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
