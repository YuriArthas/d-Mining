export const LOADING_STAGES = ['assets','terrain','rooms','shaders'] as const;
export type LoadingStage = typeof LOADING_STAGES[number];
export type LoadingEvent = {stage:LoadingStage;done:number;total:number;complete?:boolean}|{ready:true}|{error:string}|{reset:true};
// Fixed work shares, not an elapsed-time estimate. First rendered frame owns the final 2%.
const STAGE_SHARE:Record<LoadingStage,number>={assets:.55,terrain:.05,rooms:.10,shaders:.28};
export type LoadingState = {progress:number;steps:Record<LoadingStage,{done:number;total:number;complete:boolean}>;ready:boolean;error:string|null};
export const initialLoading = ():LoadingState => ({progress:0,steps:Object.fromEntries(LOADING_STAGES.map(stage=>[stage,{done:0,total:0,complete:false}])) as LoadingState['steps'],ready:false,error:null});
export function updateLoading(state:LoadingState,event:LoadingEvent):LoadingState{
 if('reset' in event)return initialLoading();
 if('error' in event)return {...state,ready:false,error:event.error};
 if(state.error)return state;
 if('ready' in event)return {...state,progress:1,ready:true};
 if(state.ready)return state;
 const steps={...state.steps,[event.stage]:{done:event.done,total:event.total,complete:!!event.complete}};
 const progress=LOADING_STAGES.reduce((sum,stage)=>{const step=steps[stage];return sum+STAGE_SHARE[stage]*(step.complete?1:step.total>0?Math.min(1,Math.max(0,step.done/step.total)):0);},0);
 // Concurrent completion, revised totals, or repeated warmup must never rewind the bar.
 return {...state,steps,progress:Math.max(state.progress,Math.min(.98,progress))};
}
