import { Mesh, Vector2, type Material, type MeshStandardMaterial, type Object3D } from 'three';

type Stand = Readonly<{ id: string; eggId: string; x: number; y: number; z: number }>;

/** Height above its stand where an egg display's egg begins (plinth, gold lip and nest end at 0.66 m). */
export const EGG_BODY_FROM = .68;
/** A locked egg is glossy dark obsidian: a deep indigo body that keeps sun highlights and sky reflections,
 *  a violet glow round its outline, and now and then a streak of light sweeping up it. */
const LOCKED = { body: 'vec3( 0.035, 0.03, 0.075 )', roughness: '0.2', metalness: '0.35', rim: 'vec3( 0.42, 0.3, 1.0 )', glint: 'vec3( 0.85, 0.8, 1.0 )' } as const;
/** Shared clock for the sweeping streak (seconds), set each frame with the creek's. */
const clock = { value: 0 };
export function setLockedEggTime(seconds: number) { clock.value = seconds % 4096; }

/** World 1's egg stands show eggs the player has not unlocked yet as dark glossy silhouettes: the player knows a
 *  stand holds something, and its price (EggStandLabels), but not what it looks like. Each stand is one
 *  authored mesh (plinth and egg together), so a per-stand material copy blacks out what lies above the
 *  nest in the shader and leaves the plinth as it is; one uniform per stand switches it. */
export class LockedEggs {
  private readonly stands: { eggId: string; locked: { value: number }; materials: Material[] }[] = [];

  constructor(surface: Object3D, stands: readonly Stand[]) {
    for (const stand of stands) {
      const root = surface.getObjectByName('Egg_' + stand.id);
      if (!root) continue;
      // Each stand's streak runs on its own beat, so the row never flashes in step.
      const locked = { value: 0 }, cut = { value: stand.y + EGG_BODY_FROM }, phase = { value: (this.stands.length * .37) % 1 }, centre = { value: new Vector2(stand.x, stand.z) }, materials: Material[] = [];
      root.traverse(o => {
        if (!(o instanceof Mesh)) return;
        const own = (source: MeshStandardMaterial) => {
          const m = source.clone(), base = source.onBeforeCompile, key = source.customProgramCacheKey();
          m.onBeforeCompile = (shader, renderer) => {
            base.call(source, shader, renderer);
            Object.assign(shader.uniforms, { eggLocked: locked, eggBodyFrom: cut, eggPhase: phase, eggTime: clock, eggCentre: centre });
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nvarying vec3 vEggWorld;')
              .replace('#include <project_vertex>', '#include <project_vertex>\nvEggWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nvarying vec3 vEggWorld;\nuniform float eggLocked;\nuniform float eggBodyFrom;\nuniform float eggPhase;\nuniform float eggTime;\nuniform vec2 eggCentre;')
              .replace('#include <color_fragment>', `#include <color_fragment>\nfloat eggHidden = eggLocked * step( eggBodyFrom, vEggWorld.y );\ndiffuseColor.rgb = mix( diffuseColor.rgb, ${LOCKED.body}, eggHidden );`)
              .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, ${LOCKED.roughness}, eggHidden );`)
              .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = mix( metalnessFactor, ${LOCKED.metalness}, eggHidden );`)
              .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	if ( eggHidden > 0.5 ) {
		// Violet rim where the faces turn away from the camera.
		float eggRim = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 2.5 );
		// A slanted streak sweeps up the egg (2.25 m tall) once every four seconds, then rests.
		float eggSweep = fract( eggTime * 0.25 + eggPhase ) * 2.2 - 0.4;
		float eggHeight = ( vEggWorld.y - eggBodyFrom ) / 2.25 + ( vEggWorld.x - eggCentre.x + vEggWorld.z - eggCentre.y ) * 0.18;
		float eggGlint = pow( 1.0 - smoothstep( 0.0, 0.18, abs( eggHeight - eggSweep ) ), 2.0 );
		totalEmissiveRadiance = ${LOCKED.rim} * eggRim * 0.55 + ${LOCKED.glint} * eggGlint * 0.45;
	}`);
          };
          m.customProgramCacheKey = () => key + '|locked-egg-v3';
          materials.push(m);
          return m;
        };
        o.material = Array.isArray(o.material) ? o.material.map(m => own(m as MeshStandardMaterial)) : own(o.material as MeshStandardMaterial);
      });
      this.stands.push({ eggId: stand.eggId, locked, materials });
    }
  }

  setUnlocked(unlocked: (eggId: string) => boolean) {
    for (const stand of this.stands) stand.locked.value = unlocked(stand.eggId) ? 0 : 1;
  }

  diagnostics() { return { stands: this.stands.length, locked: this.stands.filter(s => s.locked.value).map(s => s.eggId) }; }

  dispose() { for (const stand of this.stands) for (const m of stand.materials) m.dispose(); this.stands.length = 0; }
}
