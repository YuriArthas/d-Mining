/** Baked sun visibility for characters walking the valley (surface-game-art/tools/terrain/bakeLight.mjs,
 *  `standing`): a coarse top-down grid of the sun 1 m above the floor, plus the floor height, read on the
 *  CPU once per frame for the player. Off the grid, high above the floor (terraces, the bridge deck) or
 *  below it (inside the mine) the character counts as fully sunlit, like before. */
export type StandingLightGrid = {
  size: number; data: Uint8ClampedArray | Uint8Array; x0: number; z0: number; span: number; heightStep: number;
};
/** Further than this from the floor below, the floor's light says nothing about the character. */
const FLOOR_REACH = 0.8;
let grid: StandingLightGrid | null = null;

export function setStandingLight(value: StandingLightGrid | null) { grid = value; }
export function standingLightLoaded() { return grid !== null; }

/** Sun visibility (0–1) for a character standing at (x, y, z). */
export function standingSun(x: number, y: number, z: number) {
  if (!grid) return 1;
  const { size, data } = grid;
  const u = (x - grid.x0) / grid.span * size - .5, v = (z - grid.z0) / grid.span * size - .5;
  if (!(u >= 0 && v >= 0 && u <= size - 1 && v <= size - 1)) return 1;
  const nearest = (Math.round(v) * size + Math.round(u)) * 4;
  if (Math.abs(y - data[nearest + 1] * grid.heightStep) > FLOOR_REACH) return 1;
  const i = Math.min(size - 2, Math.floor(u)), j = Math.min(size - 2, Math.floor(v)), fu = u - i, fv = v - j;
  const at = (a: number, b: number) => data[((j + b) * size + i + a) * 4];
  return ((at(0, 0) * (1 - fu) + at(1, 0) * fu) * (1 - fv) + (at(0, 1) * (1 - fu) + at(1, 1) * fu) * fv) / 255;
}

/** Decodes the baked PNG (red: sun, green: floor height) without colour management. */
export async function loadStandingLight(url: string, rect: { x0: number; z0: number; size: number }, heightStep: number, signal: AbortSignal): Promise<StandingLightGrid> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`角色光照数据下载失败 HTTP ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  try {
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bitmap.width, bitmap.height) : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const context = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!context) throw new Error('无法读取角色光照数据');
    context.drawImage(bitmap, 0, 0);
    return { size: bitmap.width, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data, x0: rect.x0, z0: rect.z0, span: rect.size, heightStep };
  } finally { bitmap.close(); }
}
