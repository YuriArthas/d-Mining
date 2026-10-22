// Authoring aid (see render.cjs): renders every pet with the real body mesh and the shared art,
// plus the UI portraits, into contact sheets. Acceptance still happens on the public build.
import { Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, NeutralToneMapping, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PET_CONTENT } from '../../src/game/content/pets.ts';
import { EGG_STAGES } from '../../src/game/content/progression.ts';
import { petLook } from '../../src/game/content/petLooks.ts';
import { PetModel, PetTextures } from '../../src/game/presentation/pets/PetModel.ts';
import { drawPortrait } from '../../src/game/presentation/pets/petArt.ts';

const eggs = [...PET_CONTENT.eggs].sort((a, b) => (EGG_STAGES[a.id][0] * 2 + +EGG_STAGES[a.id][1]) - (EGG_STAGES[b.id][0] * 2 + +EGG_STAGES[b.id][1]));
const rows = eggs.map(egg => egg.outcomes.map(o => o.speciesId));
const gltf = await new GLTFLoader().loadAsync(new URL('../../src/game/assets/pets/pet-cube.glb', import.meta.url).href);
let body: any = null; gltf.scene.traverse((o: any) => { if (!body && o.isMesh) body = o.geometry; });
const textures = new PetTextures();
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = NeutralToneMapping;
document.body.appendChild(renderer.domElement);

(window as any).modelSheet = (cell = 170, time = 0.9) => {
  // Each cell renders at its own canvas size: point sprites scale with the drawing buffer height.
  const cols = 5, sheet = document.createElement('canvas'); sheet.width = cols * cell; sheet.height = rows.length * cell;
  const out = sheet.getContext('2d')!;
  renderer.setSize(cell, cell);
  const camera = new PerspectiveCamera(30, 1, .1, 50);
  rows.forEach((row, r) => row.forEach((speciesId, c) => {
    const scene = new Scene(); scene.background = new Color(r % 2 ? '#a4cde8' : '#b2d6ee');
    scene.add(new HemisphereLight('#ffffff', '#6b8f56', 1.5));
    const sun = new DirectionalLight('#fff6e0', 2.1); sun.position.set(2, 4, 5); scene.add(sun);
    const ground = new Mesh(new PlaneGeometry(10, 10), new MeshStandardMaterial({ color: '#86c46a', roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    let seed = (r * 5 + c + 1) * 9301; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pet = new PetModel(petLook(speciesId), body, textures, random);
    pet.update(time); pet.group.rotation.y = -.42; scene.add(pet.group);
    camera.position.set(0, 1.25, 3.1); camera.lookAt(0, .52, 0);
    // The game sees pets from about 8.5 m at a 55 degree view; a 30 degree view from 3.3 m frames one pet similarly.
    renderer.render(scene, camera); out.drawImage(renderer.domElement, c * cell, r * cell);
    pet.dispose();
  }));
  return { url: sheet.toDataURL('image/png'), eggs: eggs.map(e => e.id) };
};

(window as any).portraitSheet = (cell = 150) => {
  const cols = 5, canvas = document.createElement('canvas'); canvas.width = cols * cell; canvas.height = rows.length * cell;
  const g = canvas.getContext('2d')!;
  rows.forEach((row, r) => row.forEach((speciesId, c) => {
    g.fillStyle = r % 2 ? '#2f7fd0' : '#3a8ee0'; g.fillRect(c * cell, r * cell, cell, cell);
    const tile = document.createElement('canvas'); tile.width = tile.height = cell; drawPortrait(tile.getContext('2d')!, petLook(speciesId), cell);
    g.drawImage(tile, c * cell, r * cell);
  }));
  return canvas.toDataURL('image/png');
};
(window as any).ready = true;
