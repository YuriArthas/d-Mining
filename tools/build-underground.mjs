// Offline: build, bake and pack an underground rest hall (today: 蘑菇洞穴, world 1 layer 2).
// Run: node tools/build-underground.mjs   (after `blender -b --python tools/blender/build_fungal.py` in surface-game-art)
// Output: surface-game-art/public/assets/underground/fungal-hall.glb, the packed runtime asset in
// src/game/assets/scene (fungal-hall.*), and its colliders in src/game/content/underground/fungal-hall.json.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildFungalHall } from '../surface-game-art/tools/underground/fungalHall.ts';
import { bakeOcclusion, OCCLUDER } from '../surface-game-art/tools/terrain/bakeLight.mjs';
import { batchStatic } from '../surface-game-art/tools/terrain/kit.ts';
const require = createRequire(new URL('../surface-game-art/package.json', import.meta.url));
const { createCanvas, loadImage, ImageData, Image } = require('@napi-rs/canvas');
globalThis.self = globalThis; globalThis.ImageData = ImageData; globalThis.HTMLImageElement = Image;
globalThis.createImageBitmap = async blob => loadImage(Buffer.from(await blob.arrayBuffer()));
globalThis.document = { createElement(name) { if (name !== 'canvas') throw Error(name); const c = createCanvas(1, 1); c.toBlob = async (callback, type) => callback(new Blob([await c.encode(type === 'image/jpeg' ? 'jpeg' : 'png')], { type })); return c; } };
globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); } readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); } };
const hash = b => createHash('sha256').update(b).digest('hex');

const art = 'surface-game-art/public/assets/underground', shipped = 'src/game/assets/scene';
const buffer = readFileSync(`${art}/fungal-props.glb`);
const props = (await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length), '')).scene;
const built = buildFungalHall(name => { const node = props.getObjectByName(name); if (!node) throw Error(`Missing prop ${name}`); const copy = node.clone(true); copy.position.set(0, 0, 0); copy.rotation.set(0, 0, 0); copy.scale.set(1, 1, 1); return copy; });

// Occlusion: every hall mesh casts; every batched mesh receives one value per vertex.
const casters = [];
built.group.updateMatrixWorld(true);
built.group.traverse(o => { if (o.isMesh && !/glow/i.test(o.material.name)) casters.push({ mesh: o, kind: OCCLUDER.solid }); });
const batched = batchStatic(built.group);
const baked = await bakeOcclusion({ casters, vertex: batched.group.children.filter(o => o.isMesh), aoRadius: 4.5, aoSamples: 32 });
// The game's material contract: standard materials, matte, baked occlusion per vertex.
const converted = new Map();
batched.group.traverse(o => {
  if (!o.isMesh) return;
  o.geometry.setAttribute('bake', new THREE.BufferAttribute(baked.vertexBakes.get(o), 4, true));
  let out = converted.get(o.material);
  if (!out) {
    const m = o.material;
    out = m.isMeshLambertMaterial ? new THREE.MeshStandardMaterial({ color: m.color, map: m.map, vertexColors: m.vertexColors, roughness: 1, metalness: 0 }) : m.clone();
    out.name = m.name; out.userData.bakedLight = 'vertex'; converted.set(o.material, out);
  }
  o.material = out;
});
mkdirSync(art, { recursive: true });
const glb = Buffer.from(await new GLTFExporter().parseAsync(batched.group, { binary: true, onlyVisible: true }));
writeFileSync(`${art}/fungal-hall.glb`, glb);
mkdirSync('src/game/content/underground', { recursive: true });
writeFileSync('src/game/content/underground/fungal-hall.json', JSON.stringify({ version: 1, solids: built.solids }) + '\n');

// Pack: KTX2 textures, meshopt, gzip into one part beside the surface assets.
const cli = fileURLToPath(new URL('../surface-game-art/node_modules/@gltf-transform/cli/bin/cli.js', import.meta.url));
const env = { ...process.env, PATH: process.env.KTX_BIN ? process.env.KTX_BIN + ':' + process.env.PATH : process.env.PATH };
execFileSync(process.execPath, [cli, 'uastc', `${art}/fungal-hall.glb`, `${art}/fungal-hall.ktx.glb`, '--level', '2', '--zstd', '18', '--jobs', '1'], { env, stdio: 'inherit' });
execFileSync(process.execPath, [cli, 'meshopt', `${art}/fungal-hall.ktx.glb`, `${art}/fungal-hall.runtime.glb`, '--quantize-position', '16'], { env, stdio: 'inherit' });
rmSync(`${art}/fungal-hall.ktx.glb`);
const runtime = readFileSync(`${art}/fungal-hall.runtime.glb`), compressed = gzipSync(runtime, { level: 9 });
writeFileSync(`${shipped}/fungal-hall.000.part`, compressed);
const manifest = { parts: ['fungal-hall.000.part'], bytes: compressed.length, decodedBytes: runtime.length, sha256: hash(compressed), sourceSha256: hash(glb), triangles: batched.stats.triangles,
  source: '蘑菇洞穴 rest hall: Blender props (surface-game-art/tools/blender/build_fungal.py) and an offline procedural cave shell (surface-game-art/tools/underground/fungalHall.ts); baked occlusion per vertex',
  materialProfile: 'authored-color', coordinateSpace: 'authored', geometryEdits: false, textureEncoding: 'KTX2 UASTC', reference: 'tools/build-underground.mjs' };
writeFileSync(`${shipped}/fungal-hall.manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
const propsReport = JSON.parse(readFileSync('surface-game-art/artifacts/fungal-props.json'));
writeFileSync('surface-game-art/artifacts/fungal-hall.json', JSON.stringify({ hall: { triangles: batched.stats.triangles, batches: batched.stats.batches, colliders: built.solids.length, glbSha256: hash(glb), runtimeSha256: hash(runtime) }, props: propsReport, occlusion: baked.stats }, null, 2) + '\n');
console.log('fungal hall:', batched.stats.triangles, 'triangles,', batched.stats.batches, 'batches,', built.solids.length, 'colliders,', compressed.length, 'bytes packed');
