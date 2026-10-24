// Pet art drawn in code, shared by the 3D pets (as textures) and the UI portraits (drawn directly),
// so both always show the same pet: a cute face per animal, a pattern per egg, sparkles per tier.
import type { PetFace, PetLook, PetPattern, PetSparkle } from '../../content/petLooks.ts';

type G = CanvasRenderingContext2D;
const INK = '#2a1c14', PINK = '#ff8fa8', MUZZLE = '#fff4e2', SHADE = 'rgba(0,0,0,.22)';

// ---- Faces: authored on a 256 x 256 square that covers the front of the cube. -------------------------

function circle(g: G, x: number, y: number, r: number, fill: string) { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function ellipse(g: G, x: number, y: number, rx: number, ry: number, fill: string, rotation = 0) { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); g.fill(); }
function poly(g: G, points: readonly (readonly [number, number])[], fill: string) { g.fillStyle = fill; g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); }
function stroke(g: G, width: number, draw: () => void, color = INK) { g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); draw(); g.stroke(); }

/** Big glossy eyes; closed they become happy arcs. */
function eyes(g: G, blink: boolean, y = 118, gap = 44, r = 30, iris = '#3a2618') {
  for (const x of [128 - gap, 128 + gap]) {
    if (blink) { stroke(g, 8, () => g.arc(x, y + 4, r * .62, Math.PI * 1.15, Math.PI * 1.85)); continue; }
    circle(g, x, y, r, iris);
    circle(g, x - r * .32, y - r * .34, r * .4, '#ffffff');
    circle(g, x + r * .36, y + r * .3, r * .17, '#ffffff');
  }
}
const blush = (g: G, y = 152, gap = 70) => { for (const x of [128 - gap, 128 + gap]) ellipse(g, x, y, 21, 12, PINK + 'b0'); };
const omega = (g: G, y = 158) => stroke(g, 6, () => { g.moveTo(112, y); g.quadraticCurveTo(120, y + 12, 128, y); g.quadraticCurveTo(136, y + 12, 144, y); });
const smile = (g: G, y = 156, w = 22) => stroke(g, 6, () => { g.moveTo(128 - w, y); g.quadraticCurveTo(128, y + w * .8, 128 + w, y); });
const whiskers = (g: G, y = 150) => stroke(g, 4, () => { for (const s of [-1, 1]) for (const d of [-7, 4]) { g.moveTo(128 + s * 34, y + d * .3); g.lineTo(128 + s * 74, y + d); } });
const cornerEars = (g: G, fill: string, inner?: string) => {
  for (const s of [-1, 1]) {
    poly(g, [[128 + s * 128, 0], [128 + s * 58, 0], [128 + s * 120, 64]], fill);
    if (inner) poly(g, [[128 + s * 116, 6], [128 + s * 76, 6], [128 + s * 112, 42]], inner);
  }
};
const antennae = (g: G, tip: string) => {
  for (const s of [-1, 1]) { stroke(g, 6, () => { g.moveTo(128 + s * 26, 46); g.quadraticCurveTo(128 + s * 40, 16, 128 + s * 62, 12); }); circle(g, 128 + s * 62, 12, 9, tip); }
};

const FACES: Readonly<Record<PetFace, (g: G, blink: boolean) => void>> = {
  slime: (g, b) => { eyes(g, b); blush(g); omega(g); },
  mole: (g, b) => { eyes(g, b, 112, 40, 17); blush(g, 146, 74); ellipse(g, 128, 142, 22, 16, '#f5a3b5'); whiskers(g, 146); omega(g, 170); },
  rabbit: (g, b) => {
    for (const s of [-1, 1]) { ellipse(g, 128 + s * 40, 24, 17, 44, SHADE); ellipse(g, 128 + s * 40, 26, 8, 32, PINK + '90'); }
    eyes(g, b, 122); blush(g, 156); ellipse(g, 128, 150, 10, 7, '#f5a3b5'); omega(g, 162);
    g.fillStyle = '#ffffff'; g.fillRect(121, 168, 6, 9); g.fillRect(129, 168, 6, 9);
  },
  fox: (g, b) => { cornerEars(g, SHADE); ellipse(g, 128, 192, 82, 60, MUZZLE); eyes(g, b, 118, 42, 24, '#5a2c10'); blush(g, 154); ellipse(g, 128, 158, 10, 7, INK); omega(g, 172); },
  cat: (g, b) => { cornerEars(g, SHADE, PINK + 'a0'); eyes(g, b, 120); blush(g); ellipse(g, 128, 150, 8, 6, '#f5a3b5'); whiskers(g); omega(g, 160); },
  owl: (g, b) => {
    for (const x of [86, 170]) circle(g, x, 116, 40, '#ffffff');
    eyes(g, b, 118, 42, 25, '#23495a'); stroke(g, 7, () => { g.moveTo(50, 66); g.lineTo(112, 84); g.moveTo(206, 66); g.lineTo(144, 84); }, SHADE);
    poly(g, [[116, 156], [140, 156], [128, 176]], '#f3a33c'); blush(g, 160, 76);
  },
  bird: (g, b) => { poly(g, [[128, 6], [116, 40], [140, 40]], SHADE); eyes(g, b, 118); blush(g, 150); poly(g, [[112, 150], [144, 150], [128, 172]], '#f3a33c'); },
  phoenix: (g, b) => {
    for (const [x, h] of [[104, 30], [128, 44], [152, 30]] as const) poly(g, [[x - 11, 48], [x, 48 - h], [x + 11, 48]], '#ffcf4a');
    eyes(g, b, 120, 40, 25, '#7a2a10'); blush(g, 152); poly(g, [[112, 152], [144, 152], [128, 174]], '#f39a2c');
  },
  bug: (g, b) => { antennae(g, INK); eyes(g, b, 122); blush(g, 156); smile(g, 160, 18); stroke(g, 5, () => { g.moveTo(108, 182); g.lineTo(100, 196); g.moveTo(148, 182); g.lineTo(156, 196); }); },
  bee: (g, b) => { antennae(g, '#ffd23c'); g.fillStyle = 'rgba(40,25,10,.28)'; g.fillRect(0, 186, 256, 22); g.fillRect(0, 222, 256, 22); eyes(g, b, 118); blush(g, 150); omega(g, 158); },
  butterfly: (g, b) => { antennae(g, '#ff9ad1'); for (const s of [-1, 1]) ellipse(g, 128 + s * 96, 168, 26, 36, 'rgba(255,255,255,.4)'); eyes(g, b, 120); blush(g, 154); omega(g, 162); },
  deer: (g, b) => {
    for (const s of [-1, 1]) stroke(g, 9, () => { g.moveTo(128 + s * 44, 44); g.lineTo(128 + s * 54, 6); g.moveTo(128 + s * 50, 24); g.lineTo(128 + s * 74, 14); }, '#8a5a34');
    ellipse(g, 128, 178, 52, 40, MUZZLE); eyes(g, b, 116); blush(g, 150); ellipse(g, 128, 164, 12, 8, INK); omega(g, 180);
  },
  bear: (g, b) => { for (const s of [-1, 1]) { circle(g, 128 + s * 92, 22, 30, SHADE); circle(g, 128 + s * 92, 24, 15, PINK + '80'); } ellipse(g, 128, 172, 50, 38, MUZZLE); eyes(g, b, 116); blush(g, 148, 76); ellipse(g, 128, 160, 14, 10, INK); omega(g, 176); },
  turtle: (g, b) => { eyes(g, b, 116, 44, 24); blush(g, 150); smile(g, 160, 28); circle(g, 120, 140, 3, INK); circle(g, 136, 140, 3, INK); },
  whale: (g, b) => { stroke(g, 6, () => { g.moveTo(128, 34); g.lineTo(128, 12); g.moveTo(128, 18); g.lineTo(112, 4); g.moveTo(128, 18); g.lineTo(144, 4); }, '#bfefff'); eyes(g, b, 136, 50, 22); blush(g, 166, 80); smile(g, 172, 46); },
  fish: (g, b) => { for (const s of [-1, 1]) poly(g, [[128 + s * 128, 120], [128 + s * 96, 104], [128 + s * 96, 152]], SHADE); eyes(g, b, 118, 40, 28); blush(g, 152); circle(g, 128, 168, 11, INK); circle(g, 128, 166, 6, '#ff9db0'); },
  crab: (g, b) => { for (const s of [-1, 1]) stroke(g, 7, () => { g.moveTo(128 + s * 36, 84); g.lineTo(128 + s * 40, 52); }); eyes(g, b, 48, 40, 22); blush(g, 140); smile(g, 150, 36); },
  frog: (g, b) => { for (const s of [-1, 1]) circle(g, 128 + s * 52, 30, 40, 'rgba(255,255,255,.35)'); eyes(g, b, 34, 52, 26); blush(g, 120, 84); smile(g, 132, 60); },
  lion: (g, b) => {
    g.fillStyle = 'rgba(120,52,10,.22)'; g.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; g.lineTo(128 + Math.cos(a) * 128, 136 + Math.sin(a) * 128); g.lineTo(128 + Math.cos(a + .17) * 104, 136 + Math.sin(a + .17) * 104); } g.closePath(); g.fill();
    ellipse(g, 128, 136, 92, 92, 'rgba(255,240,215,.0)'); eyes(g, b, 120); blush(g, 154, 64); poly(g, [[116, 150], [140, 150], [128, 162]], INK); omega(g, 170);
  },
  bull: (g, b) => {
    for (const s of [-1, 1]) poly(g, [[128 + s * 70, 40], [128 + s * 128, 10], [128 + s * 112, 46], [128 + s * 86, 58]], '#f6ead2');
    eyes(g, b, 112); ellipse(g, 128, 176, 58, 34, '#f2b8a8'); circle(g, 108, 176, 7, INK); circle(g, 148, 176, 7, INK);
    stroke(g, 6, () => g.arc(128, 202, 16, Math.PI * 1.1, Math.PI * 1.9), '#e8c34a');
  },
  bat: (g, b) => { for (const s of [-1, 1]) poly(g, [[128 + s * 128, 0], [128 + s * 66, 0], [128 + s * 118, 72]], SHADE); eyes(g, b, 120, 42, 25, '#5a1a2a'); blush(g, 154); smile(g, 160, 22); poly(g, [[110, 166], [120, 166], [115, 182]], '#ffffff'); poly(g, [[136, 166], [146, 166], [141, 182]], '#ffffff'); },
  lizard: (g, b) => {
    for (const [x, y, r] of [[60, 60, 9], [196, 70, 7], [210, 188, 8], [44, 196, 6]] as const) circle(g, x, y, r, SHADE);
    for (const x of [88, 168]) { if (b) { stroke(g, 8, () => g.arc(x, 122, 16, Math.PI * 1.15, Math.PI * 1.85)); continue; } circle(g, x, 118, 25, '#ffd34d'); ellipse(g, x, 118, 6, 20, INK); circle(g, x - 8, 108, 6, '#ffffff'); }
    blush(g, 152); smile(g, 160, 30);
  },
  beast: (g, b) => { poly(g, [[116, 42], [128, 4], [140, 42]], '#f6ead2'); eyes(g, b, 118, 42, 26, '#3a1a50'); blush(g, 152); smile(g, 158, 28); poly(g, [[102, 164], [114, 164], [108, 180]], '#ffffff'); poly(g, [[142, 164], [154, 164], [148, 180]], '#ffffff'); },
  dragon: (g, b) => {
    for (const s of [-1, 1]) poly(g, [[128 + s * 60, 40], [128 + s * 92, 0], [128 + s * 88, 46]], '#f3e8ff');
    for (const x of [88, 168]) { if (b) { stroke(g, 8, () => g.arc(x, 122, 16, Math.PI * 1.15, Math.PI * 1.85)); continue; } circle(g, x, 118, 26, '#7a4ad0'); circle(g, x - 8, 108, 10, '#ffffff'); circle(g, x + 9, 127, 4, '#ffffff'); }
    blush(g, 154); circle(g, 116, 146, 4, INK); circle(g, 140, 146, 4, INK); smile(g, 162, 26); poly(g, [[138, 168], [150, 168], [144, 182]], '#ffffff');
  },
};

export function drawFace(g: G, face: PetFace, blink = false) { g.save(); FACES[face](g, blink); g.restore(); }

// ---- Body patterns: 32 x 32 multipliers around 0.82, darker details and lighter highlights. -----------

export const PATTERN_BASE = 210 / 255;
function hash(x: number, y: number, seed: number) { let n = Math.imul(x + seed * 71, 374761393) ^ Math.imul(y + seed * 19, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
const PATTERNS: Readonly<Record<PetPattern, (x: number, y: number) => number>> = {
  moss: (x, y) => hash(x >> 1, y >> 1, 3) > .82 ? 170 : hash(x, y, 4) > .93 ? 240 : 210,
  stone: (x, y) => { const v = hash(x >> 2, y >> 2, 5); return v > .7 ? 188 : v < .15 ? 228 : 210; },
  spots: (x, y) => [[8, 8, 5], [23, 12, 4], [14, 24, 4], [27, 27, 3]].some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r) ? 255 : 210,
  facets: (x, y) => ((x + y) % 16 < 1 || (x - y + 32) % 16 < 1) ? 252 : (x + y) % 32 < 16 ? 222 : 200,
  copper: (x, y) => Math.abs(((x + y * .6) % 12) - 6) < 1 ? 245 : hash(x, y, 9) > .9 ? 185 : 210,
  runes: (x, y) => (x % 16 === 4 && y % 16 > 3 && y % 16 < 12) || (y % 16 === 8 && x % 16 > 4 && x % 16 < 11) ? 175 : 210,
  waves: (x, y) => Math.abs(((y + Math.round(Math.sin(x / 32 * Math.PI * 4) * 2)) % 8) - 4) < 1 ? 246 : 210,
  frost: (x, y) => y < 5 ? 255 : hash(x, y, 13) > .94 ? 255 : 214,
  embers: (x, y) => hash(x, y, 17) > .93 ? 255 : hash(x >> 2, y >> 2, 18) > .75 ? 190 : 210,
  cracks: (x, y) => Math.abs(x - 16 - Math.round(Math.sin(y / 5) * 5)) < 1 || Math.abs(y - 20 - Math.round(Math.sin(x / 4) * 3)) < 1 ? 255 : 196,
  bones: (x, y) => (Math.abs(y - 16) < 2 && x > 8 && x < 24) || [[8, 13], [8, 19], [24, 13], [24, 19]].some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 < 6) ? 245 : 210,
  honey: (x, y) => { const row = Math.floor(y / 7), cx = (x + (row % 2) * 4) % 8; return cx === 0 || y % 7 === 0 ? 236 : 208; },
  rivets: (x, y) => [[4, 4], [27, 4], [4, 27], [27, 27]].some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 < 5) ? 250 : x % 16 === 0 || y % 16 === 0 ? 190 : 212,
  sheen: (x, y) => Math.abs(((x - y + 64) % 24) - 6) < 3 ? 250 : 208,
  stars: (x, y) => [[6, 7], [22, 5], [14, 18], [26, 24], [7, 26]].some(([cx, cy]) => Math.abs(x - cx) + Math.abs(y - cy) < 2) ? 255 : 206,
  core: (x, y) => Math.abs(Math.hypot(x - 15.5, y - 15.5) % 8 - 4) < 1 ? 248 : 206,
};
export function drawPattern(g: G, pattern: PetPattern, size = 32) {
  const image = g.createImageData(size, size), sample = PATTERNS[pattern];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = sample(Math.floor(x * 32 / size), Math.floor(y * 32 / size)), i = (y * size + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
}

// ---- Sparkles and glow: white shapes on transparency, tinted by the material. ------------------------

const SPARKLES: Readonly<Record<PetSparkle, (g: G, s: number) => void>> = {
  sparkle: (g, s) => { const c = s / 2; poly(g, [[c, 2], [c + s * .1, c - s * .1], [s - 2, c], [c + s * .1, c + s * .1], [c, s - 2], [c - s * .1, c + s * .1], [2, c], [c - s * .1, c - s * .1]], '#ffffff'); },
  star: (g, s) => { const c = s / 2, pts: [number, number][] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .2 : s * .46, a = -Math.PI / 2 + i * Math.PI / 5; pts.push([c + Math.cos(a) * r, c + Math.sin(a) * r]); } poly(g, pts, '#ffffff'); },
  leaf: (g, s) => { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(s / 2, s / 2, s * .42, s * .2, -.6, 0, Math.PI * 2); g.fill(); stroke(g, s * .05, () => { g.moveTo(s * .2, s * .78); g.lineTo(s * .78, s * .22); }, 'rgba(0,0,0,.25)'); },
  ember: (g, s) => { const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); grad.addColorStop(0, '#ffffff'); grad.addColorStop(.35, 'rgba(255,255,255,.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, s, s); },
  bubble: (g, s) => { stroke(g, s * .08, () => g.arc(s / 2, s / 2, s * .38, 0, Math.PI * 2), '#ffffff'); circle(g, s * .38, s * .36, s * .08, '#ffffff'); },
  snow: (g, s) => stroke(g, s * .07, () => { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.moveTo(s / 2 - Math.cos(a) * s * .42, s / 2 - Math.sin(a) * s * .42); g.lineTo(s / 2 + Math.cos(a) * s * .42, s / 2 + Math.sin(a) * s * .42); } }, '#ffffff'),
};
export function drawSparkle(g: G, kind: PetSparkle, size = 64) { g.save(); SPARKLES[kind](g, size); g.restore(); }
export function drawGlow(g: G, size = 128) {
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(.45, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
}
/** Sparkles that cannot be lit additively (leaves, bubbles) use normal blending. */
export const sparkleIsLight = (kind: PetSparkle) => kind !== 'leaf' && kind !== 'bubble';

// ---- Portrait: a 3/4 view of the same rounded cube for the UI. ---------------------------------------

function canvas(size: number) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }
const patternCache = new Map<PetPattern, HTMLCanvasElement>(), sparkleCache = new Map<PetSparkle, HTMLCanvasElement>();
const cached = <K>(map: Map<K, HTMLCanvasElement>, key: K, size: number, draw: (g: G) => void) => {
  let c = map.get(key);
  if (!c) { c = canvas(size); draw(c.getContext('2d')!); map.set(key, c); }
  return c;
};
function shade(hex: string, factor: number) {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Draws the pet into a square canvas of `size` pixels. */
export function drawPortrait(g: G, look: PetLook, size: number) {
  g.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size * .55, edge = size * .58 * (look.size / .95) ** .5;
  // Orthographic 3/4 view: turned 32 degrees, looking down 20 degrees.
  const yaw = .56, pitch = .35, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const project = (x: number, y: number, z: number): [number, number] => {
    // Turn so the right side faces the viewer, then tip toward the camera to show the top.
    const rx = x * cyw - z * syw, rz = x * syw + z * cyw, ry = y * cp - rz * sp;
    return [cx + rx * edge, cy - ry * edge];
  };
  if (look.glow) {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, size * .5);
    grad.addColorStop(0, shade(look.color, 1.3) + ''); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = .55; g.fillStyle = grad; g.fillRect(0, 0, size, size); g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(cx, cy + edge * .62, edge * .72, edge * .2, 0, 0, Math.PI * 2); g.fill();
  // Each visible side is the affine image of a unit square: draw it in its own (u, v) space.
  const side = (origin: [number, number, number], du: [number, number, number], dv: [number, number, number], fill: string, after?: () => void) => {
    const o = project(...origin), u = project(origin[0] + du[0], origin[1] + du[1], origin[2] + du[2]), v = project(origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2]);
    g.save();
    g.setTransform(u[0] - o[0], u[1] - o[1], v[0] - o[0], v[1] - o[1], o[0], o[1]);
    g.beginPath(); g.roundRect(0, 0, 1, 1, .2); g.fillStyle = fill; g.fill();
    g.save(); g.clip();
    g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = false;
    g.drawImage(cached(patternCache, look.pattern, 32, c => drawPattern(c, look.pattern)), 0, 0, 1, 1);
    g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = true;
    after?.();
    g.restore();
    // Soft ink outline, about two pixels whatever the side's skew.
    g.lineWidth = Math.max(1.5, size * .011) / Math.max(1, Math.hypot(u[0] - o[0], u[1] - o[1])); g.strokeStyle = 'rgba(28,18,12,.55)';
    g.beginPath(); g.roundRect(0, 0, 1, 1, .2); g.stroke();
    g.restore();
  };
  const bright = (f: number) => shade(look.color, f / PATTERN_BASE);
  // The three rounded sides leave a notch where they meet; fill it with the body underneath.
  const corner = project(.5, .5, .5);
  g.fillStyle = shade(look.color, .95); g.beginPath(); g.arc(corner[0], corner[1], edge * .1, 0, Math.PI * 2); g.fill();
  side([-.5, .5, -.5], [1, 0, 0], [0, 0, 1], bright(1.14));                       // top
  side([.5, .5, .5], [0, 0, -1], [0, -1, 0], bright(.8));                          // right
  side([-.5, .5, .5], [1, 0, 0], [0, -1, 0], bright(1), () => {                     // front, with the face
    g.save(); g.translate(.08, .08); g.scale(.84 / 256, .84 / 256); drawFace(g, look.face); g.restore();
  });
  if (look.particles) {
    const sprite = cached(sparkleCache, look.sparkle, 64, c => drawSparkle(c, look.sparkle));
    const tinted = canvas(64), t = tinted.getContext('2d')!;
    t.drawImage(sprite, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = look.sparkleColor; t.fillRect(0, 0, 64, 64);
    for (const [x, y, s] of [[.16, .26, .13], [.84, .2, .1], [.88, .62, .12], [.12, .7, .09], [.7, .1, .07]] as const) g.drawImage(tinted, size * x - size * s / 2, size * y - size * s / 2, size * s, size * s);
  }
}

const portraits = new Map<string, HTMLCanvasElement>();
/** A portrait drawn once per species and size; UI canvases copy it (no PNG encoding on the main thread). */
export function portraitCanvas(look: PetLook, size = 256) {
  const key = `${look.speciesId}@${size}`;
  let drawn = portraits.get(key);
  if (!drawn) { drawn = canvas(size); drawPortrait(drawn.getContext('2d')!, look, size); portraits.set(key, drawn); }
  return drawn;
}
