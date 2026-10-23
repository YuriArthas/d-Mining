import { assembleAuthoredSurface } from "./assembleAuthoredSurface.ts";
import { NearestFilter, NearestMipmapNearestFilter } from "three";
import type { SurfaceContent } from "../content/campContent.ts";
import type { AssetProfile } from "../content/assetProfiles.ts";
import { Mesh, MeshStandardMaterial, type WebGLRenderer } from "three";
import { liftAlbedo } from "./albedoLift.ts";
import { SurfaceDetails } from "./SurfaceDetails.ts";
import {
  styleMineBlock,
  styleMineLens,
  styleMineBadge,
} from "./MineAtmosphere.ts";
import { loadModelAssets, type ModelRequest } from "./ModelAssetLoader.ts";
import { assembleSurface } from "./assembleSurface.ts";
const urls = import.meta.glob("../assets/camp/*.part", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const manifests = import.meta.glob("../assets/camp/*.manifest.json", {
  eager: true,
  import: "default",
}) as Record<
  string,
  {
    parts: string[];
    bytes: number;
    decodedBytes: number;
    taskId?: string;
    generationId?: string;
    materialProfile?: string;
    source: string;
  }
>;

function styleMaterial(
  m: MeshStandardMaterial,
  request: ModelRequest,
  details: SurfaceDetails,
  profile: AssetProfile,
  materials: SurfaceContent["materials"],
) {
  const { manifest } = request;
  m.metalness = materials.standard.metalness;
  m.roughness = Math.max(m.roughness, materials.standard.roughnessFloor);
  m.envMapIntensity = materials.standard.envMapIntensity;
  if (profile.material === "block") styleMineBlock(m);
  if (manifest.materialProfile === "authored-color") {
    m.roughness = materials.authoredColor.roughness;
    m.envMapIntensity = materials.authoredColor.envMapIntensity;
  }
  if (profile.material === "lens") styleMineLens(m, details.night);
  if (profile.material === "badge") styleMineBadge(m);
  if (profile.roughness !== undefined) m.roughness = profile.roughness;
  if (profile.metalness !== undefined) m.metalness = profile.metalness;
  if (profile.envMapIntensity !== undefined)
    m.envMapIntensity = profile.envMapIntensity;
}

export async function loadStaticSurface(
  renderer: WebGLRenderer,
  content: SurfaceContent,
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
) {
  if (content.authored) {
    const requests:ModelRequest[]=[...new Set(content.authored.instances.map(p=>p.asset))].map(name=>{
      const manifest=manifests[`../assets/camp/${name}.manifest.json`];
      if(!manifest)throw Error(`缺少模型清单 ${name}`);
      return {name,manifest,coordinateSpace:'authored',parts:manifest.parts.map(part=>{
        const url=urls[`../assets/camp/${part}`];if(!url)throw Error(`缺少模型资源 ${part}`);return url;
      }),bytes:manifest.bytes,decodedBytes:manifest.decodedBytes,instances:content.authored!.instances.filter(p=>p.asset===name).length};
    });
    const assets=await loadModelAssets(renderer,requests,signal,(m,request)=>{
      m.roughness=1;m.metalness=0;m.envMapIntensity=0;
      if(m.map){m.map.magFilter=NearestFilter;m.map.minFilter=NearestMipmapNearestFilter;}
      if(request.name==='pinewind-architecture')liftAlbedo(m);
    },onProgress);
    return assembleAuthoredSurface(assets,content);
  }
  const start = performance.now(),
    details = new SurfaceDetails(content.details);
  const names = [...new Set(content.placements.map((p) => p.asset))];
  try {
    const requests = names.map((name) => {
      const manifest = manifests[`../assets/camp/${name}.manifest.json`];
      if (!manifest) throw new Error(`缺少矿场模型: ${name}`);
      const parts = manifest.parts.map((part) => {
        const url = urls[`../assets/camp/${part}`];
        if (!url) throw new Error(`缺少模型资源块: ${part}`);
        return url;
      });
      return {
        name,
        manifest,
        parts,
        bytes: manifest.bytes,
        decodedBytes: manifest.decodedBytes,
        instances: content.placements.filter((p) => p.asset === name).length,
      };
    });
    const styled = new Set<MeshStandardMaterial>();
    const assets = await loadModelAssets(
      renderer,
      requests,
      signal,
      (material, request) => {
        if (styled.has(material)) return;
        styled.add(material);
        styleMaterial(
          material,
          request,
          details,
          content.profiles[request.name],
          content.materials,
        );
      },
      onProgress,
      (root, { name }) => {
        const lamp = content.profiles[name].lamp;
        if (!lamp) return;
        const done = new Set<MeshStandardMaterial>();
        root.traverse((o) => {
          if (!(o instanceof Mesh)) return;
          for (const m of (Array.isArray(o.material)
            ? o.material
            : [o.material]) as MeshStandardMaterial[]) {
            if (done.has(m)) continue;
            done.add(m);
            details.installLamp(m, lamp);
          }
        });
      },
      details.ownedTextures,
    );
    return assembleSurface(
      assets,
      details,
      content,
      start,
      new URLSearchParams(location.search).get("batching") !== "0",
    );
  } catch (error) {
    details.dispose();
    throw error;
  }
}
