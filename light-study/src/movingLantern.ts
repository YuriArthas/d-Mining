import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {uniform,renderGroup} from 'three/tsl';
import {installLampShadow} from './lampShadow.ts';
import {loadResource} from './resourceLoading.ts';
import {LightMotion,type MotionMode,MOTION_PERIOD} from './lightMotion.ts';
import type {DynamicShadowMode} from './dynamicBenchmark.ts';

export async function createMovingLantern(scene:THREE.Scene){
  const url=new URL('./assets/moving-lantern.glb',document.baseURI);url.searchParams.set('v',__MOVING_LANTERN_REVISION__);
  const gltf=await loadResource(url.href,()=>new GLTFLoader().loadAsync(url.href)),group=gltf.scene;
  group.name='Travelling lantern';
  const glass=new THREE.MeshStandardNodeMaterial({name:'travelling frosted glass',color:'#ffd799',roughness:.3,emissive:'#ffe6b3',emissiveIntensity:6.5});
  const materials=new Set<THREE.Material>();
  group.traverse(o=>{if(o instanceof THREE.Mesh){
    if(Array.isArray(o.material))throw Error('Unexpected portable lantern material array');
    // A light source cannot shadow itself; the portable housing is also excluded
    // from the old lamps' static shadow cache. Street objects still cast normally.
    o.castShadow=false;o.receiveShadow=true;
    if(o.material.name==='traveller_glass'){o.material.dispose();o.material=glass;}
    materials.add(o.material);
  }});
  const makeLight=(name:string,shadow:boolean)=>{
    const light=new THREE.PointLight('#ffd197',15,9,2);light.name=name;light.castShadow=shadow;
    light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.08;light.shadow.camera.far=9;
    light.shadow.bias=-.0001;light.shadow.normalBias=.006;light.shadow.autoUpdate=false;light.visible=false;
    scene.add(light);return light;
  };
  const pcss=makeLight('Moving lantern PCSS reference',true),pcf=makeLight('Moving lantern PCF diagnostic',true),unshadowed=makeLight('Moving lantern unshadowed diagnostic',false);
  const position=uniform(pcss.position).setGroup(renderGroup);
  installLampShadow(pcss.shadow,{position:[0,0,0],positionNode:position,distance:9,compact:true}).setEnabled(true);
  const lights=new Map<DynamicShadowMode,THREE.PointLight>([['pcss',pcss],['pcf',pcf],['unshadowed',unshadowed]]);
  let shadowMode:DynamicShadowMode='pcss';
  const motion=new LightMotion();
  const current=()=>lights.get(shadowMode)??pcss;
  const visible=()=>{lights.forEach((light,mode)=>light.visible=mode===shadowMode&&motion.mode!=='off');group.visible=motion.mode!=='off';};
  const update=()=>{const pose=motion.pose();group.position.fromArray(pose);lights.forEach(light=>{
    if(light.position.x!==pose[0]||light.position.y!==pose[1]||light.position.z!==pose[2]){light.position.fromArray(pose);light.shadow.needsUpdate=true;}
  });};
  update();scene.add(group);visible();
  return {
    motion,get light(){return current();},get shadowMode(){return shadowMode;},
    installScreenLight:(light:THREE.PointLight)=>{lights.set('screen',light);scene.add(light);update();visible();},
    setShadowMode:(mode:DynamicShadowMode)=>{if(mode!=='off'&&!lights.has(mode))throw Error('Unavailable dynamic shadow mode: '+mode);shadowMode=mode;current().shadow.needsUpdate=true;visible();},
    invalidateShadow:()=>{if(shadowMode!=='off'&&current().castShadow)current().shadow.needsUpdate=true;},
    setMode:(mode:MotionMode)=>{motion.setMode(mode);visible();if(mode!=='off')current().shadow.needsUpdate=true;},
    tick:(nowMs:number)=>{motion.tick(nowMs);update();},
    seek:(seconds:number)=>{motion.seek(seconds);update();},
    snapshot:()=>({mode:motion.mode,seconds:motion.seconds,position:group.position.toArray(),periodSeconds:MOTION_PERIOD,intensity:current().intensity,range:current().distance,shadow:shadowMode,shadowMap:current().shadow.mapSize.toArray(),shadowNeedsUpdate:shadowMode!=='off'&&current().castShadow&&current().shadow.needsUpdate,assetRevision:__MOVING_LANTERN_REVISION__}),
    dispose:()=>{scene.remove(group);lights.forEach(light=>{scene.remove(light);light.dispose();});group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});materials.forEach(m=>m.dispose());},
  };
}
