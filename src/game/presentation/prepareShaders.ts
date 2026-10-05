import {Camera,DirectionalLight,Frustum,Matrix4,Mesh,Scene,SpotLight,Vector4,type WebGLRenderer} from 'three';

export async function yieldLoadingTask(signal:AbortSignal){
 signal.throwIfAborted();await new Promise<void>(resolve=>setTimeout(resolve,0));signal.throwIfAborted();
}
// Compile real first-view variants, then force their first use one representative
// at a time. compileAsync alone cannot prevent stalls without KHR_parallel_shader_compile.
// Draw just one loading-screen pixel on the default framebuffer: offscreen targets
// can change tone-mapping/output-space defines and warm the wrong shader variant.
export async function prepareShaders(renderer:WebGLRenderer,source:Scene,camera:Camera,signal:AbortSignal,onProgress:(done:number,total:number)=>void){
 const started=performance.now(),warm=new Scene();
 warm.environment=source.environment;warm.environmentIntensity=source.environmentIntensity;warm.environmentRotation.copy(source.environmentRotation);warm.fog=source.fog;
 source.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const meshes:Mesh[]=[],seen=new Set<string>();
 source.traverseVisible(object=>{
  if('isLight' in object){const light=object.clone();warm.add(light);if(light instanceof DirectionalLight||light instanceof SpotLight){light.target.updateMatrixWorld(true);warm.add(light.target);}return;}
  if(!(object instanceof Mesh)||!camera.layers.test(object.layers)||(object.frustumCulled&&!frustum.intersectsObject(object)))return;
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
  onProgress(0,clones.length);await yieldLoadingTask(signal);
  if(parallel){
   warm.add(...clones);await renderer.compileAsync(warm,camera);signal.throwIfAborted();warm.remove(...clones);
  }
  for(const [i,clone] of clones.entries()){
   onProgress(i,clones.length);await yieldLoadingTask(signal);warm.add(clone);
   try{
    // Without asynchronous completion queries, don't queue every program then
    // block on that entire driver queue. Submit/use one variant between UI tasks.
    if(!parallel){renderer.compile(warm,camera);await yieldLoadingTask(signal);}
    renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);renderer.render(warm,camera);
   }
   finally{warm.remove(clone);}
  }
  onProgress(clones.length,clones.length);
 }finally{
  renderer.debug.onShaderError=previousError;renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);warm.clear();
  for(const clone of clones)if('isInstancedMesh' in clone && 'dispose' in clone)(clone as Mesh & {dispose():void}).dispose();
 }
 return {ms:performance.now()-started,objects:meshes.length,newPrograms:(renderer.info.programs?.length??0)-before,parallel};
}
