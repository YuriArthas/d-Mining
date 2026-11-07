import * as THREE from 'three/webgpu';
import {loadJSON, loadResource} from './resourceLoading.ts';

declare const __MATERIAL_REVISION__: string;

export type MaterialVariant = 'baseline' | 'crafted';

type TextureRecord = { file: string; sha256: string; width: number; height: number; bytes: number };
type MaterialRecord = {
  name: string;
  baseColor: string;
  roughness: number;
  metalness: number;
  tileMetres?: number;
  emissive?: string;
  emissiveIntensity?: number;
  maps?: Record<'albedo' | 'normal' | 'roughness', TextureRecord>;
};
type MaterialManifest = {
  version: number;
  generatorSha256: string;
  materials: Record<string, MaterialRecord>;
  variants: { crafted: { materials: Record<string, MaterialRecord> } };
  availableProfiles?: MaterialVariant[];
  variantBudgets: Partial<Record<MaterialVariant, MaterialBudget>>;
  budget: MaterialBudget;
};
type MaterialBudget = { textureCount: number; downloadBytes: number; estimatedRGBAWithMipBytes: number };
type LoadedMaps = { color: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture };

/** Every texture is authored in physical metres; model UVs use one unit/metre. */
export async function loadMaterials(profiles:MaterialVariant[]=['baseline','crafted']): Promise<{
  materials: Record<string, THREE.MeshStandardMaterial>;
  setDetailed(value: boolean): void;
  setVariant(value: MaterialVariant): void;
  snapshot(): unknown;
  dispose(): void;
}> {
  const base = new URL('assets/materials/', document.baseURI);
  const manifestURL = new URL(`materials.json?v=${__MATERIAL_REVISION__}`, base);
  const manifest = await loadJSON<MaterialManifest>(manifestURL);
  if (manifest.version !== 2 || !manifest.materials || !manifest.variants?.crafted?.materials
    || !manifest.budget || profiles.some(profile=>!manifest.variantBudgets?.[profile]
      || (manifest.availableProfiles&&!manifest.availableProfiles.includes(profile)))) {
    throw new Error('Invalid authored material manifest');
  }
  const records: Record<MaterialVariant, Record<string, MaterialRecord>> = {
    baseline: manifest.materials,
    crafted: { ...manifest.materials, ...manifest.variants.crafted.materials },
  };
  for (const name of Object.keys(manifest.variants.crafted.materials)) {
    if (!manifest.materials[name]) throw new Error(`Unknown material variant override: ${name}`);
  }
  const loader = new THREE.TextureLoader();
  const materials: Record<string, THREE.MeshStandardMaterial> = {};
  const textures = new Set<THREE.Texture>();
  const maps: Record<MaterialVariant, Map<string, LoadedMaps>> = {
    baseline: new Map(), crafted: new Map(),
  };
  const pendingTextures = new Map<string, Promise<THREE.Texture>>();
  let detailed = true;
  if(!profiles.length||new Set(profiles).size!==profiles.length||profiles.some(p=>!['baseline','crafted'].includes(p)))throw Error('Invalid requested material profiles');
  let variant: MaterialVariant = profiles[0];

  function loadTexture(record: TextureRecord, tileMetres: number, color: boolean): Promise<THREE.Texture> {
    const key = `${record.file}:${record.sha256}:${tileMetres}:${color}`;
    let pending = pendingTextures.get(key);
    if (!pending) {
      pending = (async () => {
        const url = new URL(`${record.file}?v=${record.sha256}`, base).href;
        const texture = await loadResource(url, () => loader.loadAsync(url));
        textures.add(texture);
        const image = texture.image as HTMLImageElement;
        if (image.width !== record.width || image.height !== record.height) {
          throw new Error(`Unexpected dimensions for ${record.file}`);
        }
        texture.name = record.file;
        texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.setScalar(1 / tileMetres);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.anisotropy = 4;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        return texture;
      })();
      pendingTextures.set(key, pending);
    }
    return pending;
  }

  function dispose(): void {
    for (const material of Object.values(materials)) material.dispose();
    for (const texture of textures) texture.dispose();
  }

  for (const [name, record] of Object.entries(manifest.materials)) {
      materials[name] = new THREE.MeshStandardMaterial({
        name,
        color: record.baseColor,
        roughness: record.roughness,
        metalness: record.metalness,
        emissive: record.emissive ?? '#000000',
        emissiveIntensity: record.emissiveIntensity ?? 0,
      });
  }
  // The courtyard compares both profiles; the street only uses crafted maps.
  // Do not fetch or keep a second, unreachable texture set for the street.
  const results = await Promise.allSettled(profiles.flatMap(profile =>
    Object.entries(records[profile]).map(async ([name, record]) => {
      if (record.maps) {
        if (!record.tileMetres || record.tileMetres <= 0) throw new Error(`Missing material scale: ${name}`);
        const loaded = await Promise.allSettled([
          loadTexture(record.maps.albedo, record.tileMetres, true),
          loadTexture(record.maps.normal, record.tileMetres, false),
          loadTexture(record.maps.roughness, record.tileMetres, false),
        ]);
        const [color, normal, roughness] = loaded.map(result => {
          if (result.status === 'rejected') throw result.reason;
          return result.value;
        });
        maps[profile].set(name, { color, normal, roughness });
      }
  })));
  for (const result of results) {
    if (result.status === 'rejected') {
      dispose();
      throw result.reason;
    }
  }
  const expectedTextures=new Set(profiles.flatMap(profile=>Object.values(records[profile]).flatMap(record=>record.maps?Object.values(record.maps).map(map=>`${map.file}:${map.sha256}:${record.tileMetres}:${map===record.maps!.albedo}`):[]))).size;
  if (textures.size !== expectedTextures) {
    dispose();
    throw new Error(`Material texture count mismatch: ${textures.size} / ${expectedTextures}`);
  }

  function applyProfile(): void {
    for (const [name, map] of maps[variant]) {
      const material = materials[name];
      const record = records[variant][name];
      material.map = detailed ? map.color : null;
      material.normalMap = detailed ? map.normal : null;
      material.normalScale.set(1, 1);
      material.roughnessMap = detailed ? map.roughness : null;
      material.color.set(detailed ? '#ffffff' : record.baseColor);
      // Roughness maps encode absolute roughness, not a multiplier texture.
      material.roughness = detailed ? 1 : record.roughness;
      // The model supplies one constant linear RGB tint per physical slab.
      // Baseline deliberately ignores those attributes to remain identical.
      material.vertexColors = variant === 'crafted' && (name === 'limestone' || name === 'sandstone');
      material.needsUpdate = true;
    }
  }
  applyProfile();

  return {
    materials,
    setDetailed(value: boolean): void {
      if (detailed === value) return;
      detailed = value;
      applyProfile();
    },
    setVariant(value: MaterialVariant): void {
      if (value !== 'baseline' && value !== 'crafted') throw new Error(`Unknown material variant: ${value}`);
      if(!profiles.includes(value))throw Error(`Material profile was not loaded: ${value}`);
      if (variant === value) return;
      variant = value;
      applyProfile();
    },
    snapshot(): unknown {
      return {
        revision: __MATERIAL_REVISION__,
        generatorSha256: manifest.generatorSha256,
        detailed,
        variant,
        materialCount: Object.keys(materials).length,
        ...manifest.budget,
        residentTextureCount: textures.size,
        activeTextureCount: detailed ? manifest.variantBudgets[variant]!.textureCount : 0,
        activeBudget: manifest.variantBudgets[variant],
        availableVariants: profiles,
        materials: Object.fromEntries(Object.entries(records[variant]).map(([name, record]) => [name, {
          baseColor: record.baseColor,
          roughness: record.roughness,
          metalness: record.metalness,
          tileMetres: record.tileMetres ?? null,
          vertexColors: materials[name].vertexColors,
          mapFiles: record.maps ? Object.values(record.maps).map(map => ({ file: map.file, sha256: map.sha256 })) : [],
        }])),
      };
    },
    dispose,
  };
}
