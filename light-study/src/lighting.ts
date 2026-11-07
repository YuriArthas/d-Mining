import * as THREE from 'three/webgpu';
import {pass,mrt,output,emissive,float,vec3,positionWorld,materialEmissive,normalViewGeometry,builtinAOContext,screenUV} from 'three/tsl';
import {ssao} from 'three/addons/tsl/display/SSAONode.js';
import {gaussianBlur} from 'three/addons/tsl/display/GaussianBlurNode.js';
import {installLampShadow,lampShadowSettings} from './lampShadow.ts';

export type LightMode='day'|'golden'|'night';
export type LightingVariant='baseline'|'focused';

/** Frosted panes reveal a compact bright core, with warmer dimmer edges. */
export function createFocusedLampGlass(){
  const glass=new THREE.MeshStandardNodeMaterial({name:'focused lamp core',color:'#ffe5ac',roughness:.28,emissive:'#ffe8bc',emissiveIntensity:7.5});
  // The authored fixture is static in world metres. On each vertical pane,
  // the smaller horizontal offset measures distance from that face's centre.
  const offset=positionWorld.sub(vec3(-2.65,2.75,-.45));
  const across=offset.x.abs().min(offset.z.abs()).div(.105),vertical=offset.y.div(.14);
  const core=across.mul(across).add(vertical.mul(vertical)).negate().exp();
  glass.emissiveNode=materialEmissive.mul(core.mul(2).add(.06));
  return glass;
}

export function createLighting(renderer:THREE.Renderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,lampGlass:THREE.MeshStandardMaterial,focusedGlass:THREE.MeshStandardNodeMaterial){
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
  const sky=makeSky([{t:0,c:new THREE.Color('#a79a7f').multiplyScalar(.45)},{t:.43,c:new THREE.Color('#b9b9aa').multiplyScalar(.55)},{t:.51,c:new THREE.Color('#d3e5ef').multiplyScalar(1.2)},{t:.72,c:new THREE.Color('#b8d8f3')},{t:1,c:new THREE.Color('#89b4e6').multiplyScalar(.9)}]);
  const nightSky=makeSky([{t:0,c:new THREE.Color('#29334a')},{t:.43,c:new THREE.Color('#43516c')},{t:.51,c:new THREE.Color('#7f94ba')},{t:.72,c:new THREE.Color('#6b82b2')},{t:1,c:new THREE.Color('#465d91')}]);
  // Keep both prefiltered skies: mode switches never rebuild PMREM.
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(sky),nightEnvironment=pmrem.fromEquirectangular(nightSky);pmrem.dispose();
  scene.environment=environment.texture;scene.environmentIntensity=.50;scene.background=sky;scene.backgroundIntensity=.85;
  const sun=new THREE.DirectionalLight('#fff0d9',3.6);sun.position.set(-7.5,10,9);sun.target.position.set(0,1,0);sun.castShadow=true;
  const shadow=sun.shadow;shadow.mapSize.set(2048,2048);shadow.camera.left=-10;shadow.camera.right=10;shadow.camera.top=9;shadow.camera.bottom=-9;shadow.camera.near=1;shadow.camera.far=40;shadow.normalBias=.008;shadow.bias=-.000035;shadow.radius=1.6;shadow.autoUpdate=false;shadow.needsUpdate=true;
  const lamp=new THREE.PointLight('#ffbc73',0,4,2);lamp.position.set(.9,2.73,-1.74);lamp.castShadow=true;
  const lampShadow=lamp.shadow;lampShadow.mapSize.set(1024,1024);lampShadow.camera.near=.08;lampShadow.camera.far=9;lampShadow.bias=-.0001;lampShadow.normalBias=.006;lampShadow.radius=2;lampShadow.autoUpdate=false;lampShadow.needsUpdate=true;
  lampShadow.camera.layers.set(1);
  const softLampShadow=installLampShadow(lampShadow);
  const daytimeEmission=lampGlass.emissiveIntensity,originalEmissionColor=lampGlass.emissive.clone();
  scene.add(sun,sun.target,lamp);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=.95;renderer.outputColorSpace=THREE.SRGBColorSpace;
  // Contact-only AO uses geometry normals. Material microrelief belongs to the
  // physically shaded pass, not to the depth-based occlusion estimate.
  const prepass=pass(scene,camera);prepass.transparent=false;prepass.setMRT(mrt({output:normalViewGeometry}));
  const ao=ssao(prepass.getTextureNode('depth'),prepass.getTextureNode('output'),camera);ao.resolutionScale=.5;ao.radius.value=.42;ao.intensity.value=.55;ao.samples.value=12;
  const shaded=pass(scene,camera);shaded.options.samples=4;shaded.contextNode=builtinAOContext(ao.getTextureNode().sample(screenUV).r);
  // Only visible emissive fragments feed a compact halo. The wall's depth
  // occludes the source before blur; bright paving and plaster never glow.
  shaded.setMRT(mrt({output,emissive}));
  const withoutAO=pass(scene,camera);withoutAO.options.samples=4;withoutAO.setMRT(mrt({output,emissive}));
  const halo=gaussianBlur(shaded.getTextureNode('emissive'),float(1.5),3,{resolutionScale:.5});
  const haloWithoutAO=gaussianBlur(withoutAO.getTextureNode('emissive'),float(1.5),3,{resolutionScale:.5});
  const glowing=shaded.add(halo.mul(.28)),glowingWithoutAO=withoutAO.add(haloWithoutAO.mul(.28));
  const pipeline=new THREE.RenderPipeline(renderer);pipeline.outputNode=shaded;
  let mode:LightMode='day',variant:LightingVariant='baseline',aoEnabled=true,softShadows=true,shadowInvalidations=1;
  const focusedNight=()=>mode==='night'&&variant==='focused';
  const updateOutput=()=>{
    const next=focusedNight()?(aoEnabled?glowing:glowingWithoutAO):shaded;
    if(pipeline.outputNode!==next){pipeline.outputNode=next;pipeline.needsUpdate=true;}
  };
  const apply=()=>{
    const night=mode==='night',focused=night&&variant==='focused';
    softLampShadow.setEnabled(focused&&softShadows);
    scene.environment=night?nightEnvironment.texture:environment.texture;
    scene.background=night?nightSky:sky;scene.backgroundIntensity=night?.12:.85;
    lamp.position.fromArray(focused?[-2.65,2.75,-.45]:[.9,2.73,-1.74]);
    lampGlass.emissive.copy(originalEmissionColor);
    lampGlass.emissiveIntensity=night?2.6:daytimeEmission;
    if(focused){sun.position.set(6.5,9,3.5);sun.color.set('#a8c6ff');sun.intensity=.24;scene.environmentIntensity=.095;lamp.color.set('#ffcb8b');lamp.intensity=18;lamp.distance=12;renderer.toneMappingExposure=1;}
    else if(night){sun.position.set(6.5,9,3.5);sun.color.set('#a8c6ff');sun.intensity=.95;scene.environmentIntensity=.35;lamp.color.set('#ffd09a');lamp.intensity=4.5;lamp.distance=9;renderer.toneMappingExposure=1;}
    else if(mode==='golden'){sun.position.set(-7.5,6.2,9);sun.color.set('#ffd3ac');sun.intensity=3.8;scene.environmentIntensity=.44;lamp.color.set('#ffbc73');lamp.intensity=.12;lamp.distance=4;renderer.toneMappingExposure=1;}
    else{sun.position.set(-7.5,10,9);sun.color.set('#fff0d9');sun.intensity=3.6;scene.environmentIntensity=.50;lamp.color.set('#ffbc73');lamp.intensity=0;lamp.distance=4;renderer.toneMappingExposure=.95;}
    // Light placement and fixture visibility both change. Refresh once, then
    // reuse both shadow maps during camera movement and material comparisons.
    lampShadow.needsUpdate=true;shadow.needsUpdate=true;shadowInvalidations++;updateOutput();
  };
  return {
    render:()=>{if(aoEnabled||focusedNight())pipeline.render();else renderer.render(scene,camera);},
    setMode:(value:LightMode)=>{if(value!=='day'&&value!=='golden'&&value!=='night')throw Error('Unknown light mode');if(value===mode)return;mode=value;apply();},
    setVariant:(value:LightingVariant)=>{if(value!=='baseline'&&value!=='focused')throw Error('Unknown lighting variant');if(value===variant)return;variant=value;apply();},
    setAO:(value:boolean)=>{aoEnabled=value;updateOutput();},
    setSoftShadows:(value:boolean)=>{softShadows=value;softLampShadow.setEnabled(focusedNight()&&softShadows);},
    snapshot:()=>({mode,variant,ao:aoEnabled,sun:{position:sun.position.toArray(),intensity:sun.intensity,color:sun.color.getHexString()},lamp:{position:lamp.position.toArray(),intensity:lamp.intensity,color:lamp.color.getHexString(),distance:lamp.distance,shadowNeedsUpdate:lampShadow.needsUpdate,shadowMapSize:lampShadow.mapSize.toArray(),filter:focusedNight()&&softShadows?'contact-hardening PCSS':'PCF',sourceRadius:focusedNight()&&softShadows?lampShadowSettings.sourceRadius:0,blockerSamples:focusedNight()&&softShadows?lampShadowSettings.blockerSamples:0,filterSamples:focusedNight()&&softShadows?lampShadowSettings.filterSamples:5},lampEmissiveIntensity:(focusedNight()?focusedGlass:lampGlass).emissiveIntensity,lampEmissiveColor:(focusedNight()?focusedGlass:lampGlass).emissive.getHexString(),lampCore:{enabled:focusedNight(),profile:"analytic frosted pane",edgeMultiplier:.06,centreMultiplier:2.06},halo:{enabled:focusedNight(),source:'depth-tested emissive',strength:.28,sigma:3,resolutionScale:.5},environmentIntensity:scene.environmentIntensity,backgroundIntensity:scene.backgroundIntensity,environmentBuilds:2,tone:'neutral',exposure:renderer.toneMappingExposure,shadowMapSize:shadow.mapSize.toArray(),shadowNeedsUpdate:shadow.needsUpdate,shadowInvalidations,normalBias:shadow.normalBias}),
    dispose:()=>{pipeline.dispose();prepass.dispose();shaded.dispose();withoutAO.dispose();halo.dispose();haloWithoutAO.dispose();ao.dispose();sun.dispose();lamp.dispose();environment.dispose();nightEnvironment.dispose();sky.dispose();nightSky.dispose();},
  };
}
