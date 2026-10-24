import {Group,Mesh,Material} from 'three';
import type {SurfaceContent} from '../content/gameContent.ts';
import type {SurfaceScene} from './SurfaceScene.ts';
import {SceneAssetBundle} from './SceneAssetBundle.ts';
import {createScenery} from './SceneryMesh.ts';
import {bakedLightState, setBakedLightEnabled} from './bakedLight.ts';
import {setCreekTime} from './creekWater.ts';
import {setLockedEggTime} from './LockedEggs.ts';
import type {loadModelAssets} from './ModelAssetLoader.ts';

/** Places the authored instances (assets are session-owned by the loader) and the plan's props and signs. */
export function assembleAuthoredSurface(assets:Awaited<ReturnType<typeof loadModelAssets>>,content:SurfaceContent):SurfaceScene {
 const art=content.authored;
 const bundle=new SceneAssetBundle(),group=new Group();group.name=art.version;
 for(const template of assets.templates.values())bundle.retain(template);
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;const all=new Group();all.add(group,...assets.templates.values());bundle.dispose(all,new Set());assets.templates.clear();};
 try {
  for(const p of art.instances){
   const template=assets.templates.get(p.asset);if(!template)throw Error(`Missing surface asset ${p.asset}`);
   const source=p.node?template.getObjectByName(p.node):template;if(!source)throw Error(`Missing surface node ${p.node}`);
   const node=source.clone(true);node.position.fromArray(p.at);node.quaternion.fromArray(p.rotation);node.scale.fromArray(p.scale);node.name=p.node??p.asset;
   node.traverse(o=>{if(!(o instanceof Mesh))return;if(p.ground)o.userData.surfaceGround=true;});
   group.add(node);
  }
  group.add(createScenery(content.plan));
  group.userData.surfaceShading={version:art.version,assets:assets.stats,distanceUnloading:false,modelCoordinates:'content descriptors',collisionCoordinates:'content.plan'};
  bundle.retain(group);
  // Baked light lives in the materials (bakedLight.ts); the key light's direction decides when it shows.
  const baked={map:0,vertex:0};group.traverse(o=>{if(!(o instanceof Mesh))return;for(const m of (Array.isArray(o.material)?o.material:[o.material]) as Material[])if(m.userData.bakedLightApplied)baked[(m as {aoMap?:unknown}).aoMap?'map':'vertex']++;});
  let time='day',daylight=1,shadowEnabled=true;
  return {group,retain:()=>bundle.retain(group),dispose,details:{beginDraw(){},update(t,elapsed,enabled=true,_strength=1,blend=t==='day'?1:0){time=t;daylight=blend;shadowEnabled=enabled;setBakedLightEnabled(enabled);setCreekTime(elapsed);setLockedEggTime(elapsed);},diagnostics:()=>({version:art.version,time,daylight,shadowEnabled,bakedLight:{...art.light,meshes:baked,...bakedLightState(),realtimeShadowMaps:0},nativeResolution:true,distanceUnloading:false})}};
 }catch(error){dispose();throw error;}
}
