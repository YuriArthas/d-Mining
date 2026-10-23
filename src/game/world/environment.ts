import type { EnvironmentConfig } from "../presentation/EnvironmentController.ts";
import { GAME_CONFIG } from "../config.ts";
import { SURFACE_LIGHTING } from "./SceneLighting.ts";

export const ENVIRONMENT_CONFIG = {
  initialBackground: GAME_CONFIG.background,
  transitionSpeed: 4,
  fog: { near: 38, far: 74 },
  surface: SURFACE_LIGHTING,
  sky: {
    // A saturated blue down to the horizon, as in the original game: the pale horizon read as haze.
    dayZenith: "#2a86dd",
    dayHorizon: "#7cc5f3",
    nightZenith: "#24385f",
    nightHorizon: "#647fa4",
    lighting: SURFACE_LIGHTING,
  },
  underground: {
    skyColor: "#eef4ef",
    ambientIntensity: 1.15,
    keyColor: "#ffefd5",
    keyIntensity: 2.5,
    keyOffset: [-24, 42, 20],
  },
} as const satisfies EnvironmentConfig;
