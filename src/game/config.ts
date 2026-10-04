import { SURFACE_SPAWN } from './world/surfaceLayout.ts';
// World distances are metres. Rendered geometry and cell queries share cellSize.
export const GAME_CONFIG = {
  background: '#c0dde0',
  pixelRatioMax: 1.5, // Device pixel ratio cap; positive, normally 1–2.
  player: { radius: 0.4, height: 1.65, spawn: SURFACE_SPAWN },
  camera: {
    distance: 10.5, // Metres from the player's observation target.
    targetHeight: 1.9, // Keep the initial crosshair above the cylinder rather than on its back.
    initialYaw: 0,
    initialPitch: 0.04,
    minPitch: -0.55, // Radians; look upward from a shaft without crossing the floor.
    maxPitch: 1.45, // Almost straight down, with a stable horizontal heading.
    near: 0.08, // Metres; reduced only for extreme landscape aspect ratios.
    minProbeRadius: 0.18,
    maxProbeRadius: 0.28, // Must fit inside the 0.4 m player capsule.
    clearance: 0.025,
    followSharpness: 14, // Exponential vertical follow rate, per second.
    maxVerticalLag: 0.4, // Metres; bound lag while falling.
    recoverSharpness: 5, // Per second; fast contraction, gentle boom recovery.
    hideGap: 0.12, // Distance from player volume at which it becomes invisible.
    showGap: 0.8, // Full opacity beyond this gap.
    fov: 55, // Vertical degrees.
    mouseSensitivity: 0.004, // Radians per CSS pixel, independent of device pixel ratio.
    touchSensitivity: 0.006,
  },
  input: {
    mineHoldMs: 180, // Stationary hold before mining; milliseconds.
    lookThresholdPx: 10, // Screen CSS pixels from initial touch; rotation preserves distance.
    stickRadius: 46, // CSS pixels; maximum travel inside the 128px joystick.
    stickDeadZone: 0.12, // Fraction of radius, in [0, 1).
  },
} as const;
