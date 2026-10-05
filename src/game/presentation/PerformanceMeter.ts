import type {RenderProfiler} from './RenderProfiler.ts';
type Profile=ReturnType<RenderProfiler['snapshot']>;
export type PerformanceSnapshot={sampleMs:number;rafFps:number;scheduleSkipPercent:number;waitCpuMs:number;fps:number;frameMs:number|null;cpuMs:number;renderCpuMs:number|null;logicCpuMs:number;reflectionCpuMs:number|null;skipPercent:number;calls:number;triangles:number;mainCalls:number;reflectionCalls:number;gpu:Profile['gpu']|null};
// Simulation includes skipped-draw ticks; submit CPU averages rendered frames only.
export class PerformanceMeter {
 private began:number|null=null;
 private frames=0;private ticks=0;private cpu=0;private logic=0;private render=0;private reflection=0;
 private rafTicks=0;private scheduleSkipped=0;private waitCpu=0;private gpuSkipped=0;
 recordRaf(scheduled:boolean){if(this.began===null)return;this.rafTicks++;if(!scheduled)this.scheduleSkipped++;}
 private calls=0;private triangles=0;private mainCalls=0;private reflectionCalls=0;
 record(now:number,cpuMs:number,rendered:boolean,calls:number,triangles:number,profile?:Profile,waitCpuMs=0,intentionalSkip=false):PerformanceSnapshot|null{
  if(this.began===null){this.began=now;return null;}
  const renderCpu=rendered?(profile?.renderCpuMs??0):0;
  if(!rendered&&!intentionalSkip)this.gpuSkipped++;
  this.ticks++;this.cpu+=cpuMs;this.waitCpu+=waitCpuMs;this.logic+=Math.max(0,cpuMs-renderCpu);
  if(rendered){this.frames++;this.render+=renderCpu;this.reflection+=profile?.reflectionCpuMs??0;this.calls=calls;this.triangles=triangles;this.mainCalls=profile?.mainCalls??calls;this.reflectionCalls=profile?.reflectionCalls??0;}
  const elapsed=now-this.began;if(elapsed<500)return null;
  const result={sampleMs:elapsed,rafFps:this.rafTicks*1000/elapsed,scheduleSkipPercent:this.rafTicks?100*this.scheduleSkipped/this.rafTicks:0,waitCpuMs:this.waitCpu/this.ticks,fps:this.frames*1000/elapsed,frameMs:this.frames?elapsed/this.frames:null,cpuMs:this.cpu/this.ticks,logicCpuMs:this.logic/this.ticks,renderCpuMs:this.frames?this.render/this.frames:null,reflectionCpuMs:this.frames?this.reflection/this.frames:null,skipPercent:100*this.gpuSkipped/this.ticks,calls:this.calls,triangles:this.triangles,mainCalls:this.mainCalls,reflectionCalls:this.reflectionCalls,gpu:profile?.gpu??null};
  this.began=now;this.frames=0;this.ticks=0;this.cpu=0;this.logic=0;this.render=0;this.reflection=0;this.rafTicks=0;this.scheduleSkipped=0;this.waitCpu=0;this.gpuSkipped=0;
  return result;
 }
}
