import {
  Color,
  Fog,
  type Scene,
  type HemisphereLight,
  type DirectionalLight,
  type Vector3,
} from "three";
import type { SurfaceEnvironment, SkyConfig } from "./SurfaceEnvironment.ts";
import type { SurfaceLook } from "../world/SceneLighting.ts";

export type EnvironmentConfig = Readonly<{
  sky: SkyConfig;
  initialBackground: string;
  transitionSpeed: number;
  fog: Readonly<{ near: number; far: number }>;
  /** The surface's daylight: sun, sky/ground fill. */
  surface: Readonly<Omit<SurfaceLook, 'environmentIntensity'>>;
  underground: Readonly<{
    skyColor: string;
    ambientIntensity: number;
    keyColor: string;
    keyIntensity: number;
    keyOffset: readonly [number, number, number];
  }>;
}>;
type EnvironmentFrame = Readonly<{
  surface: boolean;
  surfaceLightStrength: number;
  depth: number;
  sky: string;
  groundLight: string;
  sceneryRevision: number;
  /** An underground layer's own mood (its hall's look): sky/ground fill, top light and fog. */
  cave?: Readonly<{ sky: string; ground: string; ambient: number; key: string; keyIntensity: number; fog: string }>;
}>;
type Sky = Pick<
  SurfaceEnvironment,
  "setEnabled" | "setLightingStrength" | "prepareDraw" | "markSubmitted" | "dispose" | "diagnostics" | "active"
> & Partial<Pick<SurfaceEnvironment, "setEnvironmentOverride">>;

const CLEAR_FOG = 1e4;

// Owns the sky. Scene and React-owned ambient/key lights are borrowed. The surface is always in daylight;
// down the shaft the light fades into the layer's own dark mood. It knows environment parameters, never
// layer IDs, facilities, input or terrain.
export class EnvironmentController {
  private readonly scene: Scene;
  private readonly ambient: HemisphereLight;
  private readonly key: DirectionalLight;
  readonly sky: Sky;
  private readonly config: EnvironmentConfig;
  private readonly previousFog;
  private readonly previousBackground;
  private readonly blended: Color;
  private readonly target = new Color();
  private readonly colorTarget = new Color();
  private readonly fog = new Fog("#000000", CLEAR_FOG, 2 * CLEAR_FOG);
  private surfaceStrength = 0;
  private lastKey = "";
  private disposed = false;
  private look: Partial<SurfaceLook> | null = null;
  updates = 0;

  constructor(
    scene: Scene,
    ambient: HemisphereLight,
    key: DirectionalLight,
    sky: Sky,
    config: EnvironmentConfig,
  ) {
    this.scene = scene;
    this.ambient = ambient;
    this.key = key;
    this.sky = sky;
    this.config = config;
    this.previousFog = scene.fog;
    this.previousBackground = scene.background;
    this.blended = new Color(config.initialBackground);
  }

  prepare(frame: EnvironmentFrame) {
    this.apply(frame);
    // Startup shader warmup owns its draws before the runtime gate exists.
    this.prepareDraw();
  }
  update(frame: EnvironmentFrame, delta: number) {
    this.apply(frame, delta);
  }
  prepareDraw() {
    if (this.disposed) throw new Error('EnvironmentController has been disposed');
    this.sky.prepareDraw();
  }
  markSubmitted() {
    if (this.disposed) throw new Error('EnvironmentController has been disposed');
    this.sky.markSubmitted();
  }
  /** Unit vector toward the key light (the sun on the surface). */
  keyDirection(out: Vector3) {
    return out.copy(this.key.position).sub(this.key.target.position).normalize();
  }
  /** 1 in the open, 0 underground (the surface light fading down the first shaft). */
  get surfaceBlend() { return this.surfaceStrength; }
  get ambientSnapshot() { return { color:this.ambient.color.getHex(), groundColor:this.ambient.groundColor.getHex(), intensity:this.ambient.intensity }; }
  /** Verification only: try other surface light values live (null restores the content's). */
  setLookOverride(look: Partial<SurfaceLook> | null) {
    this.look = look; this.lastKey = "";
    this.sky.setEnvironmentOverride?.(look?.environmentIntensity);
  }

  private apply(frame: EnvironmentFrame, delta?: number) {
    if (this.disposed)
      throw new Error("EnvironmentController has been disposed");
    const { scene, ambient, key, config } = this;
    // The first mine theme spans 0–400m. Its visible sky must not make the
    // deep shaft inherit daylight: reuse the entrance's existing smooth fade.
    const strength = this.surfaceStrength = frame.surface ? Math.max(0, Math.min(1, frame.surfaceLightStrength)) : 0;
    const day = { ...config.surface, ...this.look };
    const cave = frame.surface ? undefined : frame.cave;
    const underground = cave ? { ...config.underground, skyColor: cave.sky, ambientIntensity: cave.ambient, keyColor: cave.key, keyIntensity: cave.keyIntensity } : config.underground;
    const groundLight = cave?.ground ?? frame.groundLight;
    this.target.set(cave?.fog ?? frame.sky);
    // Prewarm is immediate; normal frames retain the existing sky transition history.
    if (delta !== undefined)
      this.blended.lerp(
        this.target,
        1 - Math.exp(-delta * config.transitionSpeed),
      );
    this.sky.setLightingStrength(strength);
    this.sky.setEnabled(frame.surface);
    // One fog throughout, beyond anything drawn on the surface: adding and removing scene.fog switches every
    // material's shader, and each was compiled the first time it was seen in the fog (twelve programs in the first
    // hall, 2026-10-31). 1e4 m stays inside a phone's mediump range.
    scene.fog = this.fog;
    if (frame.surface) { this.fog.near = CLEAR_FOG; this.fog.far = 2 * CLEAR_FOG; }
    else {
      const color = delta === undefined ? this.target : this.blended;
      scene.background = color;
      this.fog.color.copy(color);
      this.fog.near = config.fog.near;
      this.fog.far = config.fog.far;
    }
    ambient.color.set(underground.skyColor).lerp(this.colorTarget.set(day.skyColor), strength);
    ambient.groundColor.set(groundLight).lerp(this.colorTarget.set(day.groundColor), strength);
    ambient.intensity = underground.ambientIntensity + (day.ambientIntensity - underground.ambientIntensity) * strength;
    key.castShadow = false;
    const stamp = `${strength}:${frame.depth}:${frame.sceneryRevision}:${cave ? cave.key + cave.keyIntensity : ''}`;
    if (stamp !== this.lastKey) {
      const p = underground.keyOffset;
      key.position.set(
        p[0] + (day.sunPosition[0] - p[0]) * strength,
        p[1] - frame.depth + (day.sunPosition[1] - p[1] + frame.depth) * strength,
        p[2] + (day.sunPosition[2] - p[2]) * strength,
      );
      key.color.set(underground.keyColor).lerp(this.colorTarget.set(day.sunColor), strength);
      key.intensity = underground.keyIntensity + (day.sunIntensity - underground.keyIntensity) * strength;
      key.target.position.set(0, -frame.depth, 0);
      key.target.updateMatrixWorld();
      this.lastKey = stamp;
      this.updates++;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sky.dispose();
    this.scene.fog = this.previousFog;
    this.scene.background = this.previousBackground;
  }
}
