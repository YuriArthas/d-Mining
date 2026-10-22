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

export function blendedCameraLook(daylight: number): CameraLook {
  if (daylight <= 0) return CAMERA_LOOKS.night;
  if (daylight >= 1) return CAMERA_LOOKS.day;
  const night = CAMERA_LOOKS.night, day = CAMERA_LOOKS.day;
  const mix = (a: number, b: number) => a + (b - a) * daylight;
  const tint = (a: readonly number[], b: readonly number[]): readonly [number, number, number] => [mix(a[0], b[0]), mix(a[1], b[1]), mix(a[2], b[2])];
  return {
    contrast: mix(night.contrast, day.contrast), saturation: mix(night.saturation, day.saturation),
    greenSaturation: mix(night.greenSaturation, day.greenSaturation), tintStrength: mix(night.tintStrength, day.tintStrength),
    shadowTint: tint(night.shadowTint, day.shadowTint), highlightTint: tint(night.highlightTint, day.highlightTint),
  };
}
