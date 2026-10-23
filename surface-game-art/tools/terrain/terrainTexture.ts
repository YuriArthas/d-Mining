import * as THREE from 'three';
import { rng } from './kit.ts';

export type GroundKind = 'grass' | 'path' | 'sand' | 'stone' | 'bed';
export const groundTextureBounds = { x: -96, z: -81, size: 192, pixels: 512 };
const palette = {
  grass: ['#8fdd7b', '#87d673', '#98e485'],
  path: ['#fdf1d6', '#fffaea', '#f1e1bf'],
  sand: ['#e6c584', '#f0d39a', '#d5b477'],
  stone: ['#a7bfc0', '#c0d0c9', '#8fa9b0'],
  bed: ['#398f9a', '#439ca4', '#337e8e'],
};
function rgba(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, value >> 8 & 255, value & 255, 255];
}
function finish(data: Uint8Array, size: number, name: string, repeat = false) {
  const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  map.name = name; map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestMipmapNearestFilter;
  map.generateMipmaps = true;
  map.wrapS = map.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  map.needsUpdate = true;
  // A deterministic fingerprint of the actual byte asset, independent of JPEG,
  // screenshot resolution, camera position or the screen's device pixel ratio.
  let fingerprint = 2166136261;
  for (const value of data) fingerprint = Math.imul(fingerprint ^ value, 16777619) >>> 0;
  map.userData = { generatedIn: 'src/terrainTexture.ts', width: size, height: size, bytes: data.byteLength, fnv1a: fingerprint.toString(16).padStart(8, '0') };
  return map;
}

/** Authored world-space surface pixels: sparse joined patches, never white noise. */
export function createGroundTexture(classify: (x: number, z: number) => GroundKind) {
  const { x: originX, z: originZ, size: worldSize, pixels } = groundTextureBounds;
  const data = new Uint8Array(pixels * pixels * 4), kinds: GroundKind[] = new Array(pixels * pixels);
  const colors = Object.fromEntries(Object.entries(palette).map(([kind, entries]) => [kind, entries.map(rgba)])) as Record<GroundKind, number[][]>;
  for (let row = 0; row < pixels; row++) for (let col = 0; col < pixels; col++) {
    const x = originX + (col + .5) / pixels * worldSize, z = originZ + (row + .5) / pixels * worldSize;
    const kind = classify(x, z), index = row * pixels + col;
    kinds[index] = kind; data.set(colors[kind][0], index * 4);
  }
  const random = rng(516221);
  // Small pixel-art clusters occupy only a fraction of the grass and path.
  // Joined rectangles provide the texture rhythm; individual pixels stay quiet.
  for (let patch = 0; patch < 520; patch++) {
    const x = Math.floor(random() * (pixels - 8)), y = Math.floor(random() * (pixels - 8));
    const kind = kinds[y * pixels + x], shade = patch % 3 === 0 ? 2 : 1;
    const width = 2 + Math.floor(random() * 5), height = 1 + Math.floor(random() * 3);
    for (let py = 0; py < height + 1; py++) for (let px = 0; px < width; px++) {
      if (py === height && (px < 1 || px > width - 3)) continue;
      const index = (y + py) * pixels + x + px;
      if (kinds[index] === kind) data.set(colors[kind][shade], index * 4);
    }
  }
  return finish(data, pixels, 'Roblox meadow: restrained 512px world surface');
}

/** One restrained sandstone/rock tile shared by vertical banks and shaft steps. */
export function createStoneTexture() {
  const size = 64, data = new Uint8Array(size * size * 4), base = rgba('#dce2dc');
  for (let i = 0; i < size * size; i++) data.set(base, i * 4);
  const patch = (x: number, y: number, width: number, height: number, color: string) => {
    const value = rgba(color);
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) data.set(value, (py * size + px) * 4);
  };
  patch(3, 7, 12, 3, '#c4cfcf'); patch(8, 10, 5, 2, '#c4cfcf');
  patch(31, 19, 17, 3, '#edf0e1'); patch(38, 22, 13, 2, '#edf0e1');
  patch(14, 40, 16, 4, '#bfcdd0'); patch(23, 44, 9, 2, '#bfcdd0');
  patch(43, 53, 12, 3, '#edf0e1');
  return finish(data, size, 'Blockcraft stone: authored 64px strata', true);
}

/** Water is a matte pixel-painted surface, with no ripple normals or reflections. */
export function createWaterTexture() {
  const size = 64, data = new Uint8Array(size * size * 4), base = rgba('#32b8c7');
  for (let i = 0; i < size * size; i++) data.set(base, i * 4);
  const patch = (x: number, y: number, width: number, height: number, color: string) => {
    const value = rgba(color);
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) data.set(value, (py * size + px) * 4);
  };
  patch(4, 10, 16, 5, '#3cc1ce'); patch(12, 15, 10, 3, '#3cc1ce');
  patch(33, 35, 17, 5, '#2aabbf'); patch(39, 40, 11, 4, '#2aabbf');
  patch(9, 11, 6, 2, '#a2e2dc'); patch(44, 51, 8, 2, '#a2e2dc');
  patch(40, 49, 4, 2, '#72d3d5');
  return finish(data, size, 'Blockcraft water: authored 64px broad glints', true);
}

/** Sparse pixel accents remain on an otherwise broad, clean cream-sand road: the ground is a light, calm
 *  stage so the buildings, portals and characters stand out (as in the original game). */
export function createPathTexture() {
  const size = 64, data = new Uint8Array(size * size * 4), base = rgba('#fdf1d6');
  for (let i = 0; i < size * size; i++) data.set(base, i * 4);
  for (const [x, y, width, height, color] of [[5, 8, 9, 3, '#fffaea'], [10, 11, 7, 2, '#fffaea'], [38, 39, 11, 3, '#f1e1bf'], [32, 41, 9, 2, '#f1e1bf']] as const) {
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) data.set(rgba(color), (py * size + px) * 4);
  }
  return finish(data, size, 'Roblox path: sparse 64px accents', true);
}
