import { SceneAssetBundle } from "./SceneAssetBundle.ts";
import type { SurfaceContent } from "../content/campContent.ts";
import { Group, Mesh, MeshStandardMaterial } from "three";
import type { loadModelAssets } from "./ModelAssetLoader.ts";
import { createScenery, disposeScenery } from "./SceneryMesh.ts";
import { SurfaceDetails } from "./SurfaceDetails.ts";
import { BoundaryStitcher } from "./BoundaryStitcher.ts";
import { paintCampGround } from "./campGround.ts";
import { instanceMineBlocks } from "./instanceMineBlocks.ts";
import { instanceStaticProps } from "./instanceStaticProps.ts";
import { createBoundaryCore } from "./BoundaryCore.ts";
import { surfaceTextureMemory } from "./surfaceTextureMemory.ts";
export type SurfaceScene = {
  group: Group;
  details: SurfaceDetails;
  retain: () => void;
  dispose: () => void;
};
export function assembleSurface(
  assets: Awaited<ReturnType<typeof loadModelAssets>>,
  details: SurfaceDetails,
  content: SurfaceContent,
  start: number,
  staticBatchingEnabled: boolean,
): SurfaceScene {
  const { placements, plan, profiles, shaft } = content;
  const group = new Group();
  group.name = "camp-tripo-v2";
  const { stats, textures, textureUploads } = assets;
  const bundle = new SceneAssetBundle();
  for (const template of assets.templates.values()) bundle.retain(template);
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    const all = new Group();
    all.add(group, ...assets.templates.values());
    bundle.dispose(all, details.ownedTextures);
    assets.templates.clear();
    details.dispose();
  };
  const groundMaterials = new Set<MeshStandardMaterial>();
  const boundaryStitcher = new BoundaryStitcher();
  try {
    for (const p of placements) {
      const source = assets.templates.get(p.asset)!,
        instance = source.clone(true),
        scale = p.width / source.userData.width;
      instance.name = `${p.asset}@${p.x},${p.z}`;
      instance.userData.mineBatch = profiles[p.asset].mineBatch;
      instance.scale.set(
        scale,
        p.height === undefined ? scale : p.height / source.userData.height,
        p.depth === undefined ? scale : p.depth / source.userData.depth,
      );
      instance.rotation.y = p.yaw ?? 0;
      instance.position.set(p.x, p.y ?? -0.08, p.z);
      boundaryStitcher.apply(instance, p);
      if (profiles[p.asset].ground)
        instance.traverse((o) => {
          if (!(o instanceof Mesh)) return;
          o.castShadow = false;
          o.userData.surfaceGround = true;
          for (const m of (Array.isArray(o.material)
            ? o.material
            : [o.material]) as MeshStandardMaterial[]) {
            if (groundMaterials.has(m)) continue;
            groundMaterials.add(m);
            const compile = m.onBeforeCompile;
            m.onBeforeCompile = (shader, renderer) => {
              compile.call(m, shader, renderer);
              shader.uniforms.campShaft = {
                value: [shaft.minX, shaft.maxX, shaft.minZ, shaft.maxZ],
              };
              shader.vertexShader =
                "varying vec3 campWorld;\n" + shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace(
                "#include <project_vertex>",
                "#include <project_vertex>\ncampWorld=(modelMatrix*vec4(transformed,1.0)).xyz;",
              );
              shader.fragmentShader =
                "uniform vec4 campShaft;\nvarying vec3 campWorld;\n" +
                shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <clipping_planes_fragment>",
                "#include <clipping_planes_fragment>\nif(campWorld.x>campShaft.x && campWorld.x<campShaft.y && campWorld.z>campShaft.z && campWorld.z<campShaft.w)discard;",
              );
            };
            m.customProgramCacheKey = () => "camp-tripo-ground-shaft-v2";
            paintCampGround(content.details.ground,m, details.atlas, details.roadStone, details.bakedContact);
          }
          // Mirror the shader's shaft cut in diagnostic raycasts; no mesh is created.
          const raycast = o.raycast;
          o.raycast = function (ray, hits) {
            const collected: typeof hits = [];
            raycast.call(this, ray, collected);
            hits.push(
              ...collected.filter(
                (h) =>
                  h.point.x <= shaft.minX ||
                  h.point.x >= shaft.maxX ||
                  h.point.z <= shaft.minZ ||
                  h.point.z >= shaft.maxZ,
              ),
            );
          };
        });
      if (p.portalId) instance.userData.portalId = p.portalId;
      if (p.tint || p.portalAccent)
        instance.traverse((o) => {
          if (!(o instanceof Mesh)) return;
          const style = (source: MeshStandardMaterial) => {
            const m = source.clone();
            m.onBeforeCompile = source.onBeforeCompile;
            m.customProgramCacheKey = source.customProgramCacheKey;
            if (p.tint) m.color.set(p.tint);
            if (p.portalAccent && m.name === "portal-accent") {
              m.color.set(p.portalAccent);
              m.emissive.set(p.portalAccent);
              m.emissiveIntensity = 0.12;
            }
            return m;
          };
          o.material = Array.isArray(o.material)
            ? o.material.map((m) => style(m as MeshStandardMaterial))
            : style(o.material as MeshStandardMaterial);
        });
      group.add(instance);
    }
  } catch (error) {
    cleanup();
    throw error;
  }
  try {
    const mineBatching = instanceMineBlocks(group);
    const staticBatching = instanceStaticProps(group, staticBatchingEnabled);
    group.userData.boundaryStitching = {
      ...boundaryStitcher.stats,
      continuousCore: true,
      woodFillers: 0,
    };
    const ponds = details.createPonds();
    group.userData.ponds = ponds.userData.ponds;
    group.add(
      createScenery(plan),
      details.createGrass(),
      details.createCurbs(),
      ponds,
      details.wallTorches.group,
      createBoundaryCore(content.details.boundary),
    );
    group.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    group.userData.surfaceShading = {
      decorativeLights: { emitLight: false, fixture: "mine-pendant" },
      mineMaterials: "blender-authored-128px",
      mineBatching,
      staticBatching,
      version: "camp-tripo-v2",
      asset: "tripo-environment-blender-mine",
      generator: "Tripo v3.1 and authored Blender mine blocks",
      assets: stats,
      instances: placements.length,
      bytes: stats.reduce((n, s) => n + Number(s.bytes), 0),
      prepareMs: performance.now() - start,
      runtimeOcclusionProbes: 0,
      compression: "KTX2 ETC1S/UASTC + Meshopt + gzip",
      textureMemory: surfaceTextureMemory(textures),
      textureUploads,
      prefetch: assets.prefetch,
      maxConcurrentModelDecodes: 1,
      maxTextureWorkers: 2,
      distanceUnloading: false,
    };
    bundle.retain(group);
    return {
      group,
      details,
      retain: () => bundle.retain(group),
      dispose: cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
