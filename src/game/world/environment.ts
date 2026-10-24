import type { EnvironmentConfig } from "../presentation/EnvironmentController.ts";
import { GAME_CONFIG } from "../config.ts";
import { SURFACE_DAYLIGHT } from "./SceneLighting.ts";

export const ENVIRONMENT_CONFIG = {
  initialBackground: GAME_CONFIG.background,
  transitionSpeed: 4,
  fog: { near: 38, far: 74 },
  surface: SURFACE_DAYLIGHT,
  sky: {
    // A saturated blue down to the horizon, as in the original game: a pale horizon read as haze.
    zenith: "#2a86dd",
    horizon: "#7cc5f3",
    sunPosition: SURFACE_DAYLIGHT.sunPosition,
    environmentIntensity: SURFACE_DAYLIGHT.environmentIntensity,
  },
  underground: {
    skyColor: "#eef4ef",
    ambientIntensity: 1.15,
    keyColor: "#ffefd5",
    keyIntensity: 2.5,
    keyOffset: [-24, 42, 20],
  },
} as const satisfies EnvironmentConfig;
