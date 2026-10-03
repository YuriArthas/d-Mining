// Original pixel crack pattern, generated once. Later stages retain earlier branches.
export const CRACK_STAGES = 10;
export const CRACK_TILE = 32;
export function crackStage(hp: number, maximum: number) {
  if (hp >= maximum) return 0;
  return Math.min(CRACK_STAGES, Math.max(1, Math.ceil((1 - hp / maximum) * CRACK_STAGES - 1e-9)));
}
const branches = [
  [[16,16],[13,13],[14,10],[11,7],[12,3],[10,0]],
  [[16,16],[19,14],[22,15],[25,11],[29,10],[31,7]],
  [[16,16],[17,20],[14,23],[15,27],[12,31]],
  [[16,16],[12,18],[9,17],[5,20],[2,19],[0,21]],
  [[22,15],[23,19],[27,21],[27,25],[31,28]],
  [[14,10],[18,8],[19,5],[23,3],[24,0]],
  [[9,17],[8,13],[5,11],[5,6],[1,4],[0,1]],
  [[14,23],[10,25],[8,28],[4,28],[2,31]],
  [[27,21],[30,18],[31,16]],
  [[5,20],[5,24],[2,25],[0,24]],
];
export function crackAtlas() {
  const pixels = new Uint8Array(CRACK_TILE * CRACK_TILE * CRACK_STAGES * 4);
  for (let stage = 1; stage <= CRACK_STAGES; stage++) {
    const mask = new Uint8Array(CRACK_TILE * CRACK_TILE);
    const mark = (x: number, y: number) => { if (x >= 0 && x < CRACK_TILE && y >= 0 && y < CRACK_TILE) mask[y * CRACK_TILE + x] = 1; };
    branches.forEach((points, branch) => {
      const progress = Math.min(1, Math.max(0, (stage - Math.floor(branch / 2)) / 6));
      const length = points.slice(1).reduce((sum, p, i) => sum + Math.max(Math.abs(p[0] - points[i][0]), Math.abs(p[1] - points[i][1])), 0);
      let remaining = Math.ceil(length * progress);
      for (let i = 1; i < points.length && remaining > 0; i++) {
        const [ax, ay] = points[i - 1], [bx, by] = points[i], steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        for (let j = 0; j <= Math.min(steps, remaining); j++) {
          const x = Math.round(ax + (bx - ax) * j / steps), y = Math.round(ay + (by - ay) * j / steps);
          mark(x, y); if (stage >= 8 && branch < 4) mark(x + 1, y);
        }
        remaining -= steps;
      }
    });
    for (let y = 0; y < CRACK_TILE; y++) for (let x = 0; x < CRACK_TILE; x++) {
      const dark = mask[y * CRACK_TILE + x], edge = x > 0 && y > 0 && mask[(y - 1) * CRACK_TILE + x - 1];
      if (!dark && !edge) continue;
      const offset = (y * CRACK_TILE * CRACK_STAGES + (stage - 1) * CRACK_TILE + x) * 4;
      pixels.set(dark ? [27, 25, 24, 225] : [228, 214, 175, 125], offset);
    }
  }
  return pixels;
}
