import test from 'node:test';
import assert from 'node:assert/strict';
import { Color, CustomToneMapping, NeutralToneMapping, ShaderChunk } from 'three';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { PINEWIND_DAY } from '../../src/game/content/pinewindSurface.ts';
import { TONE_GRADE, applyToneGrade } from '../../src/game/presentation/toneGrade.ts';

const luminance = hex => { const c = new Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
/** Saturation of the colour as written (display sRGB), not of three's linear values. */
const saturation = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), max = Math.max(...v), min = Math.min(...v); return max ? (max - min) / max : 0; };

test('白天的太阳在进场玩家身后（西南），天空里的太阳和环境光用同一个方向', () => {
  const env = GAME_CONTENT.environment;
  const [x, y, z] = env.surface.day.moonPosition;
  assert.ok(z > 0 && x < 0 && y > 0, `sun from the south-west, above: ${[x, y, z]}`);
  assert.deepEqual(env.sky.lighting.day.moonPosition, env.surface.day.moonPosition, 'sky sun disc follows the light');
  assert.equal(env.sky.lighting.day.environmentIntensity, PINEWIND_DAY.environmentIntensity);
});

test('白天的补光远弱于太阳且接近中性：阴面看得清，但不再泛青发灰', () => {
  const day = GAME_CONTENT.environment.surface.day, [x, y, z] = day.moonPosition;
  const elevation = Math.atan2(y, Math.hypot(x, z));
  // Light reaching flat ground (Lambert, per unit albedo): direct sun versus sky/ground fill and IBL.
  const sun = day.moonIntensity * Math.sin(elevation) * luminance(day.moonColor) / Math.PI;
  const fill = day.ambientIntensity * luminance(day.skyColor) / Math.PI + PINEWIND_DAY.environmentIntensity * 0.45;
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

test('房子材质：贴图颜色提亮提饱和；白天墙面多吃一份暖色反射光，夜里这份光收掉', async () => {
  const { MeshStandardMaterial } = await import('three');
  const { ARCHITECTURE_ALBEDO, liftAlbedo, setArchitectureDaylight } = await import('../../src/game/presentation/albedoLift.ts');
  const material = new MeshStandardMaterial();
  liftAlbedo(material); liftAlbedo(material);
  const shader = { uniforms: {}, fragmentShader: 'void main(){\n#include <map_fragment>\n#include <lights_fragment_end>\n}' };
  material.onBeforeCompile(shader, null);
  assert.equal(shader.fragmentShader.match(/albedoSaturation \)/g)?.length, 1, 'patched once even if lifted twice');
  assert.match(shader.fragmentShader, /reflectedLight\.indirectDiffuse \*= mix\( albedoBounce/);
  assert.equal(material.customProgramCacheKey(), 'architecture-albedo-lift-v3');
  assert.equal(shader.uniforms.albedoSaturation.value, ARCHITECTURE_ALBEDO.saturation);
  setArchitectureDaylight(0);
  assert.deepEqual(shader.uniforms.albedoBounce.value.toArray(), [1, 1, 1], 'no extra fill at night');
  setArchitectureDaylight(1);
  const [r, g, b] = shader.uniforms.albedoBounce.value.toArray();
  assert.ok(g === ARCHITECTURE_ALBEDO.bounce && r > g && b < g, `warm daytime bounce: ${[r, g, b]}`);
});
