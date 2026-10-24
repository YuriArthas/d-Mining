// Offline: build, bake and pack an authored scene: an underground rest hall or a later world's surface base.
// Run: node tools/build-underground.mjs <id>   (fungal, old-mine, ..., automine, tech-base; after
// `blender -b --python tools/blender/build_<id>.py` in surface-game-art, which writes <id>-props.glb)
// The scene comes from surface-game-art/tools/underground/<camelId>Hall.ts (`buildHall`); a module may export
// `ASSET` (default <id>-hall) and `SUN = true` (bake the daytime sun's shadows too, for the surface). Nodes
// named Spin_* / Slide_* stay out of the static batches and move in the game (SceneMotion.ts). Output:
// surface-game-art/public/assets/underground/<asset>.glb, the packed runtime asset in src/game/assets/scene
// (<asset>.*), and its colliders in src/game/content/underground/<asset>.json.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { bakeOcclusion, OCCLUDER } from '../surface-game-art/tools/terrain/bakeLight.mjs';
import { batchStatic } from '../surface-game-art/tools/terrain/kit.ts';
const require = createRequire(new URL('../surface-game-art/package.json', import.meta.url));
const { createCanvas, loadImage, ImageData, Image } = require('@napi-rs/canvas');
globalThis.self = globalThis; globalThis.ImageData = ImageData; globalThis.HTMLImageElement = Image;
globalThis.createImageBitmap = async blob => loadImage(Buffer.from(await blob.arrayBuffer()));
globalThis.document = { createElement(name) { if (name !== 'canvas') throw Error(name); const c = createCanvas(1, 1); c.toBlob = async (callback, type) => callback(new Blob([await c.encode(type === 'image/jpeg' ? 'jpeg' : 'png')], { type })); return c; } };
globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); } readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); } };
const hash = b => createHash('sha256').update(b).digest('hex');

const id = process.argv[2];
if (!/^[a-z]+(-[a-z]+)*$/.test(id ?? '')) throw Error('usage: node tools/build-underground.mjs <hall id>');
const camel = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const { buildHall, ASSET, SUN = false } = await import(`../surface-game-art/tools/underground/${camel}Hall.ts`);
const name = ASSET ?? `${id}-hall`;
const art = 'surface-game-art/public/assets/underground', shipped = 'src/game/assets/scene';
const buffer = readFileSync(`${art}/${id}-props.glb`);
const props = (await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length), '')).scene;
const built = buildHall(prop => { const node = props.getObjectByName(prop); if (!node) throw Error(`Missing prop ${prop}`); const copy = node.clone(true); copy.position.set(0, 0, 0); copy.rotation.set(0, 0, 0); copy.scale.set(1, 1, 1); return copy; });

// Moving parts keep their own nodes (and their own geometry, since each carries its own bake).
const dynamic = built.group.children.filter(o => /^(Spin|Slide)_/.test(o.name));
for (const part of dynamic) part.traverse(o => { if (o.isMesh) { o.userData.keepDynamic = true; o.geometry = o.geometry.clone(); } });
// Occlusion (and the sun, on the surface): every static mesh casts; every batched or moving mesh receives one
// value per vertex.
const casters = [];
built.group.updateMatrixWorld(true);
built.group.traverse(o => { if (o.isMesh && !o.userData.keepDynamic && !/glow/i.test(o.material.name)) casters.push({ mesh: o, kind: OCCLUDER.solid }); });
const batched = batchStatic(built.group);
batched.group.add(...dynamic);
batched.group.updateMatrixWorld(true);
const receivers = [];
batched.group.traverse(o => { if (o.isMesh) receivers.push(o); });
const baked = await bakeOcclusion({ casters, vertex: receivers, aoRadius: SUN ? 6 : 4.5, aoSamples: 32, sun: SUN });
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
writeFileSync(`${art}/${name}.glb`, glb);
mkdirSync('src/game/content/underground', { recursive: true });
writeFileSync(`src/game/content/underground/${name}.json`, JSON.stringify({ version: 1, solids: built.solids }) + '\n');

// Pack: KTX2 textures, meshopt, gzip into one part beside the surface assets.
const cli = fileURLToPath(new URL('../surface-game-art/node_modules/@gltf-transform/cli/bin/cli.js', import.meta.url));
const env = { ...process.env, PATH: process.env.KTX_BIN ? process.env.KTX_BIN + ':' + process.env.PATH : process.env.PATH };
execFileSync(process.execPath, [cli, 'uastc', `${art}/${name}.glb`, `${art}/${name}.ktx.glb`, '--level', '2', '--zstd', '18', '--jobs', '1'], { env, stdio: 'inherit' });
execFileSync(process.execPath, [cli, 'meshopt', `${art}/${name}.ktx.glb`, `${art}/${name}.runtime.glb`, '--quantize-position', '16'], { env, stdio: 'inherit' });
rmSync(`${art}/${name}.ktx.glb`);
const runtime = readFileSync(`${art}/${name}.runtime.glb`), compressed = gzipSync(runtime, { level: 9 });
writeFileSync(`${shipped}/${name}.000.part`, compressed);
const manifest = { parts: [`${name}.000.part`], bytes: compressed.length, decodedBytes: runtime.length, sha256: hash(compressed), sourceSha256: hash(glb), triangles: batched.stats.triangles,
  source: `${built.group.name}: Blender props (surface-game-art/tools/blender/build_${id.replace(/-/g, '_')}.py) and an offline procedural cave shell (surface-game-art/tools/underground/${camel}Hall.ts on caveKit.ts); baked occlusion per vertex`,
  materialProfile: 'authored-color', coordinateSpace: 'authored', geometryEdits: false, textureEncoding: 'KTX2 UASTC', reference: 'tools/build-underground.mjs' };
writeFileSync(`${shipped}/${name}.manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
const propsReport = JSON.parse(readFileSync(`surface-game-art/artifacts/${id}-props.json`));
writeFileSync(`surface-game-art/artifacts/${name}.json`, JSON.stringify({ hall: { triangles: batched.stats.triangles, batches: batched.stats.batches, colliders: built.solids.length, glbSha256: hash(glb), runtimeSha256: hash(runtime) }, props: propsReport, occlusion: baked.stats }, null, 2) + '\n');
console.log(`${name}:`, batched.stats.triangles, 'triangles,', batched.stats.batches, 'batches,', built.solids.length, 'colliders,', compressed.length, 'bytes packed');
