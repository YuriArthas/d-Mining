import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadMaterials} from './materials.ts';
import {loadStreet} from './streetModel.ts';
import {createStreetLighting,type StreetLightMode,type StreetProbe} from './streetLighting.ts';
import {StreetProfiler,StreetGPUBackend,type PassTiming} from './streetProfiler.ts';
import {ResourceLoadError,describeError} from './resourceLoading.ts';
import {sendPerformanceReport,type StreetFrameSample,type FrameContext} from './performanceReport.ts';
import {PerformanceHistory,settingsOf,type FrameReason} from './performanceHistory.ts';
import {createMovingLantern} from './movingLantern.ts';
import {createShadowCasters} from './shadowCasters.ts';
import type {MotionMode} from './lightMotion.ts';
import {dynamicShadowModes,benchmarkPoses,summarizeBenchmark,summarizeMotion,type DynamicShadowMode,type BenchmarkRound} from './dynamicBenchmark.ts';
import {FrameCadence,summarizeIntervals} from './frameCadence.ts';
import {statistics} from './performanceHistory.ts';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
document.body.dataset.light='night';document.body.classList.add('street');
app.innerHTML=`<div class="loading" role="status"><h2>松风矿街</h2><p id="status">正在点亮街边的灯火…</p></div><div class="chrome"><header class="brand"><div class="eyebrow">PINEWIND · LANTERN STREET</div><h1>松风矿街</h1><p>灯下暖石 · 长街夜色</p></header><a class="back" href="/">游戏列表 ↗</a><span class="hint">拖动环视 · 滚轮靠近 · H 隐藏界面</span><nav class="toolbar" aria-label="街景与光照"><button data-view="entrance" aria-pressed="true">街口</button><button data-view="walk" aria-pressed="false">街中</button><button data-view="lamp" aria-pressed="false">灯下</button><span class="divider"></span><button data-light="night" aria-pressed="true">夜晚</button><button data-light="day" aria-pressed="false">晴日</button></nav><nav class="motion-toolbar" aria-label="移动提灯"><span>移动提灯</span><button class="motion-pause" type="button">暂停</button><button class="motion-toggle" type="button" aria-pressed="true">关闭</button></nav><button class="metrics-toggle" aria-label="显示性能信息">性能</button><section class="metrics" aria-label="性能信息"><div class="report-actions"><button class="report-performance" type="button">上报性能</button><button class="benchmark-performance" type="button">自动对照并上报</button><span class="report-status" role="status">保留最近 1800 帧；观察后上报一次即可</span></div><output class="metrics-values"></output></section></div>`;
const loader=document.querySelector<HTMLDivElement>('.loading')!,status=document.querySelector('#status')!;
const failureDetails=document.createElement('details');failureDetails.className='load-details';failureDetails.hidden=true;
const detailsTitle=document.createElement('summary');detailsTitle.textContent='错误详情';
const detailsText=document.createElement('pre');failureDetails.append(detailsTitle,detailsText);
const failureActions=document.createElement('div');failureActions.className='load-actions';failureActions.hidden=true;
const copyError=document.createElement('button');copyError.type='button';copyError.textContent='复制错误信息';
const reload=document.createElement('button');reload.type='button';reload.textContent='重新加载';reload.addEventListener('click',()=>location.reload());
failureActions.append(copyError,reload);loader.append(failureDetails,failureActions);
copyError.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(detailsText.textContent??'');copyError.textContent='已复制';}catch{failureDetails.open=true;copyError.textContent='复制失败，请选择详情中的文字';}});
let loadStage='初始化图形设备';
const setStage=(stage:string)=>{loadStage=stage;status.textContent=`正在${stage}…`;};
const params=new URLSearchParams(location.search),errors:string[]=[];
const views={entrance:{eye:[2.6,4.5,12.8],target:[-1,1.6,-8]},walk:{eye:[.8,2.5,4.5],target:[-.8,2.5,-14]},lamp:{eye:[1.1,2.9,7.3],target:[-4.8,1.8,2.7]}} as const;
type View=keyof typeof views;
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
function fail(error:unknown){
  loader.hidden=false;loader.classList.add('error');loader.setAttribute('role','alert');
  status.textContent=`${loadStage}失败\n${describeError(error)}`;
  detailsText.textContent=[status.textContent,error instanceof ResourceLoadError?`资源：${error.url}`:'',`页面：${location.href}`,`版本：${import.meta.url}`,`浏览器：${navigator.userAgent}`,`浏览器报告在线：${navigator.onLine}`,`时间：${new Date().toISOString()}`].filter(Boolean).join('\n');
  failureDetails.hidden=false;failureActions.hidden=false;console.error(error);
}
async function start(){
  const started=performance.now();
  const renderMode=params.get('render')??(params.get('bakeShadow')==='1'?'reference':'optimized');
  const postMode=params.get('post')??(renderMode==='optimized'?'optimized':'reference');
  const timing=params.get('timing')!=='off';
  const scheduler=params.get('scheduler')??'pipelined';if(!['serial','pipelined'].includes(scheduler))throw Error('Unknown scheduler');
  const maxFramesInFlight=scheduler==='serial'?1:2;
  if(!['reference','optimized'].includes(postMode))throw Error('Unknown post-processing mode');
  setStage('初始化图形设备');
  if(!navigator.gpu)throw Error('此样板需要支持 WebGPU 的桌面 Chrome 或 Edge。');
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('当前浏览器没有可用的 WebGPU 图形适配器。');
  const device=await adapter.requestDevice({requiredFeatures:[...adapter.features] as GPUFeatureName[]});
  const adapterInfo={vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description};
  // r186 already makes fullscreen quads single-sampled. Disable their unused
  // depth buffer; the scene passes still own explicit depth and 4x MSAA.
  const options={antialias:postMode==='reference',depth:postMode==='reference',alpha:false,trackTimestamp:false},backend=new StreetGPUBackend({...options,device}),renderer=new THREE.Renderer(backend,options);renderer.library=new THREE.StandardNodeLibrary();
  renderer.onDeviceLost=info=>{errors.push(info.message);fail(Error('图形设备连接中断，请刷新样板。'));};
  renderer.onError=info=>{const message=String((info as {message?:string}).message??info);errors.push(message);fail(Error(message));};
  await renderer.init();if(!backend.isWebGPUBackend)throw Error('样板未启用 WebGPU。');
  renderer.info.autoReset=false;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);app.prepend(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','松风矿街光照样板');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,250);
  setStage('加载材质');
  const library=await loadMaterials(['crafted']);
  library.setVariant('crafted');
  setStage('加载街景模型');
  const model=await loadStreet(library.materials);scene.add(model.group);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshStandardMaterial({color:'#26364b',roughness:.96}));ground.rotation.x=-Math.PI/2;ground.position.y=-.25;ground.receiveShadow=true;for(let i=1;i<=3;i++)ground.layers.enable(i);scene.add(ground);
  const probe=(params.get('probe')??'none') as StreetProbe;
  if(!['reference','optimized'].includes(renderMode)||!['none','single-output','no-msaa','no-environment','single-sample-normals'].includes(probe))throw Error('Unknown street rendering diagnostic');
  if(params.get('bakeShadow')==='1'&&(renderMode!=='reference'||postMode!=='reference'||probe!=='none'))throw Error('Shadow baking requires the unmodified reference rendering path');
  setStage('构建光照');
  const lighting=createStreetLighting(renderer,scene,camera,model.layout.lamps,model.glass,model.windowglass,{optimized:renderMode==='optimized'&&params.get('bakeShadow')!=='1',probe,post:postMode as 'reference'|'optimized'});
  if(params.get('bakeShadow')==='1'){
    status.textContent='正在生成静态灯影缓存…';
    (window as any).__lightBake={state:'running'};
    const result=await lighting.bake(model.group);(window as any).__lightBake={state:'complete',...result};status.textContent='静态灯影缓存已生成';return;
  }
  if(params.get('shadows')!=='live'){setStage('加载静态灯影');await lighting.useStaticShadow();}
  const shadowCasters=createShadowCasters(model.group);
  let shadowGeometry=params.get('shadowGeometry')??'spatial';if(!['full','spatial'].includes(shadowGeometry))throw Error('Unknown shadow geometry');
  lighting.screenShadow.setCasters(shadowGeometry==='spatial'?shadowCasters.scene:scene,shadowCasters.stats);
  setStage('加载移动提灯');
  const movingLantern=await createMovingLantern(scene);movingLantern.installScreenLight(lighting.screenShadow.light);
  const initialMotion=(params.get('motion')??'off') as MotionMode;
  if(!['off','paused','moving'].includes(initialMotion))throw Error('Unknown moving-lantern mode');
  movingLantern.setMode(initialMotion==='off'?'off':'paused');
  movingLantern.setShadowMode((params.get('dynamicShadow')??'screen') as DynamicShadowMode);
  setStage('准备场景与灯影');
  const profiler=new StreetProfiler(device,timing);profiler.targets=lighting.profileTargets;renderer.inspector=profiler;backend.frameProfiler=profiler;
  let lightMode:StreetLightMode='night',aoEnabled=true;
  let continuous=params.get('loop')!=='demand';
  const cadence=new FrameCadence();
  const isContinuous=()=>continuous||movingLantern.motion.mode==='moving';
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.485;controls.minDistance=3;controls.maxDistance=55;controls.zoomSpeed=.65;controls.panSpeed=.65;
  let dirty=true,inFlight=0,raf=0,disposed=false,booting=true,submitted=0,completed=0,skipped=0,view:View='entrance',metricsOpen=false,bootMs:number|null=null;
  let cpu=0,completionMs=0,gpuSampleCompletionMs:number|null=null,gpu:number|null=null,gpuPassSum:number|null=null,gpuOverlap:number|null=null,gpuSampleFrame=0,forceSample=false,timestampPending:Promise<void>|null=null;
  let gpuPasses:PassTiming[]=[];
  let counters={drawCalls:0,triangles:0,frameCalls:0};
  const history=new PerformanceHistory(),sessionId=crypto.randomUUID();
  let forcedReason:FrameReason='diagnostic',previousSettings='';
  let sampleRequest:{reason:FrameReason;assigned:boolean;resolve:(sample:StreetFrameSample)=>void;reject:(error:unknown)=>void}|null=null;
  const warmup:{frames:number;newPipelines:number;newPrograms:number;ms:number}={frames:0,newPipelines:0,newPrograms:0,ms:0};
  let benchmarkActive=false,benchmarkPhase='',benchmarkResult:unknown=null;
  let routeFrames:StreetFrameSample[]|null=null,routeOverflow=false;
  const frameContext=():FrameContext=>({dynamicShadow:movingLantern.shadowMode,shadowGeometry,scheduler,benchmarkPhase,renderLoop:continuous?'continuous':'demand',motion:movingLantern.motion.mode,movingLight:{seconds:movingLantern.motion.seconds,position:movingLantern.light.position.toArray()},lightMode,view,renderMode,postMode,probe,ao:aoEnabled,shadowMode:params.get('shadows')==='live'?'live PCSS':'static visibility atlas',camera:{position:camera.position.toArray(),target:controls.target.toArray()},viewport:{width:innerWidth,height:innerHeight,dpr:renderer.getPixelRatio(),bufferWidth:renderer.domElement.width,bufferHeight:renderer.domElement.height}});
  let metricsDrawnAt=-Infinity;
  const drawMetrics=(force=false)=>{if(!force&&performance.now()-metricsDrawnAt<250)return;metricsDrawnAt=performance.now();document.querySelector('.metrics-values')!.textContent=`WebGPU · ${adapterInfo.description||adapterInfo.architecture||adapterInfo.vendor}\n${model.stats.triangles.toLocaleString()} street triangles / ${model.stats.batches} street batches\n${renderer.domElement.width} × ${renderer.domElement.height} pixels · DPR ${renderer.getPixelRatio()}\n${lighting.snapshot().shadowMode}\n${renderMode==='optimized'?'Optimized lighting':'Reference lighting'} · post ${postMode}\n${counters.drawCalls} draws / ${counters.frameCalls} passes\nRender FPS ${cadence.snapshot().fps?.toFixed(1)??'n/a'} · interval P95 ${cadence.snapshot().intervalMs.p95?.toFixed(2)??'n/a'} ms\nCPU submit ${cpu.toFixed(2)} ms\nSubmit → complete ${(gpuSampleCompletionMs??completionMs).toFixed(2)} ms (frame ${gpuSampleCompletionMs===null?submitted:gpuSampleFrame})\nGPU frame span ${!timing?'disabled':gpu===null?'n/a':gpu.toFixed(2)+' ms'} (frame ${gpuSampleFrame})\nPass sum ${gpuPassSum===null?'n/a':gpuPassSum.toFixed(2)} ms · overlap ${gpuOverlap===null?'n/a':gpuOverlap.toFixed(2)} ms\n${gpuPasses.map(p=>p.label+': '+p.ms.toFixed(2)+' ms').join('\n')}\nHistory ${history.size} / 1800 frames · GPU every 15 frames\nMoving lantern: ${movingLantern.motion.mode} · ${movingLantern.shadowMode}\n${scheduler} · ${inFlight}/${maxFramesInFlight} frames in flight\nRendered ${submitted} · ${isContinuous()?'continuous frames':'on demand'}`;
  };
    const request=()=>{dirty=true;if(!booting&&!raf&&inFlight<maxFramesInFlight&&!document.hidden&&!disposed&&!errors.length)raf=requestAnimationFrame(render);};
  function render(){
    raf=0;if(disposed||booting||document.hidden||!dirty||errors.length)return;if(inFlight>=maxFramesInFlight){skipped++;return;}dirty=false;inFlight++;
    try{
      movingLantern.tick(performance.now());if(isContinuous())cadence.add(performance.now());
      const job=sampleRequest&&!sampleRequest.assigned&&(!profiler.supported||!timestampPending)?sampleRequest:null;
      if(job)job.assigned=true;
      const capture=profiler.supported&&!timestampPending&&(!!job||forceSample||submitted===0||(submitted+1)%15===0);
      const context=frameContext(),settings=JSON.stringify(settingsOf(context));
      const reason:FrameReason=submitted===0?'startup':job?job.reason:forceSample?forcedReason:settings!==previousSettings?'settings':movingLantern.motion.mode==='moving'?'animation':'interaction';previousSettings=settings;
      const pipelinesBefore=backend.pipelineCreations,programsBefore=backend.programCreations;
      renderer.info.reset();profiler.startFrame(capture);const t=performance.now();lighting.render();cpu=performance.now()-t;submitted++;counters={...renderer.info.render};
      const cpuStages=profiler.cpuTimer.finish();
      const sample:StreetFrameSample={frame:submitted,startedAtMs:t,cpu,completionMs:null,gpu:null,gpuPassSumMs:null,gpuOverlapMs:null,draws:counters.drawCalls,passes:counters.frameCalls,context,reason,cpuStages,cpuOutsideStagesMs:Math.max(0,cpu-cpuStages.reduce((sum,s)=>sum+s.exclusiveMs,0)),newPipelines:backend.pipelineCreations-pipelinesBefore,newPrograms:backend.programCreations-programsBefore};history.add(sample);
      if(routeFrames){if(routeFrames.length<7200)routeFrames.push(sample);else routeOverflow=true;}
      const gpuResult=capture?profiler.resolve():null;
      const completion=device.queue.onSubmittedWorkDone().then(()=>{const duration=performance.now()-t;sample.completionMs=duration;completionMs=duration;completed=Math.max(completed,sample.frame);return duration;});
      if(gpuResult){
        // Keep the wall-clock completion paired with the same sampled GPU frame.
        timestampPending=Promise.all([gpuResult,completion]).then(([value,complete])=>{sample.gpu=value.frameMs;sample.gpuPassSumMs=value.passSumMs;sample.gpuOverlapMs=value.overlapMs;gpu=value.frameMs;gpuPassSum=value.passSumMs;gpuOverlap=value.overlapMs;gpuSampleCompletionMs=complete;gpuSampleFrame=sample.frame;gpuPasses=value.passes;sample.gpuPasses=gpuPasses;if(metricsOpen)drawMetrics();}).catch(e=>{errors.push(String(e));fail(e);}).finally(()=>{timestampPending=null;if(sampleRequest&&!sampleRequest.assigned)request();});
      }
      if(job)void Promise.all([completion,timestampPending]).then(()=>{
        if(errors.length)throw Error(errors.join('\n'));
        if(sample.completionMs===null||(profiler.supported&&sample.gpu===null))throw Error('未取得完整的当前帧性能数据');
        if(sampleRequest===job)sampleRequest=null;job.resolve(sample);
      }).catch(error=>{if(sampleRequest===job)sampleRequest=null;job.reject(error);});
      forceSample=false;
      void completion.catch(e=>{sampleRequest?.reject(e);sampleRequest=null;errors.push(String(e));fail(e);}).finally(()=>{
        inFlight--;if(metricsOpen)drawMetrics();if(dirty||isContinuous())request();
      });
      if(isContinuous())request();
    }catch(e){inFlight--;sampleRequest?.reject(e);sampleRequest=null;errors.push(String(e));fail(e);}

  }
  const ready=()=>completed>0;
  const idle=()=>new Promise<void>((resolve,reject)=>{const since=performance.now(),target=submitted+(dirty?1:0);const poll=()=>{if(errors.length)reject(Error(errors.join('\n')));else if(isContinuous()?completed>=target:ready()&&!inFlight&&!dirty)resolve();else if(performance.now()-since>180000)reject(Error('Render did not settle'));else setTimeout(poll,50);};poll();});
  const sampleOnce=(reason:FrameReason='diagnostic')=>new Promise<StreetFrameSample>((resolve,reject)=>{
    if(sampleRequest){reject(Error('已有一次采样正在进行'));return;}
    if(errors.length){reject(Error(errors.join('\n')));return;}
    sampleRequest={reason,assigned:false,resolve,reject};request();
  });
  const reportButton=document.querySelector<HTMLButtonElement>('.report-performance')!,reportStatus=document.querySelector<HTMLElement>('.report-status')!;
  const uploadReport=async()=>{
    if(reportButton.disabled)return;reportButton.disabled=true;reportStatus.textContent='正在采集当前帧与历史…';delete reportStatus.dataset.reportId;
    try{
      const latestFrame=await sampleOnce('report');
      const capturedHistory=history.export(latestFrame.frame);
      reportStatus.textContent='正在发送…';
      const receipt=await sendPerformanceReport({schemaVersion:3,sessionId,project:'mining-light',capturedAt:new Date().toISOString(),
        build:{module:import.meta.url,three:THREE.REVISION},
        device:{userAgent:navigator.userAgent,platform:navigator.platform,hardwareConcurrency:navigator.hardwareConcurrency,adapter:adapterInfo,timestampSupported:device.features.has('timestamp-query'),timestampEnabled:timing},
        scene:{benchmark:benchmarkResult,frameScheduling:{scheduler,maxFramesInFlight,renderLoop:continuous?'continuous':'demand',cadence:cadence.snapshot()},model:{...model.stats,revision:model.revision,layoutRevision:__STREET_LAYOUT_REVISION__},lighting:lighting.snapshot(),memory:{...renderer.info.memory},bootMs,warmup,movingLantern:{...movingLantern.snapshot(),...latestFrame.context.movingLight,mode:latestFrame.context.motion},errors:errors.slice()},
        latestFrame,...capturedHistory,
      });
      reportStatus.dataset.reportId=receipt.id;reportStatus.textContent=`已上报 · ${capturedHistory.history.frameCount} 帧 / ${capturedHistory.history.gpuSampleCount} 次 GPU · ${receipt.id.slice(0,8)}`;reportButton.textContent='再次上报';
    }catch(error){reportStatus.textContent=`上报失败：${describeError(error)}。请重试。`;reportButton.textContent='重试上报';}
    finally{reportButton.disabled=false;}
  };
  reportButton.addEventListener('click',()=>void uploadReport());
  const setView=(name:View)=>{if(!views[name])throw Error('Unknown view');view=name;camera.position.fromArray(views[name].eye);controls.target.fromArray(views[name].target);controls.update();for(const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===name));request();};
  const setLight=(name:StreetLightMode)=>{lighting.setMode(name);lightMode=name;document.body.dataset.light=name;(ground.material as THREE.MeshStandardMaterial).color.set(name==='night'?'#26364b':'#b0b59d');for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-light]'))button.setAttribute('aria-pressed',String(button.dataset.light===name));request();};
  const pauseButton=document.querySelector<HTMLButtonElement>('.motion-pause')!,motionButton=document.querySelector<HTMLButtonElement>('.motion-toggle')!;
  const setMotion=(mode:MotionMode)=>{
    if(!['off','paused','moving'].includes(mode))throw Error('Invalid motion mode');
    movingLantern.setMode(mode);pauseButton.disabled=mode==='off';pauseButton.textContent=mode==='moving'?'暂停':'继续';
    motionButton.textContent=mode==='off'?'开启':'关闭';motionButton.setAttribute('aria-pressed',String(mode!=='off'));request();
  };
  pauseButton.addEventListener('click',()=>setMotion(movingLantern.motion.mode==='moving'?'paused':'moving'));
  motionButton.addEventListener('click',()=>setMotion(movingLantern.motion.mode==='off'?'moving':'off'));
  controls.addEventListener('change',request);
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view as View));
  for(const b of document.querySelectorAll<HTMLButtonElement>('button[data-light]'))b.addEventListener('click',()=>setLight(b.dataset.light as StreetLightMode));
  document.querySelector('.metrics-toggle')!.addEventListener('click',()=>{metricsOpen=!metricsOpen;document.querySelector('.metrics')!.classList.toggle('open',metricsOpen);drawMetrics(true);if(metricsOpen){forcedReason='metrics';forceSample=true;request();}});
  window.addEventListener('keydown',e=>{if(e.code==='KeyH')document.body.classList.toggle('capture');});
  window.addEventListener('resize',()=>{cadence.reset();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);request();});
  const benchmarkButton=document.querySelector<HTMLButtonElement>('.benchmark-performance')!;
  if(params.get('experiment')!=='dynamic'){document.querySelector<HTMLElement>('.motion-toolbar')!.hidden=true;benchmarkButton.textContent='静态测帧率并上报';}
  const runStaticBenchmark=async(seconds=30)=>{
    if(benchmarkActive||sampleRequest)throw Error('已有采样正在进行');
    if(!Number.isFinite(seconds)||seconds<1||seconds>30)throw Error('Invalid static duration');
    const saved={continuous,motion:movingLantern.motion.mode};
    const buttons=[...document.querySelectorAll<HTMLButtonElement>('.toolbar button,.motion-toolbar button,.report-performance,.benchmark-performance')];
    const viewport=JSON.stringify(frameContext().viewport);let interrupted=false;
    const onHidden=()=>{if(document.hidden)interrupted=true;};
    const check=()=>{if(interrupted||document.hidden)throw Error('测量被切到后台，请保持页面可见后重试');if(JSON.stringify(frameContext().viewport)!==viewport)throw Error('测量期间窗口尺寸改变，请重试');};
    benchmarkActive=true;benchmarkResult=null;buttons.forEach(b=>b.disabled=true);controls.enabled=false;document.addEventListener('visibilitychange',onHidden);
    try{
      continuous=false;setMotion('off');await idle();if(timestampPending)await timestampPending;
      for(let i=0;i<2;i++)await sampleOnce('diagnostic');
      routeFrames=[];routeOverflow=false;benchmarkPhase='static/measure';continuous=true;cadence.reset();request();
      const end=performance.now()+seconds*1000;
      while(performance.now()<end){check();reportStatus.textContent=`静态灯光连续测量 · 剩余 ${Math.ceil((end-performance.now())/1000)} 秒`;await new Promise(resolve=>setTimeout(resolve,100));}
      continuous=false;await idle();if(timestampPending)await timestampPending;check();if(routeOverflow)throw Error('采样超过帧容量');
      const frames=routeFrames.filter(f=>f.reason==='interaction');
      if(frames.length<2)throw Error('完整静态帧不足，请延长测量');
      if(frames.some(f=>f.newPipelines||f.newPrograms))throw Error('测量期间仍有新建管线，请重试');
      const intervals=frames.slice(1).map((f,i)=>f.startedAtMs-frames[i].startedAtMs);
      benchmarkResult={type:'static-continuous',seconds,frameCount:frames.length,cadence:summarizeIntervals(intervals),gpu:statistics(frames.map(f=>f.gpu)),cpu:statistics(frames.map(f=>f.cpu)),completion:statistics(frames.map(f=>f.completionMs)),context:frames[0].context,gpuFrames:frames.filter(f=>f.gpu!==null),frameIntervalsMs:intervals};
      return benchmarkResult;
    }finally{
      document.removeEventListener('visibilitychange',onHidden);routeFrames=null;benchmarkPhase='';continuous=saved.continuous;cadence.reset();setMotion(saved.motion);controls.enabled=true;benchmarkActive=false;buttons.forEach(b=>b.disabled=false);pauseButton.disabled=saved.motion==='off';request();
    }
  };
  const runBenchmark=async(options:{samples?:number;rounds?:number;poses?:number;motionSeconds?:number}={})=>{
    if(benchmarkActive||sampleRequest)throw Error('已有采样正在进行');
    const count=options.samples??5,roundCount=options.rounds??2,poseCount=options.poses??2,motionSeconds=options.motionSeconds??30;
    if(!Number.isInteger(count)||count<1||count>10||!Number.isInteger(roundCount)||roundCount<1||roundCount>2||!Number.isInteger(poseCount)||poseCount<1||poseCount>2)throw Error('Invalid comparison options');
    if(!Number.isFinite(motionSeconds)||motionSeconds<0||motionSeconds>30)throw Error('Invalid motion duration');
    const saved={continuous,mode:movingLantern.motion.mode,seconds:movingLantern.motion.seconds,shadow:movingLantern.shadowMode,eye:camera.position.clone(),target:controls.target.clone(),light:lightMode};
    const buttons=[...document.querySelectorAll<HTMLButtonElement>('.toolbar button,.motion-toolbar button,.report-performance,.benchmark-performance')];
    benchmarkActive=true;benchmarkResult=null;buttons.forEach(b=>b.disabled=true);controls.enabled=false;
    const rounds:BenchmarkRound[]=[];const began=new Date().toISOString();
    const viewport=JSON.stringify(frameContext().viewport);
    let interrupted=false;
    const onHidden=()=>{if(document.hidden)interrupted=true;};document.addEventListener('visibilitychange',onHidden);
    const check=()=>{if(interrupted||document.hidden)throw Error('对照被切到后台，请保持页面可见后重试');if(JSON.stringify(frameContext().viewport)!==viewport)throw Error('对照期间窗口尺寸改变，请重试');};
    let motion:ReturnType<typeof summarizeMotion>|null=null;
    try{
      continuous=false;cadence.reset();setMotion('paused');pauseButton.disabled=true;await idle();if(timestampPending)await timestampPending;
      setLight('night');
      if(motionSeconds>0){
        const pose=benchmarkPoses[0];camera.position.fromArray(pose.eye);controls.target.fromArray(pose.target);controls.update();
        movingLantern.seek(0);movingLantern.setShadowMode('screen');benchmarkPhase='route/prepare';
        for(let i=0;i<2;i++){movingLantern.invalidateShadow();await sampleOnce('diagnostic');}
        routeFrames=[];routeOverflow=false;benchmarkPhase='route/measure';setMotion('moving');pauseButton.disabled=true;
        const end=performance.now()+motionSeconds*1000;
        while(performance.now()<end){check();reportStatus.textContent=`连续动态采样 · 剩余 ${Math.ceil((end-performance.now())/1000)} 秒`;await new Promise(resolve=>setTimeout(resolve,100));}
        setMotion('paused');pauseButton.disabled=true;await idle();if(timestampPending)await timestampPending;check();
        if(routeOverflow)throw Error('动态采样超过帧容量，请重试');motion=summarizeMotion(routeFrames);routeFrames=null;
      }
      // Each mode sees the same two poses in forward/reverse order. Every sampled
      // frame invalidates the active cube, even though the diagnostic pose is fixed.
      for(let round=0;round<roundCount;round++)for(const pose of benchmarkPoses.slice(0,poseCount)){
        const modes=[...dynamicShadowModes];
        for(const mode of (round%2?[...modes].reverse():modes)){
          check();
          benchmarkPhase=`${pose.name}/${round}/${mode}/prepare`;
          reportStatus.textContent=`对照 ${round+1}/${roundCount} · ${pose.name} · ${mode}`;
          camera.position.fromArray(pose.eye);controls.target.fromArray(pose.target);controls.update();
          movingLantern.seek(pose.seconds);movingLantern.setShadowMode(mode);request();await idle();
          // Settled variant: exclude graph construction, allocation and cold draws.
          for(let i=0;i<2;i++){movingLantern.invalidateShadow();await sampleOnce('diagnostic');}
          benchmarkPhase=`${pose.name}/${round}/${mode}/measure`;
          const frames:StreetFrameSample[]=[];
          for(let i=0;i<count;i++){check();movingLantern.invalidateShadow();const f=await sampleOnce('diagnostic');if(f.newPipelines||f.newPrograms)throw Error('对照期间仍有新建管线，请重试');frames.push(f);}
          rounds.push({pose:pose.name,mode,round,frames});
        }
      }
      check();benchmarkResult={version:1,startedAt:began,completedAt:new Date().toISOString(),target:{gpuMedianMs:3,gpuP95Ms:5},protocol:'continuous screen-shadow route then fixed poses; active cube invalidated every measured frame; forward/reverse variants; warm draws excluded',motion,rounds:summarizeBenchmark(rounds)};
      return benchmarkResult;
    }finally{
      document.removeEventListener('visibilitychange',onHidden);
      routeFrames=null;
      benchmarkPhase='';movingLantern.seek(saved.seconds);movingLantern.setShadowMode(saved.shadow);setLight(saved.light);
      camera.position.copy(saved.eye);controls.target.copy(saved.target);controls.update();continuous=saved.continuous;cadence.reset();setMotion(saved.mode);
      controls.enabled=true;buttons.forEach(b=>b.disabled=false);pauseButton.disabled=saved.mode==='off';benchmarkActive=false;request();
    }
  };
  benchmarkButton.addEventListener('click',async()=>{
    try{await (params.get('experiment')==='dynamic'?runBenchmark():runStaticBenchmark());await uploadReport();}catch(e){reportStatus.textContent=`对照失败：${describeError(e)}`;}
  });
  document.addEventListener('visibilitychange',()=>{movingLantern.motion.resetClock();cadence.reset();if(document.hidden){cancelAnimationFrame(raf);raf=0;}else request();});
  (window as any).__lightStudy={
    settle:idle,benchmark:runBenchmark,staticBenchmark:(seconds=30)=>runStaticBenchmark(seconds),loop:(enabled:boolean)=>{continuous=enabled;cadence.reset();request();return idle();},
    snapshot:()=>({ready:ready(),renderLoop:continuous?'continuous':'demand',cadence:cadence.snapshot(),movingLantern:movingLantern.snapshot(),warmup,renderer:'WebGPU',adapter:adapterInfo,model:{...model.stats,revision:model.revision,layoutRevision:__STREET_LAYOUT_REVISION__},materials:library.snapshot(),lighting:lighting.snapshot(),scene:'street',lightMode,view,camera:{position:camera.position.toArray(),target:controls.target.toArray()},render:counters,submitted,inFlight:inFlight>0,framesInFlight:inFlight,maxFramesInFlight,scheduler,benchmarkActive,benchmarkResult,skipped,cpuSubmitMs:cpu,completionMs,timestampEnabled:timing,canvasSamples:renderer.samples,canvasDepth:renderer.depth,gpuMs:gpu,gpuPassSumMs:gpuPassSum,gpuOverlapMs:gpuOverlap,gpuSampleCompletionMs,gpuTimingMethod:'earliest pass start to latest pass end',gpuSampleFrame,gpuPasses,samples:history.values(),historyFrames:history.size,errors:errors.slice(),bootMs:bootMs??performance.now()-started,viewport:{width:innerWidth,height:innerHeight,dpr:renderer.getPixelRatio(),bufferWidth:renderer.domElement.width,bufferHeight:renderer.domElement.height},memory:{...renderer.info.memory}}),
    view:(name:View)=>{setView(name);return idle();},light:(name:StreetLightMode)=>{setLight(name);return idle();},ao:(value:boolean)=>{aoEnabled=value;lighting.setAO(value);request();return idle();},
    softShadows:(value:boolean)=>{lighting.setSoftShadows(value);request();return idle();},
    orbit:(eye:[number,number,number],target:[number,number,number])=>{camera.position.fromArray(eye);controls.target.fromArray(target);controls.update();request();return idle();},
    motion:(mode:MotionMode)=>{setMotion(mode);return idle();},
    motionTime:(seconds:number)=>{setMotion('paused');movingLantern.seek(seconds);request();return idle();},
    dynamicShadow:(mode:DynamicShadowMode)=>{movingLantern.setShadowMode(mode);request();return idle();},
    shadowGeometry:(mode:'full'|'spatial')=>{if(!['full','spatial'].includes(mode))throw Error('Unknown shadow geometry');shadowGeometry=mode;lighting.screenShadow.setCasters(mode==='spatial'?shadowCasters.scene:scene,shadowCasters.stats);request();return idle();},
    draw:sampleOnce,capture:(value:boolean)=>document.body.classList.toggle('capture',value),
  };
  setView((params.get('view') as View)||'entrance');if(params.has('light'))setLight(params.get('light') as StreetLightMode);if(params.get('ao')==='0'){aoEnabled=false;lighting.setAO(false);}
  // Prepare the actual render graph for every resident mesh, including lanterns
  // outside the initial view. Restore normal frustum checks before interaction.
  const visibility=new Map<THREE.Object3D,boolean>();scene.traverse(o=>{if(o instanceof THREE.Mesh){visibility.set(o,o.frustumCulled);o.frustumCulled=false;}});
  const warmStart=performance.now(),pipelinesStart=backend.pipelineCreations,programsStart=backend.programCreations;
  try{
    for(let i=0;i<6;i++){
      const pipelines=backend.pipelineCreations,programs=backend.programCreations;
      renderer.info.reset();profiler.startFrame(false);lighting.render();await device.queue.onSubmittedWorkDone();warmup.frames++;
      if(errors.length)throw Error(errors.join('\n'));
      const state=lighting.snapshot();
      if(i>0&&pipelines===backend.pipelineCreations&&programs===backend.programCreations&&!state.sun.shadowNeedsUpdate&&state.lamps.every(l=>!l.shadowNeedsUpdate)&&(movingLantern.motion.mode==='off'||!movingLantern.snapshot().shadowNeedsUpdate))break;
      if(i===5)throw Error('场景管线与阴影未能完成准备');
    }
  }finally{visibility.forEach((value,o)=>o.frustumCulled=value);}
  warmup.newPipelines=backend.pipelineCreations-pipelinesStart;warmup.newPrograms=backend.programCreations-programsStart;warmup.ms=performance.now()-warmStart;
  booting=false;request();await idle();bootMs=performance.now()-started;loader.hidden=true;loadStage='场景运行';setMotion(initialMotion);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(raf);controls.dispose();profiler.dispose();movingLantern.dispose();lighting.dispose();shadowCasters.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});(ground.material as THREE.Material).dispose();model.dispose();library.dispose();renderer.dispose();},{once:true});
}
start().catch(fail);
