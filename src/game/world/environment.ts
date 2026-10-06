import type { EnvironmentConfig } from "../presentation/EnvironmentController.ts";
import { GAME_CONFIG } from "../config.ts";
import { SURFACE_LIGHTING } from "./SceneLighting.ts";

export const ENVIRONMENT_CONFIG = {
  initialBackground: GAME_CONFIG.background,
  transitionSpeed: 4,
  fog: { near: 38, far: 74 },
  surface: SURFACE_LIGHTING,
  sky: {
    dayZenith: "#358edf",
    dayHorizon: "#c5ebff",
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
