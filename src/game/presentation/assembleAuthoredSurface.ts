import {Group,Mesh,Material} from 'three';
import type {SurfaceContent} from '../content/campContent.ts';
import type {SurfaceScene} from './SurfaceScene.ts';
import {SceneAssetBundle} from './SceneAssetBundle.ts';
import {createScenery} from './SceneryMesh.ts';
import type {loadModelAssets} from './ModelAssetLoader.ts';

/** Assets are session-owned by the existing loader. Keep each interactive root
 * intact so SurfaceHubView owns its material changes independently. */
export function assembleAuthoredSurface(assets:Awaited<ReturnType<typeof loadModelAssets>>,content:SurfaceContent):SurfaceScene {
 const art=content.authored;if(!art)throw Error('Missing authored surface configuration');
 const bundle=new SceneAssetBundle(),group=new Group();group.name=art.version;
 for(const template of assets.templates.values())bundle.retain(template);
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;const all=new Group();all.add(group,...assets.templates.values());bundle.dispose(all,new Set());assets.templates.clear();};
 try {
  for(const p of art.instances){
   const template=assets.templates.get(p.asset);if(!template)throw Error(`Missing surface asset ${p.asset}`);
   const source=p.node?template.getObjectByName(p.node):template;if(!source)throw Error(`Missing surface node ${p.node}`);
   const node=source.clone(true);node.position.fromArray(p.at);node.quaternion.fromArray(p.rotation);node.scale.fromArray(p.scale);node.name=p.portalId?'portal:'+p.portalId:p.node??p.asset;
   if(p.portalId)node.userData.portalId=p.portalId;
   node.traverse(o=>{if(!(o instanceof Mesh))return;if(p.ground)o.userData.surfaceGround=true;});
   group.add(node);
  }
  group.add(createScenery(content.plan));
  group.userData.surfaceShading={version:art.version,assets:assets.stats,oldSurfaceAssetsLoaded:assets.stats.filter(s=>!String(s.name).startsWith("pinewind-")).length,distanceUnloading:false,modelCoordinates:'content descriptors',collisionCoordinates:'content.plan'};
  bundle.retain(group);
  const shadows:Mesh[]=[];group.traverse(o=>{if(o instanceof Mesh&&o.userData.bakedContact)shadows.push(o);});
  let time='day',daylight=1,shadowEnabled=true;
  return {group,retain:()=>bundle.retain(group),dispose,details:{beginDraw(){},update(t,_elapsed,enabled=true,strength=1,blend=t==='day'?1:0){time=t;daylight=blend;shadowEnabled=enabled;for(const mesh of shadows){mesh.visible=enabled&&strength>0;for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))m.opacity=(.35+.65*blend)*strength;}},diagnostics:()=>({version:art.version,time,daylight,shadowEnabled,bakedShadowMeshes:shadows.length,nativeResolution:true,distanceUnloading:false})}};
 }catch(error){dispose();throw error;}
}
