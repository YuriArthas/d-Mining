import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Color, CustomToneMapping, NeutralToneMapping, ShaderChunk } from 'three';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { TONE_GRADE, applyToneGrade } from '../../src/game/presentation/toneGrade.ts';

const luminance = hex => { const c = new Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
/** Saturation of the colour as written (display sRGB), not of three's linear values. */
const saturation = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), max = Math.max(...v), min = Math.min(...v); return max ? (max - min) / max : 0; };

test('白天的太阳在进场玩家身后（西南），天空里的太阳和环境光用同一个方向', () => {
  const env = GAME_CONTENT.environment;
  const [x, y, z] = env.surface.sunPosition;
  assert.ok(z > 0 && x < 0 && y > 0, `sun from the south-west, above: ${[x, y, z]}`);
  assert.deepEqual(env.sky.sunPosition, env.surface.sunPosition, 'sky sun disc follows the light');
});

test('白天的补光远弱于太阳且接近中性：阴面看得清，但不再泛青发灰', () => {
  const day = GAME_CONTENT.environment.surface, [x, y, z] = day.sunPosition;
  const elevation = Math.atan2(y, Math.hypot(x, z));
  // Light reaching flat ground (Lambert, per unit albedo): direct sun versus sky/ground fill and IBL.
  const sun = day.sunIntensity * Math.sin(elevation) * luminance(day.sunColor) / Math.PI;
  const fill = day.ambientIntensity * luminance(day.skyColor) / Math.PI + GAME_CONTENT.environment.sky.environmentIntensity * 0.45;
  assert.ok(sun / fill >= 2.5, `sun ${sun.toFixed(2)} vs fill ${fill.toFixed(2)}`);
  assert.ok(saturation(day.skyColor) < 0.12, `fill colour nearly neutral: ${day.skyColor}`);
});

test('游戏用带调色的色调映射：着色器里多一步绿色和反差调整，不加额外渲染通道', () => {
  assert.match(ShaderChunk.tonemapping_pars_fragment, /mining-tone-grade/);
  assert.match(ShaderChunk.tonemapping_pars_fragment, new RegExp(TONE_GRADE.greenSaturation.toFixed(4)));
  const renderer = { toneMapping: 0 };
  applyToneGrade(renderer);
  assert.equal(renderer.toneMapping, CustomToneMapping);
  applyToneGrade(renderer, false);
  assert.equal(renderer.toneMapping, NeutralToneMapping);
});

test('房子材质：贴图颜色提亮提饱和；墙面多吃一份暖色反射光', async () => {
  const { MeshStandardMaterial } = await import('three');
  const { ARCHITECTURE_ALBEDO, liftAlbedo } = await import('../../src/game/presentation/albedoLift.ts');
  const material = new MeshStandardMaterial();
  liftAlbedo(material); liftAlbedo(material);
  const shader = { uniforms: {}, fragmentShader: 'void main(){\n#include <map_fragment>\n#include <lights_fragment_end>\n}' };
  material.onBeforeCompile(shader, null);
  assert.equal(shader.fragmentShader.match(/albedoSaturation \)/g)?.length, 1, 'patched once even if lifted twice');
  assert.match(shader.fragmentShader, /reflectedLight\.indirectDiffuse \*= mix\( albedoBounce/);
  assert.equal(material.customProgramCacheKey(), 'architecture-albedo-lift-v4');
  assert.equal(shader.uniforms.albedoSaturation.value, ARCHITECTURE_ALBEDO.saturation);
  const [r, g, b] = shader.uniforms.albedoBounce.value.toArray();
  assert.ok(g === ARCHITECTURE_ALBEDO.bounce && r > g && b < g, `warm daytime bounce: ${[r, g, b]}`);
});

test('房子图集里的灯、信标、熔岩、水晶自发光：按 Blender 导出的色块表加自身颜色', async () => {
  const { MeshStandardMaterial, Texture } = await import('three');
  const { liftAlbedo } = await import('../../src/game/presentation/albedoLift.ts');
  const glow = JSON.parse(readFileSync(new URL('../../src/game/content/pinewind/architecture-glow.json', import.meta.url), 'utf8'));
  assert.ok(glow.glow['15'] > 0, 'lamp glass glows');
  const material = new MeshStandardMaterial({ map: new Texture() });
  liftAlbedo(material);
  const shader = { uniforms: {}, fragmentShader: 'void main(){\n#include <map_fragment>\n#include <emissivemap_fragment>\n#include <lights_fragment_end>\n}' };
  material.onBeforeCompile(shader, null);
  assert.match(shader.fragmentShader, /totalEmissiveRadiance \+= diffuseColor\.rgb \* glow/);
  const tiles = shader.uniforms.glowTile.value.flatMap(v => v.toArray()), strengths = shader.uniforms.glowStrength.value.flatMap(v => v.toArray());
  for (const [tile, strength] of Object.entries(glow.glow)) assert.equal(strengths[tiles.indexOf(+tile)], strength, `tile ${tile}`);
  assert.ok(glow.halos.length > 0 && glow.halos.every(h => h.node && h.at.length === 3 && h.size > 0), 'halos sit in a model frame');
});

test('世界 2、3 的路灯、信标和坠星也有柔光晕：随各自的基地加载，一个基地一次绘制', async () => {
  const { surfaceHalos } = await import('../../src/game/presentation/SurfaceHalos.ts');
  const { TECH_BASE } = await import('../../src/game/content/world2/techBase.ts');
  const { STAR_BASE } = await import('../../src/game/content/world3/starBase.ts');
  const base = (asset, z) => ({ asset, at: [0, 0, z], rotation: [0, 0, 0, 1], scale: [1, 1, 1] });
  for (const [instance, count, top] of [[base(TECH_BASE.asset, TECH_BASE.worldZ), TECH_BASE.lamps.length + 1, 14.2 + TECH_BASE.beacon[1]],
    [base(STAR_BASE.asset, STAR_BASE.worldZ), STAR_BASE.lamps.length + 1, STAR_BASE.star.at[1]]]) {
    const mesh = surfaceHalos([instance]);
    assert.ok(mesh, instance.asset);
    const p = mesh.geometry.getAttribute('position');
    assert.equal(p.count, count * 4, `${instance.asset}: four corners per halo`);
    let high = 0; for (let i = 0; i < p.count; i++) { high = Math.max(high, p.getY(i)); assert.ok(Math.abs(p.getZ(i) - instance.at[2]) < 80, 'in its own world'); }
    assert.ok(Math.abs(high - top) < 1e-6, `${instance.asset}: the highest halo is the beacon / the star`);
  }
  assert.equal(surfaceHalos([base('automine-hall', 0)]), null, 'halls carry none');
});

test('主角、身上的装备和宠物都有角色补光：背光面补环境光，朝镜头的背阳面再补一道；关掉时和原来一样', async () => {
  const { applyCharacterFill, setCharacterFill, CHARACTER_FILL } = await import('../../src/game/presentation/characterFill.ts');
  const { MeshStandardMaterial, BoxGeometry, Group, Texture } = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MinerAvatar } = await import('../../src/game/presentation/MinerAvatar.ts');
  const { PetModel, PetTextures } = await import('../../src/game/presentation/pets/PetModel.ts');
  const { petLook } = await import('../../src/game/content/petLooks.ts');
  // The shader: after the lights, the sky's light scaled; a second call does not patch twice.
  const m = new MeshStandardMaterial(); applyCharacterFill(m); applyCharacterFill(m);
  const shader = { uniforms: {}, vertexShader: '', fragmentShader: '#include <lights_fragment_end>\n' };
  m.onBeforeCompile(shader, null);
  assert.equal(shader.fragmentShader.match(/characterViewFill \* towardCamera/g).length, 1);
  assert.match(shader.fragmentShader, /reflectedLight\.indirectDiffuse \*= mix\( characterBounce/);
  assert.match(m.customProgramCacheKey(), /character-fill-v1/);
  // Off is exactly the old lighting; the default fills the shaded side.
  setCharacterFill({ bounce: 1, view: 0 });
  assert.deepEqual(shader.uniforms.characterBounce.value.toArray(), [1, 1, 1]); assert.equal(shader.uniforms.characterViewFill.value, 0);
  setCharacterFill(null);
  assert.ok(Math.abs(shader.uniforms.characterBounce.value.y - CHARACTER_FILL.bounce) < 1e-9 && shader.uniforms.characterViewFill.value === CHARACTER_FILL.view);
  // Every material of the player (with the pickaxe and the bag) and of a pet takes it.
  const loader = new GLTFLoader().register(() => ({ name: 'cpu-test-textures', loadTexture: () => Promise.resolve(new Texture()) }));
  const parse = name => { const b = readFileSync(new URL(`../../src/game/assets/${name}.glb`, import.meta.url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
  const avatar = Reflect.construct(MinerAvatar, await Promise.all(['character/miner-d', 'shop/equipment'].map(parse)));
  new Group().add(avatar.group); avatar.setEquipment(5, 5);
  const pet = new PetModel(petLook('amber-fox'), new BoxGeometry(1, 1, 1), new PetTextures(), () => .5);
  try {
    for (const root of [avatar.group, pet.group]) root.traverse(o => {
      if (!o.isMesh) return;
      for (const material of [o.material].flat()) if (material.isMeshStandardMaterial) assert.ok(material.userData.characterFill, `${root.name}: ${o.name} (${material.name})`);
    });
  } finally { avatar.dispose(); pet.dispose?.(); }
});
