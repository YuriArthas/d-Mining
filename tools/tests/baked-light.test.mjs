import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { MeshStandardMaterial, Texture, ShaderChunk } from 'three';
import authored from '../../src/game/content/pinewind/authored.json' with { type: 'json' };
import { GAME_CONTENT, GAME_GENERATION } from '../../src/game/content/gameContent.ts';
import { SURFACE_DAYLIGHT } from '../../src/game/world/SceneLighting.ts';
import { applyBakedLight, setBakedLightEnabled, setBakedLightTuning, bakedLightState, BAKED_LIGHT } from '../../src/game/presentation/bakedLight.ts';
import { TEXTURE_UPLOAD_LIMITS } from '../../src/game/presentation/uploadSurfaceTexture.ts';

const read = path => readFileSync(new URL('../../' + path, import.meta.url));
/** The packed runtime GLB of a Pinewind asset (gzipped single part). */
function runtimeGlb(name) {
  const manifest = JSON.parse(read(`src/game/assets/scene/${name}.manifest.json`));
  const glb = gunzipSync(Buffer.concat(manifest.parts.map(part => read(`src/game/assets/scene/${part}`))));
  const jsonLength = glb.readUInt32LE(12), json = JSON.parse(glb.subarray(20, 20 + jsonLength));
  const bin = glb.subarray(20 + jsonLength + 8);
  const image = index => { const view = json.bufferViews[json.images[index].bufferView]; return bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength); };
  return { json, image };
}
/** Colour model, transfer function and first sample channel of a KTX2 file's data format descriptor. */
function ktxFormat(ktx) {
  assert.equal(ktx.subarray(1, 7).toString(), 'KTX 20');
  const dfd = ktx.readUInt32LE(48), block = dfd + 4;
  return { width: ktx.readUInt32LE(20), model: ktx[block + 8], transfer: ktx[block + 10], channel: ktx[block + 24 + 3] & 15 };
}
const occlusionTextures = ({ json }) => [...new Set(json.materials.filter(m => m.occlusionTexture).map(m => m.occlusionTexture.index))];

test('the bake was traced toward the daytime sun the game uses, and the game reads that direction', () => {
  assert.deepEqual(authored.light.sun, [...SURFACE_DAYLIGHT.sunPosition]);
  assert.deepEqual(GAME_CONTENT.surface.authored.light.sun, authored.light.sun);
  assert.equal(authored.light.version, 'pinewind-baked-light-v1');
  assert.equal(authored.light.ground.resolution, 1536);
  // The old projected overlay (a second copy of the ground) is gone.
  const { json } = runtimeGlb('pinewind-landscape');
  assert.ok(!JSON.stringify(json.extensionsUsed ?? []).includes('KHR_materials_unlit'), 'no unlit shadow overlay');
});

test('packed bake textures keep both values (sky occlusion and sun visibility) as linear colour UASTC at 1536', () => {
  for (const name of ['pinewind-landscape', 'pinewind-architecture']) {
    const glb = runtimeGlb(name), textures = occlusionTextures(glb);
    assert.equal(textures.length, 1, `${name}: one baked texture`);
    const texture = glb.json.textures[textures[0]], source = texture.extensions?.KHR_texture_basisu?.source;
    assert.ok(source !== undefined, `${name}: KTX2`);
    const format = ktxFormat(glb.image(source));
    assert.equal(format.model, 166, `${name}: UASTC`);
    // UASTC RGB (0) or RGBA (3) keep red and green; RRR (4), as the occlusion slot alone would get, does not.
    assert.ok(format.channel === 0 || format.channel === 3, `${name}: colour channels kept (${format.channel})`);
    assert.equal(format.transfer, 1, `${name}: linear data`);
    assert.equal(format.width, 1536);
    // Compressed at 1 byte per texel with mipmaps, each fits the 4 MiB per-texture upload budget.
    assert.ok(format.width ** 2 * 4 / 3 <= TEXTURE_UPLOAD_LIMITS.maxBytes, `${name}: within the upload budget`);
    for (const m of glb.json.materials.filter(m => m.occlusionTexture)) assert.equal(m.occlusionTexture.texCoord, 1, `${name}: second UV set`);
  }
});

test('every baked surface carries its bake: ground and buildings a second UV set, props a per-vertex value', () => {
  const land = runtimeGlb('pinewind-landscape').json, arch = runtimeGlb('pinewind-architecture').json;
  let ground = 0, props = 0;
  for (const mesh of land.meshes) for (const p of mesh.primitives) {
    const material = land.materials[p.material];
    if (material.occlusionTexture) { assert.ok('TEXCOORD_1' in p.attributes); ground++; }
    else { assert.ok('_BAKE' in p.attributes, `prop primitive without bake (${material.name})`); assert.equal(material.extras?.bakedLight, 'vertex'); props++; }
  }
  assert.ok(ground > 10 && props > 10, `${ground} ground and ${props} prop primitives`);
  for (const mesh of arch.meshes) for (const p of mesh.primitives) assert.ok('TEXCOORD_1' in p.attributes, mesh.name);
});

test('buildings stand exactly where they were baked', () => {
  const roots = new Map(authored.roots.map(r => [r.node, r]));
  for (const p of GAME_CONTENT.surface.authored.instances.filter(p => p.asset === 'pinewind-architecture')) {
    const root = roots.get(p.node);
    assert.ok(root, p.node);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(root.at[i] - p.at[i]) < 1e-3, `${p.node} position`);
    const dot = root.rotation.reduce((sum, v, i) => sum + v * p.rotation[i], 0);
    assert.ok(Math.abs(Math.abs(dot) - 1) < 1e-5, `${p.node} rotation`);
  }
});

test('material patch: baked sun only on the directional light from the baked direction; occlusion on the fill', () => {
  const compile = material => {
    const shader = { uniforms: {}, vertexShader: 'void main(){\n#include <begin_vertex>\n}', fragmentShader: '#include <lights_pars_begin>\nvoid main(){\n#include <lights_physical_fragment>\n#include <lights_fragment_begin>\n#include <aomap_fragment>\n}' };
    material.onBeforeCompile(shader, null); return shader;
  };
  const map = new MeshStandardMaterial({ aoMap: new Texture() });
  assert.equal(applyBakedLight(map), 'map'); applyBakedLight(map);
  const shader = compile(map);
  assert.equal(shader.fragmentShader.match(/bakedSunFactor\( directionalLight\.direction \)/g)?.length, 1, 'directional lights only, patched once');
  assert.match(shader.fragmentShader, /texture2D\( aoMap, vAoMapUv \)\.rg/);
  assert.match(shader.fragmentShader, /reflectedLight\.indirectDiffuse \*= bakedOcclusion/);
  assert.ok(!shader.fragmentShader.includes('#include <aomap_fragment>'), 'replaces the standard occlusion (no double darkening)');
  assert.ok(shader.fragmentShader.includes('#include <lights_fragment_begin>'), 'leaves the light loop include for the other patches');
  assert.ok(ShaderChunk.lights_pars_begin.includes('light.color = directionalLight.color;'));
  assert.match(map.customProgramCacheKey(), /baked-light-map-v1$/);
  const vertex = new MeshStandardMaterial(); vertex.userData.bakedLight = 'vertex';
  assert.equal(applyBakedLight(vertex), 'vertex');
  const v = compile(vertex);
  assert.match(v.vertexShader, /attribute vec4 _bake;/); assert.match(v.fragmentShader, /vec2 baked = vBake;/);
  assert.equal(applyBakedLight(new MeshStandardMaterial()), null, 'unbaked materials stay untouched');
  // The settings switch turns shadows and darkening off together; tuning restores the defaults.
  setBakedLightEnabled(false);
  assert.equal(shader.uniforms.bakedShadow.value, 0); assert.equal(shader.uniforms.bakedAo.value, 0);
  setBakedLightEnabled(true); setBakedLightTuning(null);
  assert.equal(shader.uniforms.bakedShadow.value, BAKED_LIGHT.shadow);
  assert.equal(bakedLightState().enabled, true);
});

test('the top of the mine reads the ground bake on upward surface faces only; deeper blocks are untouched', async () => {
  const { ShaderLib, Texture: T } = await import('three');
  const { createMineralMaterial } = await import('../../src/game/terrain/mineralMaterial.ts');
  const { setBakedGround } = await import('../../src/game/presentation/bakedLight.ts');
  const { material, dispose } = createMineralMaterial(GAME_GENERATION.layers, GAME_GENERATION.worlds);
  const shader = { uniforms: {}, vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader, null);
  assert.match(shader.fragmentShader, /vTerrainNormalY > 0\.5 && vTerrainWorld\.y > -0\.6/);
  assert.match(shader.fragmentShader, /texture2D\( bakedGroundMap, groundUv \)\.rg/);
  assert.equal(shader.fragmentShader.match(/bakedSunFactor\( directionalLight\.direction \)/g)?.length, 1);
  assert.match(material.customProgramCacheKey(), /baked-ground-top-v1/);
  // Until the authored surface provides its bake, the blocks read a fully lit texel.
  assert.equal(shader.uniforms.bakedGroundMap.value.image.data[1], 255);
  const map = new T(); setBakedGround(map, authored.light.ground);
  assert.equal(shader.uniforms.bakedGroundMap.value, map);
  assert.deepEqual(shader.uniforms.bakedGroundRect.value.toArray(), [authored.light.ground.x0, authored.light.ground.z0, authored.light.ground.size, authored.light.ground.size]);
  setBakedGround(null, authored.light.ground); dispose();
});
