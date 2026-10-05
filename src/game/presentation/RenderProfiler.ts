import type {WebGLRenderer} from 'three';
import {GpuTimer} from './GpuTimer.ts';
const profilers=new WeakMap<object,RenderProfiler>();
export const renderProfiler=(renderer:object)=>profilers.get(renderer);

export class RenderProfiler {
 readonly gpu:GpuTimer;
 reflectionMode:'live'|'frozen'|'off'='off';
 scissorEnabled=true;
 last={renderCpuMs:0,reflectionCpuMs:0,mainCalls:0,reflectionCalls:0,mainTriangles:0,reflectionTriangles:0};
 private start=0;
 private reflectionStart=0;
 private reflectionCounts={calls:0,triangles:0};
 private readonly renderer:WebGLRenderer;
 constructor(renderer:WebGLRenderer,gpuTiming=false){this.renderer=renderer;this.gpu=new GpuTimer(renderer.getContext() as WebGL2RenderingContext,gpuTiming);profilers.set(renderer,this);}
 beginFrame(){this.start=performance.now();this.last.reflectionCpuMs=0;this.last.reflectionCalls=0;this.last.reflectionTriangles=0;this.gpu.beginFrame();}
 beginReflection(){
  this.reflectionStart=performance.now();this.reflectionCounts={calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles};
  this.gpu.segment('reflection');
 }
 endReflection(){
  this.gpu.segment('main');
  this.last.reflectionCpuMs+=performance.now()-this.reflectionStart;
  this.last.reflectionCalls+=this.renderer.info.render.calls-this.reflectionCounts.calls;
  this.last.reflectionTriangles+=this.renderer.info.render.triangles-this.reflectionCounts.triangles;
 }
 endFrame(){
  this.gpu.endFrame();this.last.renderCpuMs=performance.now()-this.start;
  this.last.mainCalls=this.renderer.info.render.calls-this.last.reflectionCalls;
  this.last.mainTriangles=this.renderer.info.render.triangles-this.last.reflectionTriangles;
 }
 snapshot(){return {...this.last,gpu:this.gpu.snapshot(),reflectionMode:this.reflectionMode,scissorEnabled:this.scissorEnabled};}
 dispose(){this.gpu.dispose();profilers.delete(this.renderer);}
}
