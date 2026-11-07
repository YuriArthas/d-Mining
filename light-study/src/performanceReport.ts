import type {PassTiming} from './gpuTiming.ts';
import type {MotionMode} from './lightMotion.ts';
import type {CpuStage} from './cpuTiming.ts';
import type {FrameReason,packHistory} from './performanceHistory.ts';

export type FrameContext={
  lightMode:string;view:string;ao:boolean;shadowMode:string;renderMode:string;postMode:string;probe:string;
  dynamicShadow?:string;shadowGeometry?:string;scheduler?:string;benchmarkPhase?:string;renderLoop?:'continuous'|'demand';
  pipeline?:string;materialDiagnostic?:string;
  cameraMotion?:'orbit'|'tour';
  motion:MotionMode;movingLight:{seconds:number;position:number[]};
  camera:{position:number[];target:number[]};
  viewport:{width:number;height:number;dpr:number;bufferWidth:number;bufferHeight:number};
};
export type StreetFrameSample={
  frame:number;startedAtMs:number;cpu:number;completionMs:number|null;
  gpu:number|null;gpuPassSumMs:number|null;gpuOverlapMs:number|null;
  draws:number;passes:number;gpuPasses?:PassTiming[];context:FrameContext;
  reason:FrameReason;cpuStages:CpuStage[];cpuOutsideStagesMs:number;newPipelines:number;newPrograms:number;
};
export type PerformanceReport={
  schemaVersion:3;project:'mining-light';capturedAt:string;sessionId:string;
  build:{module:string;three:string};
  device:{userAgent:string;platform:string;hardwareConcurrency:number;adapter:Record<string,string>;timestampSupported:boolean;timestampEnabled:boolean};
  scene:Record<string,unknown>;latestFrame:StreetFrameSample;recentFrames:StreetFrameSample[];
  history:ReturnType<typeof packHistory>['history'];
};

export async function sendPerformanceReport(report:PerformanceReport){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch('/api/mining-light/performance-reports',{
      method:'POST',mode:'same-origin',credentials:'omit',redirect:'error',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(report),signal:controller.signal,
    });
    const receipt=await response.json();
    if(!response.ok)throw Error(receipt.error||`服务器返回 HTTP ${response.status}`);
    if(receipt.ok!==true||typeof receipt.id!=='string'||!/^[0-9a-f-]{36}$/.test(receipt.id))throw Error('服务器没有返回有效的保存回执');
    return receipt as {ok:true;id:string;receivedAt:string};
  }finally{clearTimeout(timer);}
}
