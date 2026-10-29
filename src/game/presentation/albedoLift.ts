import { Vector3, Vector4, type MeshStandardMaterial } from 'three';
import architectureGlow from '../content/pinewind/architecture-glow.json' with { type: 'json' };

/** Material-level look for the authored buildings (houses, headframe, bridge, terraces, eggs,
 *  teleport station) under the strong-sun, weak-fill daylight:
 *  - the atlas colour is made brighter and more saturated before lighting (brightness is a gamma
 *    lift, black and white stay put; saturation pushes away from grey; both in display space);
 *  - the buildings take extra warm fill on walls and undersides (`bounce`), like the sunlit
 *    sand plaza reflecting onto the house fronts, so walls facing away from the sun do not drop into
 *    grey; tops lit by the open sky keep the normal fill;
 *  - a few atlas tiles light themselves (architecture-glow.json, written by the Blender build).
 *  The uniforms are shared, so every copy of the material follows one setting. */
export const ARCHITECTURE_ALBEDO = { saturation: 1.25, brightness: 1.25, bounce: 5.2 } as const;
/** Trees, bushes and rocks (the shared nature atlas): canopies scatter sunlight, so in a dense wood their
 *  shaded and backlit sides keep a good share of their own green instead of dropping to near black (the
 *  original game's woods stay bright all round). Neutral fill, a slight lift of the atlas colour, and the
 *  same lighter sky occlusion as the buildings (bakedLight.ts). */
const FOLIAGE_ALBEDO = { saturation: 1.12, brightness: 1.28, bounce: 5 } as const;
type Look = { saturation: number; brightness: number; bounce: number };
/** Light bounced off the sunlit sand is warm; light through leaves keeps its own colour. */
const looks = {
  architecture: { tint: [1.08, 1, 0.86] as const, bounce: ARCHITECTURE_ALBEDO.bounce as number, key: 'architecture-albedo-lift-v4', uniforms: uniformsFor(ARCHITECTURE_ALBEDO), glow: true },
  foliage: { tint: [1, 1, 1] as const, bounce: FOLIAGE_ALBEDO.bounce as number, key: 'foliage-albedo-lift-v1', uniforms: uniformsFor(FOLIAGE_ALBEDO), glow: false },
};
function uniformsFor(look: Look) {
  return { albedoSaturation: { value: look.saturation }, albedoBrightness: { value: look.brightness }, albedoBounce: { value: new Vector3(1, 1, 1) } };
}
/** The building atlas tiles that light themselves (lamp glass, the beacon, magma, crystals, ice; listed by the
 *  Blender build): up to twelve tile indices and strengths, packed four to a vector, unused slots -1. */
const GLOW_SLOTS = 3;
const glowEntries = Object.entries(architectureGlow.glow as Record<string, number>);
if (glowEntries.length > GLOW_SLOTS * 4) throw Error('architecture-glow.json: too many glowing tiles');
const glowUniforms = {
  glowTile: { value: Array.from({ length: GLOW_SLOTS }, (_, i) => new Vector4(...[0, 1, 2, 3].map(k => +(glowEntries[i * 4 + k]?.[0] ?? -1)) as [number, number, number, number])) },
  glowStrength: { value: Array.from({ length: GLOW_SLOTS }, (_, i) => new Vector4(...[0, 1, 2, 3].map(k => glowEntries[i * 4 + k]?.[1] ?? 0) as [number, number, number, number])) },
};
const GLOW_FRAGMENT = `#include <emissivemap_fragment>
	{
		// The atlas tile under this fragment (row-major from the top left); a glowing tile adds its own colour.
		vec2 tileAt = floor( vMapUv * ${architectureGlow.atlasTiles.toFixed(1)} );
		vec4 tile = vec4( tileAt.x + tileAt.y * ${architectureGlow.atlasTiles.toFixed(1)} );
		float glow = 0.0;
		for ( int i = 0; i < ${GLOW_SLOTS}; i ++ ) glow += dot( vec4( equal( glowTile[ i ], tile ) ), glowStrength[ i ] );
		totalEmissiveRadiance += diffuseColor.rgb * glow;
	}`;
const applyBounce = () => {
  for (const look of Object.values(looks)) look.uniforms.albedoBounce.value.set(...look.tint.map(t => look.bounce * t) as [number, number, number]);
};
applyBounce();

export function liftAlbedo(material: MeshStandardMaterial) { lift(material, looks.architecture); }
export function liftFoliage(material: MeshStandardMaterial) { lift(material, looks.foliage); }
function lift(material: MeshStandardMaterial, look: (typeof looks)[keyof typeof looks]) {
  if (material.userData.albedoLift) return;
  // Lifted materials also take the lighter sky occlusion (bakedLight.ts).
  material.userData.albedoLift = true;
  const uniforms = look.uniforms;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms, look.glow ? glowUniforms : {});
    if (look.glow && material.map) shader.fragmentShader = `uniform vec4 glowTile[ ${GLOW_SLOTS} ];\nuniform vec4 glowStrength[ ${GLOW_SLOTS} ];\n` + shader.fragmentShader.replace('#include <emissivemap_fragment>', GLOW_FRAGMENT);
    shader.fragmentShader = 'uniform float albedoSaturation;\nuniform float albedoBrightness;\nuniform vec3 albedoBounce;\n' + shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
	// Bounce reaches walls and undersides, not the tops lit by the open sky.
	reflectedLight.indirectDiffuse *= mix( albedoBounce, vec3( 1.0 ), max( dot( normal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ), 0.0 ) );`).replace('#include <map_fragment>', `#include <map_fragment>
	{
		vec3 g = pow( max( diffuseColor.rgb, vec3( 0.0 ) ), vec3( 1.0 / ( 2.2 * albedoBrightness ) ) );
		float l = dot( g, vec3( 0.2126, 0.7152, 0.0722 ) );
		g = mix( vec3( l ), g, albedoSaturation );
		float peak = max( g.r, max( g.g, g.b ) );
		if ( peak > 0.96 ) g *= ( 0.96 + 0.04 * ( 1.0 - exp( -( peak - 0.96 ) / 0.04 ) ) ) / peak;
		diffuseColor.rgb = pow( max( g, vec3( 0.0 ) ), vec3( 2.2 ) );
	}`);
  };
  material.customProgramCacheKey = () => look.key;
}

/** Verification only: retune live (shared by every lifted material). */
export function setArchitectureAlbedo(saturation: number, brightness: number, fill: number = ARCHITECTURE_ALBEDO.bounce) {
  const { uniforms } = looks.architecture;
  uniforms.albedoSaturation.value = saturation;
  uniforms.albedoBrightness.value = brightness;
  looks.architecture.bounce = fill; applyBounce();
}
/** Verification only: retune the foliage look live (null restores it). */
export function setFoliageAlbedo(value: Partial<Look> | null) {
  const look = { ...FOLIAGE_ALBEDO, ...value }, { uniforms } = looks.foliage;
  uniforms.albedoSaturation.value = look.saturation;
  uniforms.albedoBrightness.value = look.brightness;
  looks.foliage.bounce = look.bounce; applyBounce();
}
