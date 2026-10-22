import { Group, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeScenery } from './disposeScenery.ts';

export const EQUIPMENT_URL=new URL('../assets/shop/equipment.glb',import.meta.url).href;
export const SHOWROOM_URL=new URL('../assets/shop/showroom.glb',import.meta.url).href;
export async function loadShopAsset(url:string,signal:AbortSignal):Promise<Group> {
  const response=await fetch(url,{signal});
  if(!response.ok)throw Error(`商店资源加载失败：HTTP ${response.status}`);
  const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'');
  if(signal.aborted){disposeScenery(gltf.scene);signal.throwIfAborted();}
  return gltf.scene;
}
export function requiredModel(root:Object3D,name:string) {
  const item=root.getObjectByName(name);
  if(!item)throw Error(`装备资源缺少模型 ${name}`);
  return item;
}
