import type { SurfaceTime } from '../world/SceneLighting.ts';

export type CameraLook = Readonly<{
  contrast: number;
  saturation: number;
  greenSaturation: number;
  shadowTint: readonly [number, number, number];
  highlightTint: readonly [number, number, number];
  tintStrength: number;
}>;
// Display-space finishing after the existing Neutral tone mapper. No second exposure/gamma transform.
export const CAMERA_LOOKS: Readonly<Record<SurfaceTime, CameraLook>> = {
  night: {
    contrast: 0.6, saturation: 1.08, greenSaturation: 0.87,
    shadowTint: [0.83, 0.95, 1.18], highlightTint: [1.035, 1.012, 0.97], tintStrength: 0.62,
  },
  day: {
    contrast: 0.42, saturation: 1.07, greenSaturation: 0.93,
    shadowTint: [0.92, 0.98, 1.09], highlightTint: [1.025, 1.008, 0.97], tintStrength: 0.4,
  },
};
