import * as THREE from 'three/webgpu';
import {pass,mrt,output,emissive,float,pmremTexture,normalViewGeometry,builtinAOContext,screenUV,vec4,nodeObject,Fn} from 'three/tsl';
import {ssao} from 'three/addons/tsl/display/SSAONode.js';
import {gaussianBlur} from 'three/addons/tsl/display/GaussianBlurNode.js';
import {DistrictHalo} from './districtHalo.ts';
import {createStreetEnvironment} from './streetEnvironment.ts';

import type {StreetLamp} from './streetModel.ts';
export type StreetLightMode='day'|'night';
export type StreetProbe='none'|'single-output'|'no-msaa'|'no-environment'|'single-sample-normals';
import type {DistrictPipeline,DistrictDiagnostic} from './districtVariants.ts';
export type {DistrictPipeline,DistrictDiagnostic} from './districtVariants.ts';
export type StreetRenderOptions={optimized:boolean;probe:StreetProbe;post:'reference'|'optimized'};
export function createDistrictLighting(renderer:THREE.Renderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,layout:StreetLamp[],glass:THREE.MeshStandardNodeMaterial[],windows:THREE.MeshStandardNodeMaterial,options:StreetRenderOptions,setBakedEnabled:(enabled:boolean)=>void,initialPipeline:DistrictPipeline){
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

  const sun=new THREE.DirectionalLight('#a8c6ff',.24);sun.position.set(30,40,5);sun.target.position.set(0,0,0);sun.castShadow=true;
  const shadow=sun.shadow;shadow.mapSize.set(4096,4096);shadow.camera.left=-43;shadow.camera.right=43;shadow.camera.top=43;shadow.camera.bottom=-43;shadow.camera.near=1;shadow.camera.far=130;shadow.normalBias=.008;shadow.bias=-.000035;shadow.radius=1.6;shadow.autoUpdate=false;shadow.needsUpdate=true;
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
  const packedOutput=mrt({output:Fn((builder:any)=>{
    const sign=builder.material.userData.haloSign??0;
    return vec4(output.rgb,(sign===0?float(1):emissive.r.mul(sign).add(1)) as any);
  })()});
  const compact=pass(scene,camera),compactDay=pass(scene,camera);
  compactDay.contextNode=builtinAOContext(ao.getTextureNode().sample(screenUV).r);
  for(const p of [compact,compactDay]){
    p.options.samples=4;p.setMRT(packedOutput);
    p.renderTarget.storeMultisampledColorBuffer=false;p.renderTarget.storeMultisampledDepthBuffer=false;p.renderTarget.storeMultisampledStencilBuffer=false;p.renderTarget.resolveDepthBuffer=false;p.renderTarget.resolveStencilBuffer=false;
  }
  const compactHalo=nodeObject(new DistrictHalo(compact.getTextureNode('output'))),compactDayHalo=nodeObject(new DistrictHalo(compactDay.getTextureNode('output')));
  const fusedHalo=nodeObject(new DistrictHalo(compact.getTextureNode('output'),true)),fusedDayHalo=nodeObject(new DistrictHalo(compactDay.getTextureNode('output'),true));
  const compactOutput=vec4(compact.rgb.add(compactHalo.rgb.mul(.28)),1),compactDayOutput=vec4(compactDay.rgb.add(compactDayHalo.rgb.mul(.28)),1);
  const fusedOutput=vec4(compact.rgb.add(fusedHalo.rgb.mul(.28)),1),fusedDayOutput=vec4(compactDay.rgb.add(fusedDayHalo.rgb.mul(.28)),1);
  const noHalo=vec4(compact.rgb,1),noHaloDay=vec4(compactDay.rgb,1);
  // Keep each post graph built across switches. Reassigning one pipeline's
  // outputNode used to rebuild its materials again after the benchmark ended.
  const pipelines=new Map<unknown,THREE.RenderPipeline>();
  let pipeline:THREE.RenderPipeline;
  if(!['reference','fused','static'].includes(initialPipeline))throw Error('Unknown district pipeline');
  let pipelineMode:DistrictPipeline=initialPipeline,diagnostic:DistrictDiagnostic='none';
  let mode:StreetLightMode='night',aoEnabled=true,shadowInvalidations=0;
  const updateOutput=()=>{
    const dayAO=mode==='day'&&aoEnabled;
    const next=pipelineMode==='reference'?(options.probe==='single-output'?(aoEnabled?shaded:withoutAO):(aoEnabled?glowing:glowingWithoutAO)):
      diagnostic==='no-halo'?(dayAO?noHaloDay:noHalo):pipelineMode==='fused'?(dayAO?fusedDayOutput:fusedOutput):(dayAO?compactDayOutput:compactOutput);
    let selected=pipelines.get(next);
    if(!selected){selected=new THREE.RenderPipeline(renderer);selected.outputNode=next;pipelines.set(next,selected);}
    pipeline=selected;
  };
  const applyDiagnostic=()=>{
    const environmentTexture=mode==='night'?nightEnvironment.texture:environment.texture;
    scene.environment=diagnostic==='no-environment'||options.probe==='no-environment'?null:environmentTexture;
    scene.environmentNode=scene.environment===null?null:compactEnvironment?.node??environmentNode;
    updateOutput();
  };
  const apply=()=>{
    const night=mode==='night';scene.environment=night?nightEnvironment.texture:environment.texture;environmentNode.value=scene.environment;compactEnvironment?.setTexture(scene.environment);
    scene.background=night?nightSky:sky;scene.backgroundIntensity=night?.12:day.background;scene.environmentIntensity=night?.095:day.environment;
    sun.position.set(night?30:-30,night?40:50,night?5:28);sun.color.set(night?'#a8c6ff':day.sunColor);sun.intensity=night?.24:day.sun;
    renderer.toneMappingExposure=night?1:day.exposure;
    setBakedEnabled(night);glass.forEach(m=>{m.emissiveIntensity=night?7.5:.08;});
    windows.emissiveIntensity=night?.32:0;shadow.needsUpdate=true;shadowInvalidations++;applyDiagnostic();
  };
  apply();
  return {
    profileTargets:new Map([[compact.renderTarget,'Lighting + baked visibility'],[compactDay.renderTarget,'Lighting + day AO'],[compactHalo.target,'Halo extraction + horizontal'],[compactDayHalo.target,'Halo extraction + horizontal'],[compactHalo.verticalTarget,'Halo vertical half resolution'],[compactDayHalo.verticalTarget,'Halo vertical half resolution'],[fusedHalo.target,'Halo extraction + horizontal'],[fusedDayHalo.target,'Halo extraction + horizontal'],[prepass.renderTarget,'Geometry normals'],[shaded.renderTarget,'Lighting + baked lamps'],[withoutAO.renderTarget,'Lighting + baked lamps']]),
    render:()=>pipeline.render(),
    setPipeline:(value:DistrictPipeline)=>{if(!['reference','fused','static'].includes(value))throw Error('Unknown district pipeline');pipelineMode=value;updateOutput();},
    setDiagnostic:(value:DistrictDiagnostic)=>{if(!['none','no-halo','no-environment','no-shadow','baked-material'].includes(value))throw Error('Unknown district diagnostic');diagnostic=value;applyDiagnostic();},
    setMode:(value:StreetLightMode)=>{if(value!=='day'&&value!=='night')throw Error('Unknown street light mode');if(value===mode)return;mode=value;apply();},
    setAO:(value:boolean)=>{aoEnabled=value;updateOutput();},
    snapshot:()=>({mode,pipeline:pipelineMode,materialDiagnostic:diagnostic,contactAO:pipelineMode!=='reference'&&mode==='night'?'lamp visibility already baked':'screen SSAO',screenAO:aoEnabled&&(pipelineMode==='reference'||mode==='day'),steadyPasses:pipelineMode==='reference'?(aoEnabled?6:2)+(options.probe==='single-output'?0:2):(mode==='day'&&aoEnabled?4:0)+(diagnostic==='no-halo'?2:pipelineMode==='fused'?3:4),optimization:'shared baked lamp diffuse + real-time sky/sun/specular',postProcessing:options.post,diagnostic:options.probe,shadowMode:'combined static lamp irradiance',ao:aoEnabled,shadowInvalidations,environmentIntensity:scene.environmentIntensity,exposure:renderer.toneMappingExposure,sun:{shadowSampling:diagnostic!=='no-shadow'&&diagnostic!=='baked-material',intensity:sun.intensity,color:'#'+sun.color.getHexString(),shadowNeedsUpdate:shadow.needsUpdate,mapSize:shadow.mapSize.toArray()},lamps:layout.map(l=>({id:l.id,position:l.position,intensity:mode==='night'?l.intensity:0,visible:mode==='night',baked:true,shadowNeedsUpdate:false})),runtimePointLights:0,halo:{encoding:pipelineMode!=='reference'?'signed HDR alpha, two emission colors':'RGB emission MRT',source:'depth-tested emissive',strength:.28,sigma:3,resolutionScale:.5,verticalResolutionScale:pipelineMode==='fused'?1:.5,enabled:diagnostic!=='no-halo'}}),
    dispose:()=>{normalMaterial.dispose();pipelines.forEach(p=>p.dispose());compact.dispose();compactDay.dispose();compactHalo.dispose();compactDayHalo.dispose();fusedHalo.dispose();fusedDayHalo.dispose();compactEnvironment?.dispose();environmentNode.dispose();prepass.dispose();shaded.dispose();withoutAO.dispose();halo?.dispose();haloWithoutAO?.dispose();ao.dispose();sun.dispose();environment.dispose();nightEnvironment.dispose();sky.dispose();nightSky.dispose();},
  };
}
