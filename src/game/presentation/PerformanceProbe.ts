import type {PerformanceSnapshot} from './PerformanceMeter.ts';
export type ProbeMode='normal'|'idle'|'unlit'|'no-shadows'|'low-resolution';
export const PROBE_STAGES:readonly {mode:ProbeMode;label:string}[]=[
 {mode:'normal',label:'正常画面（前）'},
 {mode:'idle',label:'暂停 3D 绘制'},
 {mode:'unlit',label:'纯色材质'},
 {mode:'no-shadows',label:'关闭阴影'},
 {mode:'low-resolution',label:'像素量降至 1/4'},
 {mode:'normal',label:'正常画面（后）'},
];
export type ProbeResult={label:string;mode:ProbeMode;raf:number;fps:number;logic:number;submit:number;milliseconds:number;samples:number};
export class PerformanceProbe {
 readonly results:ProbeResult[]=[];
 index=0;done=false;
 private began:number;
 private sum={raf:0,fps:0,logic:0,submit:0,milliseconds:0,samples:0};
 constructor(now:number){this.began=now;}
 get mode(){return this.done?'normal':PROBE_STAGES[this.index].mode;}
 record(now:number,stats:PerformanceSnapshot){
  if(this.done)return false;
  // Discard transition/compilation and any sample straddling the warm-up window.
  const elapsed=now-this.began;
  if(elapsed-stats.sampleMs>=2000&&elapsed<6000){
   const ms=stats.sampleMs;this.sum.raf+=stats.rafFps*ms;this.sum.fps+=stats.fps*ms;
   this.sum.logic+=stats.logicCpuMs*ms;this.sum.submit+=(stats.renderCpuMs??0)*ms;
   this.sum.milliseconds+=ms;this.sum.samples++;
  }
  if(elapsed<6000)return false;
  const s=this.sum,denominator=s.milliseconds||1,stage=PROBE_STAGES[this.index];
  this.results.push({...stage,raf:s.raf/denominator,fps:s.fps/denominator,logic:s.logic/denominator,submit:s.submit/denominator,milliseconds:s.milliseconds,samples:s.samples});
  this.index++;this.done=this.index===PROBE_STAGES.length;this.began=now;
  this.sum={raf:0,fps:0,logic:0,submit:0,milliseconds:0,samples:0};return true;
 }
}
