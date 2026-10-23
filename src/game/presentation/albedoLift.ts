import { Vector3, type MeshStandardMaterial } from 'three';

/** Material-level look for the authored buildings (houses, headframe, bridge, terraces, eggs,
 *  portals) under the strong-sun, weak-fill daylight:
 *  - the atlas colour is made brighter and more saturated before lighting (brightness is a gamma
 *    lift, black and white stay put; saturation pushes away from grey; both in display space);
 *  - by day the buildings take extra warm fill on walls and undersides (`bounce`), like the sunlit
 *    sand plaza reflecting onto the house fronts, so walls facing away from the sun do not drop into
 *    grey; tops lit by the open sky keep the normal fill.
 *  The uniforms are shared, so every copy of the material follows one setting. */
export const ARCHITECTURE_ALBEDO = { saturation: 1.25, brightness: 1.2, bounce: 3.6 } as const;
/** Light bounced off the sunlit sand is warm. */
const BOUNCE_TINT = [1.08, 1, 0.86] as const;

const uniforms = {
  albedoSaturation: { value: ARCHITECTURE_ALBEDO.saturation as number },
  albedoBrightness: { value: ARCHITECTURE_ALBEDO.brightness as number },
  albedoBounce: { value: new Vector3(1, 1, 1) },
};
let bounce: number = ARCHITECTURE_ALBEDO.bounce, daylight = 1;
const applyBounce = () => {
  const gain = 1 + (bounce - 1) * daylight;
  uniforms.albedoBounce.value.set(...BOUNCE_TINT.map(t => gain * (1 + (t - 1) * daylight)) as [number, number, number]);
};
applyBounce();

export function liftAlbedo(material: MeshStandardMaterial) {
  if (material.userData.albedoLift) return;
  material.userData.albedoLift = true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
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
  material.customProgramCacheKey = () => 'architecture-albedo-lift-v3';
}

/** Per frame: the extra fill fades out with the daylight (no glowing houses at night). */
export function setArchitectureDaylight(value: number) {
  daylight = Math.max(0, Math.min(1, value)); applyBounce();
}

/** Verification only: retune live (shared by every lifted material). */
export function setArchitectureAlbedo(saturation: number, brightness: number, fill: number = ARCHITECTURE_ALBEDO.bounce) {
  uniforms.albedoSaturation.value = saturation;
  uniforms.albedoBrightness.value = brightness;
  bounce = fill; applyBounce();
}
