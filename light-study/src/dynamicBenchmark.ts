import type {StreetFrameSample} from './performanceReport.ts';
import {statistics} from './performanceHistory.ts';

export const dynamicShadowModes=['off','unshadowed','pcf','pcss','screen'] as const;
export type DynamicShadowMode=typeof dynamicShadowModes[number];
export const benchmarkPoses=[
  {name:'entrance',seconds:0,eye:[2.6,4.5,12.8],target:[-1,1.6,-8]},
  {name:'raised-middle',seconds:9,eye:[2.4650131256300787,8.018741895498632,12.020075836973792],target:[-1,1.6,-8]},
] as const;
export type BenchmarkRound={pose:string;mode:DynamicShadowMode;round:number;frames:StreetFrameSample[]};
export function summarizeBenchmark(rounds:BenchmarkRound[]){
  return rounds.map(r=>({pose:r.pose,mode:r.mode,round:r.round,
    cpu:statistics(r.frames.map(f=>f.cpu)),completion:statistics(r.frames.map(f=>f.completionMs)),gpu:statistics(r.frames.map(f=>f.gpu)),
    frames:r.frames.map(f=>({frame:f.frame,cpu:f.cpu,completionMs:f.completionMs,gpu:f.gpu,gpuPassSumMs:f.gpuPassSumMs,gpuOverlapMs:f.gpuOverlapMs,draws:f.draws,passes:f.passes,newPipelines:f.newPipelines,newPrograms:f.newPrograms,gpuPasses:f.gpuPasses})),
  }));
}

export function summarizeMotion(frames:StreetFrameSample[]){
  const rows=frames.filter(f=>f.reason==='animation'&&!f.newPipelines&&!f.newPrograms);
  return {frames:rows.length,excludedFrames:frames.length-rows.length,
    wallSpanMs:rows.length?rows.at(-1)!.startedAtMs-rows[0].startedAtMs:0,
    cpu:statistics(rows.map(f=>f.cpu)),completion:statistics(rows.map(f=>f.completionMs)),gpu:statistics(rows.map(f=>f.gpu)),
    gpuFrames:rows.filter(f=>f.gpu!==null).map(f=>({frame:f.frame,seconds:f.context.movingLight.seconds,gpu:f.gpu,completionMs:f.completionMs,gpuPasses:f.gpuPasses})),
  };
}
