import type { TerrainStream } from './TerrainStream.ts';

function yieldTask(signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  const aborted=()=>{clearTimeout(timer);signal.removeEventListener('abort',aborted);reject(signal.reason??new DOMException('Loading cancelled','AbortError'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve();},4);
  signal.addEventListener('abort',aborted,{once:true});
  if(signal.aborted)aborted();
 });
}

// Startup only: no physics ticks or draws are running for this world yet. Drain
// its workers on yielding tasks, so GPU frame delivery cannot starve terrain.
// Gameplay edits continue to commit at the existing physics-step boundary.
export async function prepareSpawnTerrain(
 terrain:TerrainStream,feet:readonly number[],signal:AbortSignal,
 onProgress?:(done:number,total:number)=>void,stallMs=30000,
){
 signal.throwIfAborted();terrain.recenter(feet);
 let lastQueue=-1,lastProgress=performance.now(),total=0;
 while(true){
  signal.throwIfAborted();
  if(terrain.disposed)throw new DOMException('Terrain disposed during loading','AbortError');
  terrain.process();
  if(terrain.error)throw new Error(terrain.error);
  const state=terrain.snapshot();total=Math.max(total,state.queue);
  if(state.queue!==lastQueue){lastQueue=state.queue;lastProgress=performance.now();onProgress?.(total-state.queue,total);}
  if(terrain.ready(feet)&&state.queue===0&&!state.inFlight)return;
  if(performance.now()-lastProgress>=stallMs)throw new Error('出生点地形准备超时，请退出后重新进入');
  await yieldTask(signal);
 }
}
