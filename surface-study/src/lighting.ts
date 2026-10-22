import * as THREE from 'three/webgpu';
import { pass, mrt, normalView, builtinAOContext, screenUV } from 'three/tsl';
import { ssao } from 'three/addons/tsl/display/SSAONode.js';

export function createLighting(renderer: THREE.Renderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, diffuseMatte=false) {
  // Broad sky radiance contains no sharp sun disc. The analytic sun is the sole
  // directional light, so baked IBL cannot add a second direction of shadows.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d')!;const gradient=ctx.createLinearGradient(0,0,0,256);
  for(const [t,c] of [[0,'#338dd4'],[.28,'#75c9ed'],[.48,'#c8ebf7'],[.55,'#b9d2ac'],[1,'#446a69']] as const)gradient.addColorStop(t,c);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);
  const sky=new THREE.CanvasTexture(canvas);sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;
  scene.background=sky;scene.backgroundIntensity=1;scene.fog=new THREE.FogExp2('#b8dcf0',.0028);
  const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromEquirectangular(sky);
  scene.environment=env.texture;scene.environmentIntensity=.35;pmrem.dispose();
  // Lambert matte surfaces use this sky/ground fill instead of sampled PBR IBL.
  const fillIntensity=diffuseMatte?.85:.55;
  const hemisphere=new THREE.HemisphereLight('#b5daff','#667b93',fillIntensity);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight('#fff5de',3.0);sun.position.set(-35,60,35);sun.target.position.set(0,0,0);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-60;sun.shadow.camera.right=60;sun.shadow.camera.top=58;sun.shadow.camera.bottom=-58;sun.shadow.camera.near=5;sun.shadow.camera.far=170;
  sun.shadow.normalBias=.055;sun.shadow.bias=-.00015;sun.shadow.radius=2;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
  scene.add(sun,sun.target);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=THREE.SRGBColorSpace;
  const prePass=pass(scene,camera);prePass.transparent=false;prePass.setMRT(mrt({output:normalView}));
  const ao=ssao(prePass.getTextureNode('depth'),prePass.getTextureNode('output'),camera);ao.resolutionScale=.5;ao.radius.value=.85;ao.intensity.value=.8;ao.samples.value=12;
  const scenePass=pass(scene,camera);scenePass.options.samples=4;scenePass.contextNode=builtinAOContext(ao.getTextureNode().sample(screenUV).r);
  const pipeline=new THREE.RenderPipeline(renderer);pipeline.outputNode=scenePass;
  let mode:'day'|'golden'='day',aoEnabled=false,shadowUpdates=1;
  const toneMappings={neutral:THREE.NeutralToneMapping,aces:THREE.ACESFilmicToneMapping,linear:THREE.LinearToneMapping};
  let tone:'neutral'|'aces'|'linear'='neutral';
  return {
    render:()=>{if(aoEnabled)pipeline.render();else renderer.render(scene,camera);},
    setAO:(value:boolean)=>{aoEnabled=value;},
    setTone:(value:typeof tone)=>{if(!(value in toneMappings))throw Error('Unknown tone mapping');tone=value;renderer.toneMapping=toneMappings[value];},
    setMode:(value:'day'|'golden')=>{mode=value;if(value==='golden'){sun.position.set(-48,33,40);sun.color.set('#ffe2ac');sun.intensity=3.4;renderer.toneMappingExposure=.95;}else{sun.position.set(-35,60,35);sun.color.set('#fff5de');sun.intensity=3.0;renderer.toneMappingExposure=1;}sun.shadow.needsUpdate=true;shadowUpdates++;},
    snapshot:()=>({mode,tone,ao:aoEnabled,shadowInvalidations:shadowUpdates,shadowNeedsUpdate:sun.shadow.needsUpdate,shadowMapSize:sun.shadow.mapSize.toArray(),environmentBuilds:1,environmentIntensity:scene.environmentIntensity,fillIntensity}),
    dispose:()=>{pipeline.dispose();prePass.dispose();scenePass.dispose();ao.dispose();env.dispose();sky.dispose();},
  };
}
