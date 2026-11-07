import type {StreetFrameSample,FrameContext} from './performanceReport.ts';

export const HISTORY_CAPACITY=1800;
export type FrameReason='startup'|'interaction'|'settings'|'metrics'|'report'|'diagnostic'|'animation';
type Settings=Omit<FrameContext,'camera'|'movingLight'>;
export const historyColumns=['frame','startedAtMs','settings','reason','cpu','completionMs','gpu','gpuPassSumMs','gpuOverlapMs','draws','passes','eyeX','eyeY','eyeZ','targetX','targetY','targetZ','cpuStages','cpuOutsideStagesMs','newPipelines','newPrograms','movingTimeSeconds','lightX','lightY','lightZ'] as const;
const round=(n:number)=>Math.round(n*1000)/1000;
const rounded=(n:number|null)=>n===null?null:round(n);
export function settingsOf(context:FrameContext):Settings{const {camera:_,movingLight:__,...settings}=context;return settings;}
export function statistics(values:(number|null)[]){
  const sorted=values.filter((v):v is number=>v!==null).sort((a,b)=>a-b),n=sorted.length;
  if(!n)return {count:0,median:null,p95:null,max:null};
  return {count:n,median:round(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2),p95:round(sorted[Math.ceil(n*.95)-1]),max:round(sorted[n-1])};
}

/** Bounded ring. Time spent idle never deletes the interaction preceding a click.
 * No sorting, serialization, summaries or networking in the render loop. */
export class PerformanceHistory {
  private frames:(StreetFrameSample|undefined)[]=new Array(HISTORY_CAPACITY);
  private next=0;
  size=0;
  add(sample:StreetFrameSample){this.frames[this.next]=sample;this.next=(this.next+1)%HISTORY_CAPACITY;this.size=Math.min(HISTORY_CAPACITY,this.size+1);}
  values(){return Array.from({length:this.size},(_,i)=>this.frames[(this.next-this.size+i+HISTORY_CAPACITY)%HISTORY_CAPACITY]!);}
  find(frame:number){return this.values().find(s=>s.frame===frame);}
  export(throughFrame=Infinity){return packHistory(this.values().filter(f=>f.frame<=throughFrame));}
}

export function packHistory(frames:StreetFrameSample[]){
  const contexts:Settings[]=[],contextIds=new Map<string,number>(),stageLabels:string[]=[],stageIds=new Map<string,number>();
  const groups=new Map<string,{context:number;reason:FrameReason;frames:StreetFrameSample[]}>();
  const rows=frames.map(s=>{
    const settings=settingsOf(s.context),key=JSON.stringify(settings);
    let id=contextIds.get(key);if(id===undefined){id=contexts.length;contextIds.set(key,id);contexts.push(settings);}
    const groupKey=`${id}:${s.reason}`;
    let group=groups.get(groupKey);if(!group){group={context:id,reason:s.reason,frames:[]};groups.set(groupKey,group);}group.frames.push(s);
    const cpuStages=s.cpuStages.map(stage=>{
      let label=stageIds.get(stage.label);if(label===undefined){label=stageLabels.length;stageIds.set(stage.label,label);stageLabels.push(stage.label);}
      return [label,round(stage.inclusiveMs),round(stage.exclusiveMs)];
    });
    return [s.frame,round(s.startedAtMs),id,s.reason,round(s.cpu),rounded(s.completionMs),rounded(s.gpu),rounded(s.gpuPassSumMs),rounded(s.gpuOverlapMs),s.draws,s.passes,
      ...s.context.camera.position,...s.context.camera.target,cpuStages,round(s.cpuOutsideStagesMs),s.newPipelines,s.newPrograms,s.context.movingLight.seconds,...s.context.movingLight.position];
  });
  const rank=(field:'cpu'|'completionMs')=>frames.filter(f=>(f.reason==='interaction'||f.reason==='animation')).sort((a,b)=>(b[field]??0)-(a[field]??0)).slice(0,16);
  const gpuFrames=frames.filter(f=>f.gpu!==null),selected=new Map<number,StreetFrameSample>();
  // Keep full pass intervals for distributed GPU samples, worst frames and tail.
  for(let i=0;i<Math.min(96,gpuFrames.length);i++){const f=gpuFrames[Math.floor(i*(gpuFrames.length-1)/Math.max(1,Math.min(96,gpuFrames.length)-1))];selected.set(f.frame,f);}
  for(const f of [...rank('cpu'),...rank('completionMs'),...frames.slice(-20),...frames.filter(f=>f.reason==='startup').slice(0,1)])selected.set(f.frame,f);
  return {
    history:{capacity:HISTORY_CAPACITY,retention:'last rendered frames; idle does not expire history',columns:historyColumns,contexts,stageLabels,rows,
      frameCount:frames.length,gpuSampleCount:gpuFrames.length,wallSpanMs:frames.length?round(frames.at(-1)!.startedAtMs-frames[0].startedAtMs):0,
      summary:[...groups.values()].map(g=>({context:g.context,reason:g.reason,firstFrame:g.frames[0].frame,lastFrame:g.frames.at(-1)!.frame,
        cpu:statistics(g.frames.map(f=>f.cpu)),cpuWithoutGpuQuery:statistics(g.frames.filter(f=>f.gpu===null).map(f=>f.cpu)),completion:statistics(g.frames.map(f=>f.completionMs)),gpu:statistics(g.frames.map(f=>f.gpu)),
        cpuOver16ms:g.frames.filter(f=>f.cpu>16).length,completionOver33ms:g.frames.filter(f=>f.completionMs!==null&&f.completionMs>33).length,
        worstCpuFrames:g.frames.slice().sort((a,b)=>b.cpu-a.cpu).slice(0,5).map(f=>f.frame)})),
    },
    recentFrames:[...selected.values()].sort((a,b)=>a.frame-b.frame),
  };
}
