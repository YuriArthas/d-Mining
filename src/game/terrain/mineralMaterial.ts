import { DataTexture, MeshStandardMaterial, NearestFilter, RGBAFormat, ShaderChunk, SRGBColorSpace } from 'three';
import { MINERALS, TILE_SIZE, mineralAtlas } from './minerals.ts';

export function createMineralMaterial() {
  const pixels = mineralAtlas();
  const atlas = new DataTexture(pixels, TILE_SIZE * MINERALS.length, TILE_SIZE, RGBAFormat);
  atlas.colorSpace = SRGBColorSpace;
  atlas.magFilter = atlas.minFilter = NearestFilter;
  atlas.generateMipmaps = false; atlas.needsUpdate = true;
  const material = new MeshStandardMaterial({ map: atlas, roughness: 1 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float oreTile;\nvarying float vOreTile;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvOreTile = oreTile;');
    shader.fragmentShader = 'varying float vOreTile;\n' + shader.fragmentShader;
    // UVs are in cell units. Repeat on every voxel face even if a quad spans an
    // entire region. Nearest sampling with no mipmaps cannot bleed atlas tiles.
    const map = ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )',
      `texture2D( map, vec2((vOreTile + fract(vMapUv.x)) / ${MINERALS.length.toFixed(1)}, fract(vMapUv.y)))`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', map);
  };
  material.customProgramCacheKey = () => 'mineral-atlas-v1';
  return { material, atlasBytes: pixels.byteLength, dispose: () => { material.dispose(); atlas.dispose(); } };
}
