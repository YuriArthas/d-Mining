import {Matrix4,PlaneGeometry,ShaderMaterial,Vector2,Vector3,Vector4,type Camera,type Mesh,type Scene,type WebGLRenderer} from 'three';
import {reflectionScissor} from './reflectionScissor.ts';
import {renderProfiler} from './RenderProfiler.ts';
import {Reflector} from 'three/addons/objects/Reflector.js';

// The two coplanar ponds share one clipped reflection, captured only when visible.
export class PondReflection {
 readonly mirror:Reflector;
 readonly projection={value:new Matrix4()};
 readonly texture;
 readonly enabled={value:1};
 readonly stats={enabled:true,captures:0,lastFrame:-1,width:1,height:1,estimatedTargetBytes:12,scissorPixels:1,scissorFraction:1,maxCapturesPerFrame:0,disposed:false};
 private capturing=false;
 private readonly size=new Vector2();
 private readonly inverse=new Matrix4();
 private readonly cameraPosition=new Vector3();
 private readonly y:number;
 constructor(y:number){
  this.y=y;
  this.mirror=new Reflector(new PlaneGeometry(1,1),{textureWidth:1,textureHeight:1,multisample:0,clipBias:.0002});
  this.mirror.rotation.x=-Math.PI/2;this.mirror.position.y=y;this.mirror.updateMatrixWorld(true);
  this.texture={value:this.mirror.getRenderTarget().texture};
 }
 capture(renderer:WebGLRenderer,scene:Scene,camera:Camera,surfaces:readonly Mesh[]){
  if(this.capturing||this.stats.disposed||camera.userData.pondReflection)return;
  const profiler=renderProfiler(renderer);
  this.stats.enabled=profiler?.reflectionMode!=='off';this.enabled.value=this.stats.enabled?1:0;
  if(!this.stats.enabled)return;
  this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  if(this.cameraPosition.y<=this.y)return;
  if(profiler?.reflectionMode==='frozen'&&this.stats.captures>0)return;
  const frame=renderer.info.render.frame;if(this.stats.lastFrame===frame)return;
  renderer.getDrawingBufferSize(this.size);
  const scale=Math.min(1,1024/this.size.x,640/this.size.y);
  const width=Math.max(1,Math.round(this.size.x*scale)),height=Math.max(1,Math.round(this.size.y*scale));
  if(width!==this.stats.width||height!==this.stats.height){
   this.mirror.getRenderTarget().setSize(width,height);
   Object.assign(this.stats,{width,height,estimatedTargetBytes:width*height*12});
  }
  const mirrorTarget=this.mirror.getRenderTarget();
  const rect=profiler?.scissorEnabled===false?new Vector4(0,0,width,height):reflectionScissor(surfaces,camera,width,height);
  mirrorTarget.scissor.copy(rect);mirrorTarget.scissorTest=true;
  this.stats.scissorPixels=rect.z*rect.w;this.stats.scissorFraction=rect.z*rect.w/(width*height);
  // Preserve outer render state even if a resource/shader error interrupts capture.
  const visible=surfaces.map(m=>m.visible),target=renderer.getRenderTarget();
  const viewport=renderer.getViewport(new Vector4()),scissor=renderer.getScissor(new Vector4()),scissorTest=renderer.getScissorTest();
  const autoReset=renderer.info.autoReset,xr=renderer.xr.enabled,shadowUpdate=renderer.shadowMap.autoUpdate;
  this.capturing=true;surfaces.forEach(m=>m.visible=false);renderer.info.autoReset=false;
  this.mirror.getReflectionCamera(camera).userData.pondReflection=true;
  profiler?.beginReflection();
  try{
   this.mirror.onBeforeRender(renderer,scene,camera,this.mirror.geometry,this.mirror.material as ShaderMaterial,null as never);
   // Reflector stores projection * local-to-world. Water uses world coordinates.
   this.projection.value.copy((this.mirror.material as ShaderMaterial).uniforms.textureMatrix.value)
    .multiply(this.inverse.copy(this.mirror.matrixWorld).invert());
   // Three increments its frame counter for nested renders as well. Cache the
   // post-capture value so the second pond reuses this texture in the outer draw.
   this.stats.captures++;this.stats.lastFrame=renderer.info.render.frame;this.stats.maxCapturesPerFrame=1;
  }finally{
   profiler?.endReflection();
   surfaces.forEach((m,i)=>m.visible=visible[i]);renderer.info.autoReset=autoReset;
   renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadowUpdate;
   renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
   this.capturing=false;
  }
 }
 dispose(){if(this.stats.disposed)return;this.stats.disposed=true;this.mirror.dispose();this.mirror.geometry.dispose();}
}
