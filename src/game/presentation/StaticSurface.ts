import { assembleAuthoredSurface } from "./assembleAuthoredSurface.ts";
import { AdditiveBlending, type Group, Mesh, NearestFilter, NearestMipmapNearestFilter, type MeshStandardMaterial, type WebGLRenderer } from "three";
import type { SurfaceContent } from "../content/gameContent.ts";
import { liftAlbedo, liftFoliage } from "./albedoLift.ts";
import { applyCreekWater } from "./creekWater.ts";
import { applyBakedLight, setBakedGround, setBakedSun } from "./bakedLight.ts";
import { loadStandingLight, setStandingLight } from "./standingLight.ts";
import standingLightUrl from "../assets/scene/pinewind-standing-light.png?url";
import { loadModelAssets, type ModelRequest } from "./ModelAssetLoader.ts";
import type { AuthoredInstance } from "../content/authoredSurface.ts";
import type { WorldId } from "../content/worldJourney.ts";
const urls = import.meta.glob("../assets/scene/*.part", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const manifests = import.meta.glob("../assets/scene/*.manifest.json", { eager: true, import: "default" }) as Record<string, ModelRequest["manifest"]>;

/** Loads world 1's authored surface (and the halls that ship with it) with its baked light, and the scenes of the
 *  `worlds` given (the one the player starts in); every other world's scene loads the first time it is asked for
 *  (`loadWorld`, when the player travels there) and then stays. */
export async function loadStaticSurface(
  renderer: WebGLRenderer,
  content: SurfaceContent,
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
  worlds: ReadonlySet<WorldId> = new Set([1]),
) {
  const light=content.authored.light;
  // The characters' sun grid downloads alongside the models (a small PNG).
  const standing=loadStandingLight(standingLightUrl,light.ground,light.standing.heightStep,signal);
  standing.catch(()=>{});
  const requests=(instances:readonly AuthoredInstance[]):ModelRequest[]=>[...new Set(instances.map(p=>p.asset))].map(name=>{
    const manifest=manifests[`../assets/scene/${name}.manifest.json`];
    if(!manifest)throw Error(`缺少模型清单 ${name}`);
    return {name,manifest,coordinateSpace:'authored',parts:manifest.parts.map(part=>{
      const url=urls[`../assets/scene/${part}`];if(!url)throw Error(`缺少模型资源 ${part}`);return url;
    }),bytes:manifest.bytes,decodedBytes:manifest.decodedBytes,instances:instances.filter(p=>p.asset===name).length};
  });
  const of=(world:WorldId)=>content.authored.instances.filter(p=>(p.world??1)===world);
  const boot=content.authored.instances.filter(p=>(p.world??1)===1||worlds.has(p.world!));
  const prepare=(m:MeshStandardMaterial,request:ModelRequest)=>{
    // Matte, except the halls' glossy floors (their lamps' highlights slide over them); halos add light.
    if(!/gloss/i.test(m.name))m.roughness=1;m.metalness=0;m.envMapIntensity=0;
    if(m.name.startsWith('Glow halo')){m.blending=AdditiveBlending;m.depthWrite=false;m.fog=false;m.transparent=true;}
    if(m.map){m.map.magFilter=NearestFilter;m.map.minFilter=NearestMipmapNearestFilter;}
    if(request.name==='pinewind-architecture')liftAlbedo(m);
    // Woods, rocks and the cliff walls (the valley's, world 2's mesas, world 3's crater walls): lit all round
    // like the original's valley, not near black in shade.
    else if(m.name==='Nature_PixelAtlas_Opaque'||/^(Valley cliff|Base cliff|Base crater rock)/.test(m.name))liftFoliage(m);
    if(m.name==='Creek water')applyCreekWater(m);
    applyBakedLight(m);
  };
  const assets=await loadModelAssets(renderer,requests(boot),signal,prepare,onProgress);
  setBakedSun(content.authored.light.sun);
  let groundLight=null as MeshStandardMaterial['aoMap'];
  assets.templates.get('pinewind-landscape')?.traverse(o=>{if(!groundLight&&o instanceof Mesh&&o.userData.surfaceGround!==false){const m=o.material as MeshStandardMaterial;if(m.aoMap)groundLight=m.aoMap;}});
  setBakedGround(groundLight,content.authored.light.ground);
  const scene=assembleAuthoredSurface(assets,content,boot);
  try{setStandingLight(await standing);}catch(error){scene.dispose();throw error;}
  const dispose=scene.dispose;
  scene.dispose=()=>{setStandingLight(null);setBakedGround(null,light.ground);dispose();};
  // The other worlds' scenes: loaded on first request, kept for the session. A failed load can be asked again.
  const ready=new Set<WorldId>([1,...worlds]),loading=new Map<WorldId,Promise<Group|null>>();
  scene.worldReady=world=>ready.has(world);
  scene.loadWorld=(world,onProgress)=>{
    if(ready.has(world))return Promise.resolve(null);
    let task=loading.get(world);
    if(!task){
      const instances=of(world);
      if(!instances.length){ready.add(world);return Promise.resolve(null);}
      task=loadModelAssets(renderer,requests(instances),signal,prepare,onProgress).then(more=>{const part=scene.extend(more,instances);ready.add(world);return part;});
      task.catch(()=>loading.delete(world));
      loading.set(world,task);
    }
    return task;
  };
  return scene;
}
