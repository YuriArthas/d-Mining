import { MeshStandardMaterial, Vector3 } from 'three';

/** Fill light for the player, the gear on them and the pets. The scenery's shaded walls take extra bounce light
 *  (albedoLift.ts, up to about 5x the sky's on faces that do not face up); figures had none, so with the sun behind
 *  them their visible side got only the sky's 0.7 against the sun's 3.18 and read far darker than the walls
 *  around (2026-10-29). Two terms, both scaling the sky's own light (so a dark hall underground stays dark):
 *  - `bounce`: faces that do not face up take up to this many times the sky light, warm like the sunlit sand;
 *  - `view`: the side turned to the camera and away from the sun takes up to this much more on top, so whatever the
 *    camera's angle the side the player sees is never dark, while the sunlit side is left as it was. */
export const CHARACTER_FILL = { bounce: 2.6, view: 1.2 } as const;
const TINT = [1.06, 1, .9] as const;
const uniforms = { characterBounce: { value: new Vector3() }, characterViewFill: { value: 0 } };
setCharacterFill(CHARACTER_FILL);

/** The figure's materials take the fill; safe to call twice. */
export function applyCharacterFill(material: MeshStandardMaterial) {
  if (material.userData.characterFill) return;
  material.userData.characterFill = true;
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = 'uniform vec3 characterBounce;\nuniform float characterViewFill;\n' + shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
	{
		float facingUp = max( dot( normal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ), 0.0 );
		float sunlit = 0.0;
		#if NUM_DIR_LIGHTS > 0
			sunlit = max( dot( normal, directionalLights[ 0 ].direction ), 0.0 );
		#endif
		float towardCamera = max( dot( normal, geometryViewDir ), 0.0 );
		reflectedLight.indirectDiffuse *= mix( characterBounce, vec3( 1.0 ), facingUp ) * ( 1.0 + characterViewFill * towardCamera * ( 1.0 - sunlit ) );
	}`);
  };
  material.customProgramCacheKey = () => `${previousKey.call(material)}|character-fill-v1`;
  material.needsUpdate = true;
}

/** Tuning (debug page): both terms, live. */
export function setCharacterFill(value: Partial<{ bounce: number; view: number }> | null) {
  const look = { ...CHARACTER_FILL, ...value };
  // The extra light is warm (the sand it comes off); none extra is exactly the old lighting.
  uniforms.characterBounce.value.set(...TINT.map(t => 1 + Math.max(0, look.bounce - 1) * t) as [number, number, number]);
  uniforms.characterViewFill.value = look.view;
}
