// Authoring aid only (see render-sheets.cjs): renders the real MinerAvatar frame by frame into a contact sheet.
import { BoxGeometry, Color, DirectionalLight, GridHelper, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { MinerAvatar } from '../../src/game/presentation/MinerAvatar.ts';

const W = 210, H = 250;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.outputColorSpace = SRGBColorSpace;
const scene = new Scene(); scene.background = new Color('#9fb9cc');
scene.add(new HemisphereLight('#ffffff', '#4a5260', 1.7));
const sun = new DirectionalLight('#ffffff', 2.4); sun.position.set(3, 6, 4); scene.add(sun);
const ground = new Mesh(new PlaneGeometry(60, 60), new MeshStandardMaterial({ color: '#6f8f5a' })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const grid = new GridHelper(60, 60, '#3d4a35', '#4f6045'); grid.position.y = .002; scene.add(grid);
const block = new Mesh(new BoxGeometry(2, 2, 2), new MeshStandardMaterial({ color: '#8a6a4a', transparent: true, opacity: .45 }));
const holder = new Group(); scene.add(holder);
const avatar = await (MinerAvatar as any).load(new AbortController().signal);
holder.add(avatar.group);
const cam = new PerspectiveCamera(40, W / H, .05, 200);
const gameDir = (yaw: number, pitch: number) => new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
const VIEWS: Record<string, { eye: Vector3; at: Vector3; fov: number }> = {
  side: { eye: new Vector3(3.6, 1.25, -.5), at: new Vector3(0, 1.05, -.5), fov: 44 },
  front: { eye: new Vector3(-2.4, 1.8, -3.0), at: new Vector3(0, 1.0, -.3), fov: 42 },
  game: { eye: new Vector3(0, 2.05, 0).addScaledVector(gameDir(.32, .34), 8.5), at: new Vector3(0, 1.2, -.4), fov: 17 },
  back: { eye: new Vector3(1.2, 1.9, 3.4), at: new Vector3(0, 1.05, -.3), fov: 40 },
};
type Frame = { label: string };
const frames: Frame[] = [];
let views: string[] = [];
let cols = 1;
function capture(label: string) {
  const tip = avatar.diagnostics().pickaxe.tip as number[] | undefined;
  if (tip) label += ` tip y${tip[1].toFixed(2)} z${(tip[2] - holder.position.z).toFixed(2)}`;
  const index = frames.length; frames.push({ label });
  const col = index % cols, row = Math.floor(index / cols);
  views.forEach((name, v) => {
    const view = VIEWS[name];
    cam.fov = view.fov; cam.aspect = W / H; cam.updateProjectionMatrix();
    cam.position.copy(view.eye).add(holder.position); cam.lookAt(view.at.clone().add(holder.position));
    const x = col * W, y = (row * views.length + v) * H;
    renderer.setViewport(x, canvas.height - y - H, W, H); renderer.setScissor(x, canvas.height - y - H, W, H);
    renderer.render(scene, cam);
    const lab = document.createElement('div'); lab.className = 'lab'; lab.textContent = `${label} ${name}`;
    lab.style.left = `${x + 3}px`; lab.style.top = `${y + 3}px`; document.getElementById('wrap')!.appendChild(lab);
  });
}
function setup(count: number, columns: number, viewNames: string[]) {
  frames.length = 0; views = viewNames; cols = columns;
  document.querySelectorAll('.lab').forEach(e => e.remove());
  const rows = Math.ceil(count / cols);
  renderer.setSize(cols * W, rows * views.length * H, true); renderer.setScissorTest(true);
}
const step = (feet: number[], grounded = true, dt = 1 / 60) => { holder.position.set(feet[0], feet[1], feet[2]); avatar.update(feet, dt, grounded, false); };

(window as any).swing = async ({ speed = 2, every = 2, count = 18, columns = 9, viewNames = ['side', 'game'], target = [0, 1, -2], hold = 0 } = {}) => {
  setup(count, columns, viewNames);
  scene.add(block); block.position.set(target[0], target[1], target[2]);
  avatar.cancelMining(); holder.position.set(0, 0, 0);
  avatar.update([0, 0, 0], 0, true, true);
  for (let i = 0; i < 40; i++) step([0, 0, 0]);
  let frame = 0, strikes = 0;
  const period = 60 / speed;
  for (let n = 0; frames.length < count; n++) {
    if ((n === 0 || (hold && n % Math.round(period) === 0 && n < hold))) { avatar.strike(target, speed); strikes++; }
    if (n % every === 0) capture(`${(n / 60).toFixed(3)}s`);
    step([0, 0, 0]); frame++;
  }
  return avatar.diagnostics();
};

(window as any).jump = async ({ every = 3, count = 24, columns = 8, viewNames = ['side', 'front'], run = 0 } = {}) => {
  setup(count, columns, viewNames);
  block.removeFromParent(); avatar.cancelMining();
  avatar.update([0, 0, 0], 0, true, true);
  let z = 0;
  for (let i = 0; i < 40; i++) { z -= run / 60; step([0, 0, z]); }
  let t = -6 / 60, n = 0, air = false, y = 0, vy = 0, jumped = false;
  while (frames.length < count) {
    if (t >= 0 && !jumped) { air = true; jumped = true; vy = 9; }
    if (air) { vy -= 24 / 60; y += vy / 60; if (y <= 0) { y = 0; air = false; vy = 0; } }
    z -= run / 60;
    step([0, y, z], !air);
    if (n % every === 0) capture(`${t.toFixed(2)}s y${y.toFixed(2)}`);
    t += 1 / 60; n++;
  }
  return avatar.diagnostics();
};
(window as any).ready = true;
