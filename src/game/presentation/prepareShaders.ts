import {Camera,DirectionalLight,Mesh,Scene,SpotLight,Vector4,type Object3D,type WebGLRenderer} from 'three';

export async function yieldLoadingTask(signal:AbortSignal){
 signal.throwIfAborted();await new Promise<void>(resolve=>setTimeout(resolve,0));signal.throwIfAborted();
}
const MAPS=['map','alphaMap','aoMap','bumpMap','normalMap','displacementMap','emissiveMap','envMap','lightMap','metalnessMap','roughnessMap','specularMap','clearcoatMap','transmissionMap','gradientMap','matcap'];
/** Close to three's program cache key: meshes with the same key compile to the same program (hundreds of
 *  labels and signs, each with its own material, are one program). */
function programKey(mesh:Mesh){
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material],g=mesh.geometry;
 return [...materials.map(m=>{const r=m as unknown as Record<string,unknown>;
  return [m.type,m.customProgramCacheKey(),r.vertexShader,r.fragmentShader,JSON.stringify(r.defines??null),m.transparent,m.side,m.vertexColors,m.alphaTest>0,m.alphaHash,m.premultipliedAlpha,m.dithering,m.toneMapped,r.fog,r.flatShading,r.wireframe,...MAPS.map(k=>!!r[k])].join(',');}),
  'isInstancedMesh' in mesh,'isSkinnedMesh' in mesh,g.morphAttributes.position?.length??0,...Object.keys(g.attributes).map(k=>k+':'+g.getAttribute(k).itemSize)].join('|');
}
/** Shown now, or hidden for later under the same lights and asking to be warmed (`userData.prewarm`: the
 *  onboarding arrow, the first crack on a block). */
function warmable(object:Object3D){
 for(let o:Object3D|null=object;o;o=o.parent)if(!o.visible&&!o.userData.prewarm)return false;
 return true;
}
// Compile the real variants of everything visible, then force their first use. compileAsync alone cannot
// prevent stalls without KHR_parallel_shader_compile.
// Not only the first view: whatever is behind the camera compiled on the first turn instead, ten
// programs on the spawn (teleport pads, water, labels), each a hitch on Windows (report 2026-10-28).
// Draw just one loading-screen pixel on the default framebuffer: offscreen targets
// can change tone-mapping/output-space defines and warm the wrong shader variant.
// In play (a later world's scene, loaded on the trip there): `only` warms just the meshes under it, under the whole
// scene's lights, and `inFrame` runs each one-pixel draw inside the game's next drawn frame, before the world: drawn
// between frames, a frame the game skips would show the canvas cleared but for that pixel.
function addWarmLights(warm:Scene,source:Scene,withCaveLights:boolean){
 source.traverse(object=>{
  if(!('isLight' in object))return;
  const caveLight=object.userData.caveLight===true;
  if(caveLight?!withCaveLights:!warmable(object))return;
  const light=object.clone();
  light.visible=true;
  warm.add(light);
  if(light instanceof DirectionalLight||light instanceof SpotLight){light.target.updateMatrixWorld(true);warm.add(light.target);}
 });
}
export async function prepareShaders(renderer:WebGLRenderer,source:Scene,camera:Camera,signal:AbortSignal,onProgress:(done:number,total:number)=>void,
 {only=source,inFrame}:{only?:Object3D;inFrame?:(draw:()=>void)=>Promise<void>}={}){
 const started=performance.now(),warm=new Scene();
 warm.environment=source.environment;warm.environmentIntensity=source.environmentIntensity;warm.environmentRotation.copy(source.environmentRotation);warm.fog=source.fog;
 source.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const meshes:Mesh[]=[],seen=new Set<string>();
 let hasCaveLights=false;
 source.traverse(object=>{if(object.userData.caveLight===true)hasCaveLights=true;});
 only.traverse(object=>{
  if(!warmable(object)||!(object instanceof Mesh)||!camera.layers.test(object.layers))return;
  const material=Array.isArray(object.material)?object.material:[object.material];
  const key=[...material.map(m=>m.uuid),'isInstancedMesh' in object,object.geometry.morphAttributes.position?.length??0,...Object.keys(object.geometry.attributes).map(k=>k+':'+object.geometry.getAttribute(k).itemSize)].join('|');
  if(seen.has(key))return;seen.add(key);meshes.push(object);
 });
 const scissor=renderer.getScissor(new Vector4()),scissorTest=renderer.getScissorTest();
 const before=renderer.info.programs?.length??0,parallel=renderer.extensions.has('KHR_parallel_shader_compile');
 const previousError=renderer.debug.onShaderError;
 renderer.debug.onShaderError=(gl,program)=>{throw new Error('材质预热失败：'+gl.getProgramInfoLog(program));};
 const clones=meshes.map(object=>{const clone=object.clone(false);clone.matrixAutoUpdate=false;clone.matrix.copy(object.matrixWorld);clone.frustumCulled=false;return clone;});
 try{
  // Surface hides the cave point-light group; still compile that variant so walking into the shaft does not hitch.
  const passes=hasCaveLights?[false,true]:[false];
  const keys=new Set<string>(),first=parallel?clones:clones.filter(c=>{const k=programKey(c);if(keys.has(k))return false;keys.add(k);return true;});
  const batch=parallel?32:1,total=first.length*passes.length;
  onProgress(0,total);await yieldLoadingTask(signal);
  let done=0;
  for(const withCaveLights of passes){
   addWarmLights(warm,source,withCaveLights);
   if(parallel){
    warm.add(...clones);await renderer.compileAsync(warm,camera);signal.throwIfAborted();warm.remove(...clones);
   }
   // Linked in parallel, every object's first use (uniforms, textures) goes in batches. Without asynchronous
   // completion queries, don't queue every program then block on that entire driver queue: compile and use one
   // object per program between UI tasks.
   for(let i=0;i<first.length;i+=batch){
    const part=first.slice(i,i+batch);
    onProgress(done,total);await yieldLoadingTask(signal);warm.add(...part);
    try{
     if(!parallel){renderer.compile(warm,camera);await yieldLoadingTask(signal);}
     const draw=()=>{
      renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);
      try{renderer.render(warm,camera);}finally{renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);}
     };
     if(inFrame){await inFrame(draw);signal.throwIfAborted();}else draw();
    }
    finally{warm.remove(...part);}
    done+=part.length;
   }
   warm.clear();
  }
  onProgress(total,total);
 }finally{
  renderer.debug.onShaderError=previousError;renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);warm.clear();
  for(const clone of clones)if('isInstancedMesh' in clone && 'dispose' in clone)(clone as Mesh & {dispose():void}).dispose();
 }
 return {ms:performance.now()-started,objects:meshes.length,newPrograms:(renderer.info.programs?.length??0)-before,parallel};
}
