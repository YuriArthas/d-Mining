import * as THREE from 'three/webgpu';
import {pass,mrt,output,emissive,float,pmremTexture,normalViewGeometry,builtinAOContext,screenUV,vec4} from 'three/tsl';
import {ssao} from 'three/addons/tsl/display/SSAONode.js';
import {gaussianBlur} from 'three/addons/tsl/display/GaussianBlurNode.js';
import {installLampShadow,lampShadowSettings} from './lampShadow.ts';
import {loadStaticShadow} from './staticShadow.ts';
import {bakeStaticShadow} from './staticShadowBake.ts';
import {createStreetEnvironment} from './streetEnvironment.ts';
import {ScreenShadow} from './screenShadow.ts';

import type {StreetLamp} from './streetModel.ts';
export type StreetLightMode='day'|'night';
export type StreetProbe='none'|'single-output'|'no-msaa'|'no-environment'|'single-sample-normals';
export type StreetRenderOptions={optimized:boolean;probe:StreetProbe;post:'reference'|'optimized'};
export function createStreetLighting(renderer:THREE.Renderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,layout:StreetLamp[],glass:THREE.MeshStandardNodeMaterial[],windows:THREE.MeshStandardMaterial,options:StreetRenderOptions){
  const Lamp=THREE.PointLight;
  // A broad linear-radiance sky, with no second baked sun. The lower hemisphere
  // represents warm ground bounce; the analytic sun alone supplies direction.
  const makeSky=(stops:{t:number;c:THREE.Color}[])=>{
  const width=256,height=128,data=new Uint16Array(width*height*4);
  for(let y=0;y<height;y++){
    const t=y/(height-1);let i=0;while(i<stops.length-2&&t>stops[i+1].t)i++;
    const a=stops[i],b=stops[i+1],c=a.c.clone().lerp(b.c,(t-a.t)/(b.t-a.t));
    for(let x=0;x<width;x++){const k=(y*width+x)*4;data[k]=THREE.DataUtils.toHalfFloat(c.r);data[k+1]=THREE.DataUtils.toHalfFloat(c.g);data[k+2]=THREE.DataUtils.toHalfFloat(c.b);data[k+3]=THREE.DataUtils.toHalfFloat(1);}
  }
  const sky=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.HalfFloatType);sky.mapping=THREE.EquirectangularReflectionMapping;sky.colorSpace=THREE.LinearSRGBColorSpace;sky.minFilter=sky.magFilter=THREE.LinearFilter;sky.needsUpdate=true;
  return sky;
  };
  // Day shadows receive a luminous blue sky and warm paving bounce. Keep the
  // lower hemisphere bright enough for vertical walls and deep eaves; exposure
  // alone would lift the sunlit paving without correcting that imbalance.
  const day={environment:1.25,background:.85,sun:6,exposure:1.1,sunColor:'#ffe4bd'};
  const sky=makeSky([{t:0,c:new THREE.Color('#d8c4a2').multiplyScalar(.85)},{t:.43,c:new THREE.Color('#e5d7bc').multiplyScalar(1.1)},{t:.51,c:new THREE.Color('#e6f2ff').multiplyScalar(1.35)},{t:.72,c:new THREE.Color('#b5d8ff').multiplyScalar(1.1)},{t:1,c:new THREE.Color('#87baff').multiplyScalar(.95)}]);
  const nightSky=makeSky([{t:0,c:new THREE.Color('#29334a')},{t:.43,c:new THREE.Color('#43516c')},{t:.51,c:new THREE.Color('#7f94ba')},{t:.72,c:new THREE.Color('#6b82b2')},{t:1,c:new THREE.Color('#465d91')}]);
  // Keep both prefiltered skies: mode switches never rebuild PMREM.
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(sky),nightEnvironment=pmrem.fromEquirectangular(nightSky);pmrem.dispose();
  // Keep one environment node/binding: swapping the scene's texture directly
  // otherwise builds another full three-light shader family on every new sky.
  const environmentNode=pmremTexture(environment.texture);
  const compactEnvironment=options.optimized?createStreetEnvironment(environment.texture):null;
  scene.environmentNode=compactEnvironment?.node??environmentNode;
  scene.environment=environment.texture;scene.environmentIntensity=day.environment;scene.background=sky;scene.backgroundIntensity=day.background;

  const sun=new THREE.DirectionalLight('#a8c6ff',.24);sun.position.set(10,18,2);sun.target.position.set(0,0,-7);sun.castShadow=true;
  const shadow=sun.shadow;shadow.mapSize.set(2048,2048);shadow.camera.left=-23;shadow.camera.right=23;shadow.camera.top=23;shadow.camera.bottom=-23;shadow.camera.near=1;shadow.camera.far=70;shadow.normalBias=.008;shadow.bias=-.000035;shadow.radius=1.6;shadow.autoUpdate=false;shadow.needsUpdate=true;
  const lamps=layout.map(l=>{
    const lamp=new Lamp('#ffcb8b',l.intensity,l.distance,2);lamp.position.fromArray(l.position);lamp.castShadow=true;
    const s=lamp.shadow;s.mapSize.set(1024,1024);s.camera.near=.08;s.camera.far=l.distance;s.camera.layers.set(l.id+1);s.bias=-.0001;s.normalBias=.006;s.radius=2;s.autoUpdate=false;s.needsUpdate=true;
    const soft=installLampShadow(s,{...l,compact:true});soft.setEnabled(true);scene.add(lamp);return {lamp,soft};
  });
  scene.add(sun,sun.target);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=THREE.SRGBColorSpace;
  // Contact-only AO uses geometry normals. Material microrelief belongs to the
  // physically shaded pass, not to the depth-based occlusion estimate.
  const prepass=pass(scene,camera);prepass.transparent=false;prepass.setMRT(mrt({output:normalViewGeometry}));
  // AO reads one depth sample and runs at half resolution; MSAA color resolve
  // here multiplies storage/raster work without antialiasing the final image.
  // Keep the actual shaded image at 4x MSAA.
  if(options.optimized||options.probe==='single-sample-normals'||options.probe==='no-msaa')prepass.options.samples=0;
  // Geometry-only prepass cannot depend on the light's screen visibility.
  // It also avoids compiling every PBR light variant just to obtain normals.
  const normalMaterial=new THREE.NodeMaterial();normalMaterial.fragmentNode=vec4(normalViewGeometry,1);normalMaterial.name='Street geometry normals';prepass.overrideMaterial=normalMaterial;
  const screenShadow=new ScreenShadow(scene,camera,prepass.getTextureNode('depth'),prepass.getTextureNode('output'));
  const ao=ssao(prepass.getTextureNode('depth'),prepass.getTextureNode('output'),camera);ao.resolutionScale=.5;ao.radius.value=.42;ao.intensity.value=.55;ao.samples.value=12;
  const shaded=pass(scene,camera);shaded.options.samples=4;shaded.contextNode=builtinAOContext(ao.getTextureNode().sample(screenUV).r);
  // Only visible emissive fragments feed a compact halo. The wall's depth
  // occludes the source before blur; bright paving and plaster never glow.
  const sceneOutputs=()=>options.probe==='single-output'?mrt({output}):mrt({output,emissive});
  shaded.setMRT(sceneOutputs());
  const withoutAO=pass(scene,camera);withoutAO.options.samples=4;withoutAO.setMRT(sceneOutputs());
  if(options.post==='optimized')for(const p of [shaded,withoutAO]){
    // Later passes sample resolved color/emission only. Keep 4x MSAA rasterization,
    // but discard its per-sample attachments once color has been resolved.
    p.renderTarget.storeMultisampledColorBuffer=false;
    p.renderTarget.storeMultisampledDepthBuffer=false;
    p.renderTarget.storeMultisampledStencilBuffer=false;
    p.renderTarget.resolveDepthBuffer=false;
    p.renderTarget.resolveStencilBuffer=false;
  }
  if(options.probe==='no-msaa'){shaded.options.samples=0;withoutAO.options.samples=0;}
  // A single-output diagnostic must never allocate the unused attachment;
  // changing MRT alone would leave PassNode's requested texture resident.
  const halo=options.probe==='single-output'?null:gaussianBlur(shaded.getTextureNode('emissive'),float(1.5),3,{resolutionScale:.5});
  const haloWithoutAO=options.probe==='single-output'?null:gaussianBlur(withoutAO.getTextureNode('emissive'),float(1.5),3,{resolutionScale:.5});
  const glowing=halo?shaded.add(halo.mul(.28)):shaded,glowingWithoutAO=haloWithoutAO?withoutAO.add(haloWithoutAO.mul(.28)):withoutAO;
  const pipeline=new THREE.RenderPipeline(renderer);pipeline.outputNode=shaded;

  let cache:Awaited<ReturnType<typeof loadStaticShadow>>|null=null;
  let mode:StreetLightMode='night',aoEnabled=true,softShadows=true,shadowInvalidations=0;
  const updateOutput=()=>{const next=options.probe==='single-output'?(aoEnabled?shaded:withoutAO):(aoEnabled?glowing:glowingWithoutAO);if(pipeline.outputNode!==next){pipeline.outputNode=next;pipeline.needsUpdate=true;}};
  const apply=()=>{
    const night=mode==='night';scene.environment=night?nightEnvironment.texture:environment.texture;environmentNode.value=scene.environment;compactEnvironment?.setTexture(scene.environment);
    scene.background=night?nightSky:sky;scene.backgroundIntensity=night?.12:day.background;scene.environmentIntensity=night?.095:day.environment;
    if(options.probe==='no-environment'){scene.environment=null;scene.environmentNode=null;}
    sun.position.set(night?10:-12,night?18:24,night?2:12);sun.color.set(night?'#a8c6ff':day.sunColor);sun.intensity=night?.24:day.sun;
    renderer.toneMappingExposure=night?1:day.exposure;
    lamps.forEach(({lamp,soft},i)=>{lamp.intensity=night?layout[i].intensity:0;lamp.visible=!options.optimized||night;soft.setEnabled(night&&softShadows);lamp.shadow.needsUpdate=true;glass[i].emissiveIntensity=night?7.5:.08;});
    windows.emissiveIntensity=night?.32:0;shadow.needsUpdate=true;shadowInvalidations++;updateOutput();
  };
  apply();
  return {
    screenShadow,
    useStaticShadow:async()=>{cache=await loadStaticShadow();cache.install(lamps.map(l=>l.lamp));},
    bake:(source:THREE.Group)=>bakeStaticShadow(renderer,source,lamps.map(l=>l.lamp)),
    profileTargets:new Map([[prepass.renderTarget,'Geometry normals'],[shaded.renderTarget,'Lighting + shadows'],[withoutAO.renderTarget,'Lighting + shadows'],[screenShadow.raw,'Moving shadow filtering'],[screenShadow.resolved,'Moving shadow reconstruction']]),
    render:()=>pipeline.render(),
    setMode:(value:StreetLightMode)=>{if(value!=='day'&&value!=='night')throw Error('Unknown street light mode');if(value===mode)return;mode=value;apply();},
    setAO:(value:boolean)=>{aoEnabled=value;updateOutput();},
    setSoftShadows:(value:boolean)=>{if(cache)throw Error('Soft/hard comparison requires ?shadows=live');softShadows=value;lamps.forEach(l=>l.soft.setEnabled(mode==='night'&&value));},
    snapshot:()=>({mode,dynamicShadow:screenShadow.snapshot(),optimization:options.optimized?'specialized PMREM + single-sample AO normals + day light pruning':'reference',postProcessing:options.post,diagnostic:options.probe,targets:[prepass,shaded,withoutAO].map(p=>({name:p===prepass?'Geometry normals':p===shaded?'Lighting + shadows':'Lighting without AO',width:p.renderTarget.width,height:p.renderTarget.height,samples:p.renderTarget.samples,storeMultisampledColor:p.renderTarget.storeMultisampledColorBuffer,storeMultisampledDepth:p.renderTarget.storeMultisampledDepthBuffer,resolveDepth:p.renderTarget.resolveDepthBuffer,textures:p.renderTarget.textures.map(t=>({name:t.name,type:t.type,format:t.format}))})),shadowMode:cache?'static visibility atlas':'live PCSS',ao:aoEnabled,softShadows,shadowInvalidations,environmentIntensity:scene.environmentIntensity,environmentBuilds:2,stableEnvironmentBinding:true,exposure:renderer.toneMappingExposure,sun:{intensity:sun.intensity,color:'#'+sun.color.getHexString(),shadowNeedsUpdate:shadow.needsUpdate,mapSize:shadow.mapSize.toArray()},lamps:lamps.map(({lamp},i)=>({id:i,position:lamp.position.toArray(),intensity:lamp.intensity,visible:lamp.visible,distance:lamp.distance,filter:cache?'cached static visibility; live PCSS on surrounding ground':softShadows&&mode==='night'?'contact-hardening PCSS':'PCF',...lampShadowSettings,shadowNeedsUpdate:lamp.shadow.needsUpdate,mapSize:lamp.shadow.mapSize.toArray(),rangeEarlyOut:true,samplingLoop:true})),halo:{source:'depth-tested emissive',strength:.28,sigma:3,resolutionScale:.5}}),
    dispose:()=>{screenShadow.dispose();normalMaterial.dispose();cache?.dispose();pipeline.dispose();compactEnvironment?.dispose();environmentNode.dispose();prepass.dispose();shaded.dispose();withoutAO.dispose();halo?.dispose();haloWithoutAO?.dispose();ao.dispose();sun.dispose();lamps.forEach(l=>l.lamp.dispose());environment.dispose();nightEnvironment.dispose();sky.dispose();nightSky.dispose();},
  };
}
