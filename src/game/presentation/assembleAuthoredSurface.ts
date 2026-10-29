import {Group,Mesh,Material} from 'three';
import type {SurfaceContent} from '../content/gameContent.ts';
import type {SurfaceScene} from './SurfaceScene.ts';
import {SceneAssetBundle} from './SceneAssetBundle.ts';
import {createScenery} from './SceneryMesh.ts';
import {bakedLightState, setBakedLightEnabled} from './bakedLight.ts';
import {setCreekTime} from './creekWater.ts';
import {setLockedEggTime} from './LockedEggs.ts';
import type {loadModelAssets} from './ModelAssetLoader.ts';
import type {AuthoredInstance} from '../content/authoredSurface.ts';
import {surfaceHalos} from './SurfaceHalos.ts';

type Assets=Awaited<ReturnType<typeof loadModelAssets>>;
/** Places the authored instances given (assets are session-owned by the loader) and the plan's props and signs;
 *  `extend` places more of them later (a world's scene loaded when the player first goes there). */
export function assembleAuthoredSurface(assets:Assets,content:SurfaceContent,instances:readonly AuthoredInstance[]=content.authored.instances):SurfaceScene&{extend(more:Assets,instances:readonly AuthoredInstance[]):Group} {
 const art=content.authored;
 const bundle=new SceneAssetBundle(),group=new Group();group.name=art.version;
 const loaded=[assets];
 for(const template of assets.templates.values())bundle.retain(template);
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;const all=new Group();all.add(group,...loaded.flatMap(a=>[...a.templates.values()]));bundle.dispose(all,new Set());for(const a of loaded)a.templates.clear();};
 const place=(from:Assets,list:readonly AuthoredInstance[],into:Group)=>{
  for(const p of list){
   const template=from.templates.get(p.asset);if(!template)throw Error(`Missing surface asset ${p.asset}`);
   const source=p.node?template.getObjectByName(p.node):template;if(!source)throw Error(`Missing surface node ${p.node}`);
   const node=source.clone(true);node.position.fromArray(p.at);node.quaternion.fromArray(p.rotation);node.scale.fromArray(p.scale);node.name=p.node??p.asset;
   node.traverse(o=>{if(!(o instanceof Mesh))return;if(p.ground)o.userData.surfaceGround=true;});
   into.add(node);
  }
 };
 const extend=(more:Assets,list:readonly AuthoredInstance[])=>{
  if(disposed)throw Error('Surface disposed');
  loaded.push(more);for(const template of more.templates.values())bundle.retain(template);
  const part=new Group();part.name=`${art.version}+${list.map(p=>p.asset).join(',')}`;place(more,list,part);bundle.retain(part);group.add(part);
  return part;
 };
 try {
  place(assets,instances,group);
  group.add(createScenery(content.plan));
  const halos=surfaceHalos(instances);if(halos)group.add(halos);
  group.userData.surfaceShading={version:art.version,assets:assets.stats,distanceUnloading:false,modelCoordinates:'content descriptors',collisionCoordinates:'content.plan'};
  bundle.retain(group);
  // Baked light lives in the materials (bakedLight.ts); the key light's direction decides when it shows.
  const baked={map:0,vertex:0};group.traverse(o=>{if(!(o instanceof Mesh))return;for(const m of (Array.isArray(o.material)?o.material:[o.material]) as Material[])if(m.userData.bakedLightApplied)baked[(m as {aoMap?:unknown}).aoMap?'map':'vertex']++;});
  let shadowEnabled=true;
  return {group,retain:()=>bundle.retain(group),dispose,extend,details:{beginDraw(){},update(elapsed,enabled){shadowEnabled=enabled;setBakedLightEnabled(enabled);setCreekTime(elapsed);setLockedEggTime(elapsed);},diagnostics:()=>({version:art.version,shadowEnabled,bakedLight:{...art.light,meshes:baked,...bakedLightState(),realtimeShadowMaps:0},nativeResolution:true,distanceUnloading:false})}};
 }catch(error){dispose();throw error;}
}
