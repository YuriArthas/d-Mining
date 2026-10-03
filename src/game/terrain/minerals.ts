export const MINERALS = [
  { id: 1, name: '岩石', color: '#87918c' },
  { id: 2, name: '深层岩石', color: '#465773' },
  { id: 3, name: '煤矿', color: '#292d34' },
  { id: 4, name: '铜矿', color: '#d67d42' },
  { id: 5, name: '金矿', color: '#f1c653' },
  { id: 6, name: '水晶', color: '#58d7e8' },
] as const;
export function mineralName(id: number) { return MINERALS[id - 1]?.name ?? ''; }
export const ORE_SAMPLES = [
  { name: '整片', x: -16, z: -32, spawn: [-15, 0.1, -47] as const },
  { name: '条带', x: 0, z: -32, spawn: [17, 0.1, -47] as const },
  { name: '交错', x: 16, z: -32, spawn: [49, 0.1, -47] as const },
] as const;
// A fixed validation strip, generated on demand just like the rest of the mine.
// All three patches have identical occupancy and span one 16-cell render region.
export function sampleMineral(x: number, y: number, z: number): number | null {
  if (y < -16 || y >= 0 || z < -32 || z >= -16 || x < -16 || x >= 32) return null;
  if (x < 0) return 1;
  if (x < 16) return 1 + Math.floor(x * MINERALS.length / 16);
  return 1 + ((x - 16 + z + 32) % MINERALS.length);
}
export function generatedMineral(x: number, y: number, z: number, seed: number) {
  const sample = sampleMineral(x, y, z);
  if (sample !== null) return sample;
  // Coherent small deposits instead of independent noise at every voxel. No
  // cache or voxel arrays; world coordinates also keep veins continuous at seams.
  const hash = (Math.imul(Math.floor(x / 3), 73856093) ^ Math.imul(Math.floor(y / 3), 19349663) ^ Math.imul(Math.floor(z / 3), 83492791) ^ seed) >>> 0;
  const ore = hash % 100;
  if (ore < 9) return 3;
  if (ore < 18) return 4;
  if (ore < (y < -250 ? 25 : 22)) return 5;
  if (ore < (y < -500 ? 32 : 25)) return 6;
  return y < -500 ? 2 : 1;
}

export const TILE_SIZE = 32;
// Small code-generated pixel atlas: one shared texture, no per-block assets.
export function mineralAtlas() {
  const pixels = new Uint8Array(TILE_SIZE * TILE_SIZE * MINERALS.length * 4);
  const bases = [[122,134,129],[60,75,100],[115,124,127],[122,124,116],[119,126,119],[63,83,103]];
  const accents = [[145,155,149],[93,112,144],[26,31,38],[216,127,65],[241,199,75],[73,215,234]];
  for (let tile = 0; tile < MINERALS.length; tile++) for (let y = 0; y < TILE_SIZE; y++) for (let x = 0; x < TILE_SIZE; x++) {
    const noise = (((x >> 1) * 13 + (y >> 1) * 7 + tile * 17) % 7 - 3) * 2;
    let mark = false;
    if (tile === 1) mark = (y + Math.floor(x / 7)) % 8 < 2;
    for (const [cx,cy] of [[7,9],[24,7],[18,23],[4,27]]) {
      const dx = Math.abs(x-cx), dy = Math.abs(y-cy);
      if (tile === 0 && dx < 4 && dy < 2) mark = true;
      if (tile === 2 && dx + dy < 5) mark = true;
      if (tile === 3 && dx < 5 && Math.abs(y-cy-Math.floor((x-cx)/2)) < 2) mark = true;
      if (tile === 4 && dx < 4 && dy < 3) mark = true;
      if (tile === 5 && dx * 2 + dy < 7) mark = true;
    }
    const color = mark ? accents[tile] : bases[tile];
    const index = ((y * MINERALS.length * TILE_SIZE) + tile * TILE_SIZE + x) * 4;
    for (let c = 0; c < 3; c++) pixels[index+c] = color[c] + noise;
    pixels[index+3] = 255;
  }
  return pixels;
}
