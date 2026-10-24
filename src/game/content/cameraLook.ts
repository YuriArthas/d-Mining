export type CameraLook = Readonly<{
  contrast: number;
  saturation: number;
  greenSaturation: number;
  shadowTint: readonly [number, number, number];
  highlightTint: readonly [number, number, number];
  tintStrength: number;
}>;
// Display-space finishing after the existing Neutral tone mapper. No second exposure/gamma transform.
// The surface is in daylight; underground the darker, cooler, more contrasted finish.
export const CAMERA_LOOKS: Readonly<Record<'surface' | 'underground', CameraLook>> = {
  underground: {
    contrast: 0.6, saturation: 1.08, greenSaturation: 0.87,
    shadowTint: [0.83, 0.95, 1.18], highlightTint: [1.035, 1.012, 0.97], tintStrength: 0.62,
  },
  surface: {
    contrast: 0.42, saturation: 1.07, greenSaturation: 0.93,
    shadowTint: [0.92, 0.98, 1.09], highlightTint: [1.025, 1.008, 0.97], tintStrength: 0.4,
  },
};

/** The finish for how much surface light reaches the player (1 in the open, 0 underground). */
export function blendedCameraLook(surface: number): CameraLook {
  const { underground, surface: open } = CAMERA_LOOKS;
  if (surface <= 0) return underground;
  if (surface >= 1) return open;
  const mix = (a: number, b: number) => a + (b - a) * surface;
  const tint = (a: readonly number[], b: readonly number[]): readonly [number, number, number] => [mix(a[0], b[0]), mix(a[1], b[1]), mix(a[2], b[2])];
  return {
    contrast: mix(underground.contrast, open.contrast), saturation: mix(underground.saturation, open.saturation),
    greenSaturation: mix(underground.greenSaturation, open.greenSaturation), tintStrength: mix(underground.tintStrength, open.tintStrength),
    shadowTint: tint(underground.shadowTint, open.shadowTint), highlightTint: tint(underground.highlightTint, open.highlightTint),
  };
}
