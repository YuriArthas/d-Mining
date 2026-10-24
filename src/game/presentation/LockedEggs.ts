import { Mesh, type Material, type MeshStandardMaterial, type Object3D } from 'three';

type Stand = Readonly<{ id: string; eggId: string; y: number }>;

/** Height above its stand where an egg display's egg begins (plinth, gold lip and nest end at 0.66 m). */
export const EGG_BODY_FROM = .68;
/** The colour of a locked egg: near black, so only its faceted outline and a faint sheen read. */
const LOCKED_RGB = 'vec3(0.028, 0.03, 0.04)';

/** World 1's egg stands show eggs the player has not unlocked yet as black silhouettes: the player knows a
 *  stand holds something, and its price (EggStandLabels), but not what it looks like. Each stand is one
 *  authored mesh (plinth and egg together), so a per-stand material copy blacks out what lies above the
 *  nest in the shader and leaves the plinth as it is; one uniform per stand switches it. */
export class LockedEggs {
  private readonly stands: { eggId: string; locked: { value: number }; materials: Material[] }[] = [];

  constructor(surface: Object3D, stands: readonly Stand[]) {
    for (const stand of stands) {
      const root = surface.getObjectByName('Egg_' + stand.id);
      if (!root) continue;
      const locked = { value: 0 }, cut = { value: stand.y + EGG_BODY_FROM }, materials: Material[] = [];
      root.traverse(o => {
        if (!(o instanceof Mesh)) return;
        const own = (source: MeshStandardMaterial) => {
          const m = source.clone(), base = source.onBeforeCompile, key = source.customProgramCacheKey();
          m.onBeforeCompile = (shader, renderer) => {
            base.call(source, shader, renderer);
            shader.uniforms.eggLocked = locked; shader.uniforms.eggBodyFrom = cut;
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nvarying float vEggWorldY;')
              .replace('#include <project_vertex>', '#include <project_vertex>\nvEggWorldY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;');
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nvarying float vEggWorldY;\nuniform float eggLocked;\nuniform float eggBodyFrom;')
              .replace('#include <color_fragment>', `#include <color_fragment>\nfloat eggHidden = eggLocked * step( eggBodyFrom, vEggWorldY );\ndiffuseColor.rgb = mix( diffuseColor.rgb, ${LOCKED_RGB}, eggHidden );`)
              .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 1.0 - eggHidden;');
          };
          m.customProgramCacheKey = () => key + '|locked-egg-v1';
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
