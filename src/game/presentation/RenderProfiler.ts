import type {WebGLRenderer} from 'three';
import {GpuTimer} from './GpuTimer.ts';
export class RenderProfiler {
 readonly gpu:GpuTimer;
 last={renderCpuMs:0,mainCalls:0,mainTriangles:0};
 private start=0;
 private readonly renderer:WebGLRenderer;
 constructor(renderer:WebGLRenderer,gpuTiming=false){this.renderer=renderer;this.gpu=new GpuTimer(renderer.getContext() as WebGL2RenderingContext,gpuTiming);}
 beginFrame(){this.start=performance.now();this.gpu.beginFrame();}
 endFrame(){
  this.gpu.endFrame();this.last.renderCpuMs=performance.now()-this.start;
  this.last.mainCalls=this.renderer.info.render.calls;
  this.last.mainTriangles=this.renderer.info.render.triangles;
 }
 snapshot(){return {...this.last,gpu:this.gpu.snapshot()};}
 dispose(){this.gpu.dispose();}
}
