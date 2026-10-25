import { assembleAuthoredSurface } from "./assembleAuthoredSurface.ts";
import { AdditiveBlending, Mesh, NearestFilter, NearestMipmapNearestFilter, type MeshStandardMaterial, type WebGLRenderer } from "three";
import type { SurfaceContent } from "../content/gameContent.ts";
import { liftAlbedo, liftFoliage } from "./albedoLift.ts";
import { applyCreekWater } from "./creekWater.ts";
import { applyBakedLight, setBakedGround, setBakedSun } from "./bakedLight.ts";
import { loadStandingLight, setStandingLight } from "./standingLight.ts";
import standingLightUrl from "../assets/scene/pinewind-standing-light.png?url";
import { loadModelAssets, type ModelRequest } from "./ModelAssetLoader.ts";
const urls = import.meta.glob("../assets/scene/*.part", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const manifests = import.meta.glob("../assets/scene/*.manifest.json", { eager: true, import: "default" }) as Record<string, ModelRequest["manifest"]>;

/** Loads world 1's authored surface (and the halls that ship with it) with its baked light. */
export async function loadStaticSurface(
  renderer: WebGLRenderer,
  content: SurfaceContent,
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
) {
  const light=content.authored.light;
  // The characters' sun grid downloads alongside the models (a small PNG).
  const standing=loadStandingLight(standingLightUrl,light.ground,light.standing.heightStep,signal);
  standing.catch(()=>{});
  const requests:ModelRequest[]=[...new Set(content.authored.instances.map(p=>p.asset))].map(name=>{
    const manifest=manifests[`../assets/scene/${name}.manifest.json`];
    if(!manifest)throw Error(`缺少模型清单 ${name}`);
    return {name,manifest,coordinateSpace:'authored',parts:manifest.parts.map(part=>{
      const url=urls[`../assets/scene/${part}`];if(!url)throw Error(`缺少模型资源 ${part}`);return url;
    }),bytes:manifest.bytes,decodedBytes:manifest.decodedBytes,instances:content.authored.instances.filter(p=>p.asset===name).length};
  });
  const assets=await loadModelAssets(renderer,requests,signal,(m,request)=>{
    // Matte, except the halls' glossy floors (their lamps' highlights slide over them); halos add light.
    if(!/gloss/i.test(m.name))m.roughness=1;m.metalness=0;m.envMapIntensity=0;
    if(m.name.startsWith('Glow halo')){m.blending=AdditiveBlending;m.depthWrite=false;m.fog=false;m.transparent=true;}
    if(m.map){m.map.magFilter=NearestFilter;m.map.minFilter=NearestMipmapNearestFilter;}
    if(request.name==='pinewind-architecture')liftAlbedo(m);
    // Woods, rocks and the cliff walls: lit all round like the original's valley, not near black in shade.
    else if(m.name==='Nature_PixelAtlas_Opaque'||m.name.startsWith('Valley cliff'))liftFoliage(m);
    if(m.name==='Creek water')applyCreekWater(m);
    applyBakedLight(m);
  },onProgress);
  setBakedSun(content.authored.light.sun);
  let groundLight=null as MeshStandardMaterial['aoMap'];
  assets.templates.get('pinewind-landscape')?.traverse(o=>{if(!groundLight&&o instanceof Mesh&&o.userData.surfaceGround!==false){const m=o.material as MeshStandardMaterial;if(m.aoMap)groundLight=m.aoMap;}});
  setBakedGround(groundLight,content.authored.light.ground);
  const scene=assembleAuthoredSurface(assets,content);
  try{setStandingLight(await standing);}catch(error){scene.dispose();throw error;}
  const dispose=scene.dispose;
  scene.dispose=()=>{setStandingLight(null);setBakedGround(null,light.ground);dispose();};
  return scene;
}
