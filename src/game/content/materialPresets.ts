// Shared paint response. Shader algorithms remain in presentation/MineAtmosphere.
export type MaterialPresets = Readonly<{
  standard: Readonly<{
    metalness: number;
    roughnessFloor: number;
    envMapIntensity: number;
  }>;
  authoredColor: Readonly<{ roughness: number; envMapIntensity: number }>;
}>;
export const MATERIAL_PRESETS: MaterialPresets = {
  standard: { metalness: 0, roughnessFloor: 0.9, envMapIntensity: 0.45 },
  authoredColor: { roughness: 0.86, envMapIntensity: 0.35 },
} as const;
