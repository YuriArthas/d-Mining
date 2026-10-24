import { DataTexture, ShaderChunk, Vector3, Vector4, type MeshStandardMaterial, type Texture } from 'three';

/** How the baked light (tools: surface-game-art/tools/terrain/bakeLight.mjs) is applied while playing.
 *  The bake stores two values per texel or vertex: sky occlusion (red) and sun visibility (green).
 *  - Sun visibility multiplies the directional light only while it shines from the baked sun direction
 *    (the surface sun). Down the shaft the key light moves to the layer's own top light and the baked
 *    shadows fade, so they never point the wrong way; underground they are off.
 *  - Sky occlusion multiplies the sky/ground fill fully and the direct light by `aoDirect`, which keeps a
 *    little contact darkening on sunlit ground.
 *  - `shadow` < 1 leaves a share of the sun in the fully shaded areas: shade stays readable.
 *  - Buildings take a lighter sky occlusion (`aoBuildings`): their walls turned from the sun live on the
 *    warm fill (albedoLift.ts), and full occlusion would darken the houses again.
 *  Only texture or vertex reads; no shadow maps or extra passes. */
export const BAKED_LIGHT = { shadow: 0.88, ao: 1, aoBuildings: 0.5, aoDirect: 0.3 } as const;
export type BakedLightMode = 'map' | 'vertex';

const uniforms = {
  bakedSunDirection: { value: new Vector3(0, 1, 0) },
  bakedShadow: { value: BAKED_LIGHT.shadow as number },
  bakedAo: { value: BAKED_LIGHT.ao as number },
  bakedAoBuildings: { value: BAKED_LIGHT.aoBuildings as number },
  bakedAoDirect: { value: BAKED_LIGHT.aoDirect as number },
};
let tuning = { shadow: BAKED_LIGHT.shadow as number, ao: BAKED_LIGHT.ao as number, aoBuildings: BAKED_LIGHT.aoBuildings as number, aoDirect: BAKED_LIGHT.aoDirect as number }, enabled = true;
const apply = () => {
  uniforms.bakedShadow.value = enabled ? tuning.shadow : 0;
  uniforms.bakedAo.value = enabled ? tuning.ao : 0;
  uniforms.bakedAoBuildings.value = enabled ? tuning.aoBuildings : 0;
  uniforms.bakedAoDirect.value = tuning.aoDirect;
};

const DIRECTIONAL = 'light.color = directionalLight.color;';
if (!ShaderChunk.lights_pars_begin.includes(DIRECTIONAL)) throw new Error('Three directional light chunk changed; review baked light');
const lightsPars = `float bakedSunVisibility = 1.0;
float bakedOcclusion = 1.0;
vec3 bakedSunView = vec3( 0.0, 1.0, 0.0 );
float bakedSunFactor( const in vec3 direction ) {
	return mix( 1.0, bakedSunVisibility, smoothstep( 0.985, 0.998, dot( direction, bakedSunView ) ) );
}
` + ShaderChunk.lights_pars_begin.replace(DIRECTIONAL, 'light.color = directionalLight.color * bakedSunFactor( directionalLight.direction );');

/** The valley's top-down ground bake, also read by the voxel blocks' upward faces at the surface (the
 *  top of the mine), so shadows cross the shaft rim. Fully lit until the authored surface provides it. */
const lit = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); lit.needsUpdate = true;
const ground = { bakedGroundMap: { value: lit as Texture }, bakedGroundRect: { value: new Vector4(0, 0, 1, 1) } };
export function setBakedGround(texture: Texture | null, rect: { x0: number; z0: number; size: number }) {
  ground.bakedGroundMap.value = texture ?? lit;
  ground.bakedGroundRect.value.set(rect.x0, rect.z0, rect.size, rect.size);
}

/** The direction the bake was traced toward (authored.json `light.sun`, the daytime key light position). */
export function setBakedSun(position: readonly [number, number, number]) {
  uniforms.bakedSunDirection.value.set(...position).normalize();
}
/** The settings menu's shadow switch turns the baked shadows and darkening off together. */
export function setBakedLightEnabled(value: boolean) { enabled = value; apply(); }
/** Verification only: retune live. */
export function setBakedLightTuning(value: Partial<typeof tuning> | null) { tuning = { ...BAKED_LIGHT, ...value }; apply(); }
/** Unit vector toward the baked sun (shared, do not modify). */
export function bakedSunDirection(): Readonly<Vector3> { return uniforms.bakedSunDirection.value; }
/** `active`: the baked sun shadows show (switched on and not tuned away). */
export function bakedLightState() { return { enabled, active: enabled && tuning.shadow > 0, ...tuning, sun: uniforms.bakedSunDirection.value.toArray() }; }

/** Characters: one shared value from the standing light grid (standingLight.ts), set per frame. */
const standing = { bakedStandingSun: { value: 1 } };
export function setStandingSun(value: number) { standing.bakedStandingSun.value = value; }
/** The shaders' fade as the key light turns away from the baked sun (1: aligned), for CPU-side use. */
export function bakedSunAlignment(keyDirection: Vector3) {
  const t = Math.min(1, Math.max(0, (keyDirection.dot(uniforms.bakedSunDirection.value) - .985) / (.998 - .985)));
  return t * t * (3 - 2 * t);
}

/** Patches a loaded surface material once. Materials with an occlusion texture read it on their second UV
 *  set (ground: top-down; buildings: lightmap atlas); materials marked `bakedLight: 'vertex'` read the
 *  per-vertex `_bake` attribute. Returns the mode, or null when the material carries no bake. */
export function applyBakedLight(material: MeshStandardMaterial): BakedLightMode | null {
  const mode: BakedLightMode | null = material.aoMap ? 'map' : material.userData.bakedLight === 'vertex' ? 'vertex' : null;
  if (!mode || material.userData.bakedLightApplied) return mode;
  patch(material, mode);
  return mode;
}
/** The player's character: the baked sun at its feet (no sky occlusion). */
export function applyStandingLight(material: MeshStandardMaterial) {
  if (!material.userData.bakedLightApplied) patch(material, 'standing');
}

function patch(material: MeshStandardMaterial, mode: BakedLightMode | 'standing') {
  material.userData.bakedLightApplied = true;
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms, mode === 'standing' ? standing : {});
    if (mode === 'vertex') shader.vertexShader = 'attribute vec4 _bake;\nvarying vec2 vBake;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBake = _bake.rg;');
    const sample = mode === 'map' ? 'texture2D( aoMap, vAoMapUv ).rg' : mode === 'vertex' ? 'vBake' : 'vec2( 1.0, bakedStandingSun )';
    const ao = material.userData.albedoLift ? 'bakedAoBuildings' : 'bakedAo';
    shader.fragmentShader = `uniform vec3 bakedSunDirection;\nuniform float bakedShadow;\nuniform float ${ao};\nuniform float bakedAoDirect;\n${mode === 'vertex' ? 'varying vec2 vBake;\n' : mode === 'standing' ? 'uniform float bakedStandingSun;\n' : ''}` + shader.fragmentShader
      .replace('#include <lights_pars_begin>', lightsPars)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
	{
		vec2 baked = ${sample};
		bakedSunVisibility = mix( 1.0, baked.g, bakedShadow );
		bakedOcclusion = mix( 1.0, baked.r, ${ao} );
		bakedSunView = normalize( ( viewMatrix * vec4( bakedSunDirection, 0.0 ) ).xyz );
	}`)
      .replace('#include <aomap_fragment>', `reflectedLight.indirectDiffuse *= bakedOcclusion;
	reflectedLight.directDiffuse *= mix( 1.0, bakedOcclusion, bakedAoDirect );`);
  };
  material.customProgramCacheKey = () => `${previousKey.call(material)}|baked-light-${mode}${material.userData.albedoLift ? '-buildings' : ''}-v1`;
}

/** Voxel terrain: upward faces at the surface level (top of the mine) take the ground bake at their world
 *  position; every other face is untouched. `world` and `normalY` name the material's own varyings. */
export function applyBakedGroundTop(material: MeshStandardMaterial, world: string, normalY: string) {
  if (material.userData.bakedLightApplied) return;
  material.userData.bakedLightApplied = true;
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms, ground);
    shader.fragmentShader = 'uniform vec3 bakedSunDirection;\nuniform float bakedShadow;\nuniform float bakedAo;\nuniform float bakedAoDirect;\nuniform sampler2D bakedGroundMap;\nuniform vec4 bakedGroundRect;\n' + shader.fragmentShader
      .replace('#include <lights_pars_begin>', lightsPars)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
	{
		vec2 groundUv = ( ${world}.xz - bakedGroundRect.xy ) / bakedGroundRect.zw;
		if ( ${normalY} > 0.5 && ${world}.y > -0.6 && all( greaterThanEqual( groundUv, vec2( 0.0 ) ) ) && all( lessThanEqual( groundUv, vec2( 1.0 ) ) ) ) {
			vec2 baked = texture2D( bakedGroundMap, groundUv ).rg;
			bakedSunVisibility = mix( 1.0, baked.g, bakedShadow );
			bakedOcclusion = mix( 1.0, baked.r, bakedAo );
		}
		bakedSunView = normalize( ( viewMatrix * vec4( bakedSunDirection, 0.0 ) ).xyz );
	}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= bakedOcclusion;
	reflectedLight.directDiffuse *= mix( 1.0, bakedOcclusion, bakedAoDirect );`);
  };
  material.customProgramCacheKey = () => `${previousKey.call(material)}|baked-ground-top-v1`;
}
