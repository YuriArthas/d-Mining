import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadMaterials} from './materials.ts';
import {loadDistrict} from './districtModel.ts';
import {createDistrictLighting,type StreetLightMode,type StreetProbe,type DistrictPipeline} from './districtLighting.ts';
import {StreetProfiler,StreetGPUBackend,type PassTiming} from './streetProfiler.ts';
import {ResourceLoadError,describeError} from './resourceLoading.ts';
import {sendPerformanceReport,type StreetFrameSample,type FrameContext} from './performanceReport.ts';
import {PerformanceHistory,settingsOf,statistics,type FrameReason} from './performanceHistory.ts';
import {FrameCadence,summarizeIntervals} from './frameCadence.ts';
import {DistrictTour,districtPose,TOUR_PERIOD,TOUR_LENGTH} from './districtRoute.ts';
import {sameBenchmarkCamera} from './districtBenchmark.ts';
import {districtComparisonVariants,balancedDistrictOrder,type DistrictDiagnostic} from './districtVariants.ts';
import {emissive,materialColor,vec3,vec4,Fn} from 'three/tsl';
import './style.css';
const app=document.querySelector<HTMLDivElement>('#app')!;
document.body.dataset.light='night';document.body.classList.add('street');
app.innerHTML=`<div class="loading" role="status"><h2>松风四坊</h2><p id="status">正在点亮街边的灯火…</p></div><div class="chrome"><header class="brand"><div class="eyebrow">PINEWIND · FOUR QUARTERS</div><h1>松风四坊</h1><p>环街灯火 · 四坊相连</p></header><a class="back" href="/">游戏列表 ↗</a><span class="hint">拖动环视 · 滚轮靠近 · H 隐藏界面</span><nav class="toolbar" aria-label="街区与光照"><button data-view="overview" aria-pressed="true">全景</button><button data-view="entrance">街口</button><button data-view="walk">街中</button><button data-view="lamp">转角</button><button class="tour-toggle" aria-pressed="false">巡游</button><span class="divider"></span><button data-light="night" aria-pressed="true">夜晚</button><button data-light="day">晴日</button></nav><button class="metrics-toggle" aria-label="显示性能信息">性能</button><section class="metrics" aria-label="性能信息"><div class="report-actions"><button class="report-performance" type="button">上报性能</button><button class="benchmark-performance" type="button">巡游 30 秒并上报</button><button class="static-benchmark" type="button">定点 30 秒并上报</button><button class="compare-performance" type="button">优化对照并上报（约 2 分钟）</button><button class="pipeline-toggle" type="button">查看旧管线</button><span class="report-status" role="status">保留最近 1800 帧；观察后上报一次即可</span></div><output class="metrics-values"></output></section></div>`;
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
const views={overview:{eye:[50,47,55],target:[0,0,0]},entrance:{eye:[1.6,5,30],target:[0,2,-12]},walk:{eye:[.8,2.65,11.5],target:[0,2.3,-15]},lamp:{eye:[6,3,1],target:[0,1.3,9]}} as const;
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
  const renderMode=params.get('render')??'optimized';
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
  const shaderPrograms:unknown[]=[];if(params.has('debug-shaders')){const create=backend.createProgram.bind(backend);backend.createProgram=program=>{shaderPrograms.push(program);create(program);};}
  renderer.onDeviceLost=info=>{errors.push(info.message);fail(Error('图形设备连接中断，请刷新样板。'));};
  renderer.onError=info=>{const message=String((info as {message?:string}).message??info);errors.push(message);fail(Error(message));};
  await renderer.init();if(!backend.isWebGPUBackend)throw Error('样板未启用 WebGPU。');
  renderer.info.autoReset=false;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);app.prepend(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','松风四坊光照样板');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,250);
  setStage('加载材质');
  const library=await loadMaterials(['crafted']);
  library.setVariant('crafted');
  setStage('加载街景模型');
  const model=await loadDistrict(library.materials);scene.add(model.group);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshStandardNodeMaterial({color:'#26364b',roughness:.96}));ground.rotation.x=-Math.PI/2;ground.position.y=-.29;ground.receiveShadow=true;scene.add(ground);
  const probe=(params.get('probe')??'none') as StreetProbe;
  if(!['reference','optimized'].includes(renderMode)||!['none','single-output','no-msaa','no-environment','single-sample-normals'].includes(probe))throw Error('Unknown district rendering diagnostic');
  setStage('构建街区光照');
  const lighting=createDistrictLighting(renderer,scene,camera,model.layout.lamps,model.glass,model.windowglass,{optimized:renderMode==='optimized',probe,post:postMode as 'reference'|'optimized'},model.setBakedEnabled,(params.get('pipeline')??(probe==='none'&&renderMode==='optimized'?'static':'reference')) as DistrictPipeline);
  const shadowReceivers=new Map<THREE.Mesh,boolean>();scene.traverse(object=>{if(object instanceof THREE.Mesh)shadowReceivers.set(object,object.receiveShadow);});
  const groundMaterial=ground.material;
  const groundDiagnostic=Fn(()=>{emissive.assign(vec3(0));return vec4(materialColor.rgb,1);})();
  const setDiagnostic=(value:DistrictDiagnostic)=>{
    if(value==='baked-material'&&lightMode!=='night')throw Error('烘焙材质诊断仅用于夜晚');
    // Keep the static light's cached shadow node alive. castShadow=false would
    // dispose it in r186 and complicate exact restoration after diagnostics.
    shadowReceivers.forEach((enabled,mesh)=>{mesh.receiveShadow=value==='no-shadow'?false:enabled;});
    model.setBakedMaterialDiagnostic(value==='baked-material');
    const fragment=value==='baked-material'?groundDiagnostic:null;
    if(groundMaterial.fragmentNode!==fragment){groundMaterial.fragmentNode=fragment;groundMaterial.needsUpdate=true;}
    lighting.setDiagnostic(value);
  };
  const profiler=new StreetProfiler(device,timing);profiler.targets=lighting.profileTargets;renderer.inspector=profiler;backend.frameProfiler=profiler;
  let lightMode:StreetLightMode='night',aoEnabled=true;
  let continuous=params.get('loop')!=='demand';
  const cadence=new FrameCadence(),tour=new DistrictTour();
  const isContinuous=()=>continuous||tour.running;
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.485;controls.minDistance=2;controls.maxDistance=140;controls.zoomSpeed=.65;controls.panSpeed=.65;
  const applyTourPose=(pose:ReturnType<typeof districtPose>)=>{camera.position.fromArray(pose.eye);controls.target.fromArray(pose.target);controls.update();};
  let dirty=true,inFlight=0,raf=0,disposed=false,booting=true,submitted=0,completed=0,skipped=0,view:View|'tour'='overview',metricsOpen=false,bootMs:number|null=null;
  let gpuRequestedAt=-Infinity;
  let cpu=0,completionMs=0,gpuSampleCompletionMs:number|null=null,gpu:number|null=null,gpuPassSum:number|null=null,gpuOverlap:number|null=null,gpuSampleFrame=0,forceSample=false,timestampPending:Promise<void>|null=null;
  let gpuPasses:PassTiming[]=[];
  let counters={drawCalls:0,triangles:0,frameCalls:0};
  const history=new PerformanceHistory(),sessionId=crypto.randomUUID();
  let forcedReason:FrameReason='diagnostic',previousSettings='';
  let sampleRequest:{reason:FrameReason;assigned:boolean;resolve:(sample:StreetFrameSample)=>void;reject:(error:unknown)=>void}|null=null;
  const warmup:{frames:number;newPipelines:number;newPrograms:number;ms:number}={frames:0,newPipelines:0,newPrograms:0,ms:0};
  let comparisonActive=false,comparisonRound='';
  let benchmarkActive=false,benchmarkPhase='',benchmarkResult:unknown=null;
  let routeFrames:StreetFrameSample[]|null=null,routeOverflow=false;
  const frameContext=():FrameContext=>({pipeline:lighting.snapshot().pipeline,materialDiagnostic:lighting.snapshot().materialDiagnostic,scheduler,benchmarkPhase,renderLoop:continuous?'continuous':'demand',cameraMotion:tour.running?'tour':'orbit',motion:'off',movingLight:{seconds:0,position:[0,0,0]},lightMode,view,renderMode,postMode,probe,ao:aoEnabled,shadowMode:'combined static lamp irradiance',camera:{position:camera.position.toArray(),target:controls.target.toArray()},viewport:{width:innerWidth,height:innerHeight,dpr:renderer.getPixelRatio(),bufferWidth:renderer.domElement.width,bufferHeight:renderer.domElement.height}});
  let metricsDrawnAt=-Infinity;
  const drawMetrics=(force=false)=>{if(!force&&performance.now()-metricsDrawnAt<250)return;metricsDrawnAt=performance.now();document.querySelector('.metrics-values')!.textContent=`WebGPU · ${adapterInfo.description||adapterInfo.architecture||adapterInfo.vendor}\n${model.stats.triangles.toLocaleString()} street triangles / ${model.stats.batches} street batches\n${renderer.domElement.width} × ${renderer.domElement.height} pixels · DPR ${renderer.getPixelRatio()}\n${lighting.snapshot().shadowMode}\n${renderMode==='optimized'?'Optimized lighting':'Reference lighting'} · post ${postMode}\nPipeline ${lighting.snapshot().pipeline} · ${lighting.snapshot().contactAO}\nDiagnostic ${lighting.snapshot().materialDiagnostic}\n${counters.drawCalls} draws / ${counters.frameCalls} passes\nRender FPS ${cadence.snapshot().fps?.toFixed(1)??'n/a'} · interval P95 ${cadence.snapshot().intervalMs.p95?.toFixed(2)??'n/a'} ms\nCPU submit ${cpu.toFixed(2)} ms\nSubmit → complete ${(gpuSampleCompletionMs??completionMs).toFixed(2)} ms (frame ${gpuSampleCompletionMs===null?submitted:gpuSampleFrame})\nGPU frame span ${!timing?'disabled':gpu===null?'n/a':gpu.toFixed(2)+' ms'} (frame ${gpuSampleFrame})\nPass sum ${gpuPassSum===null?'n/a':gpuPassSum.toFixed(2)} ms · overlap ${gpuOverlap===null?'n/a':gpuOverlap.toFixed(2)} ms\n${gpuPasses.map(p=>p.label+': '+p.ms.toFixed(2)+' ms').join('\n')}\nHistory ${history.size} / 1800 frames · GPU every 15 frames (benchmark: 250 ms)\nStatic lamps: 12 baked · realtime point lights: 0\nCamera: ${tour.running?'tour':'orbit'}\n${scheduler} · ${inFlight}/${maxFramesInFlight} frames in flight\nRendered ${submitted} · ${isContinuous()?'continuous frames':'on demand'}`;
  };
    const request=()=>{dirty=true;if(!booting&&!raf&&inFlight<maxFramesInFlight&&!document.hidden&&!disposed&&!errors.length)raf=requestAnimationFrame(render);};
  function render(){
    raf=0;if(disposed||booting||document.hidden||!dirty||errors.length)return;if(inFlight>=maxFramesInFlight){skipped++;return;}dirty=false;inFlight++;
    try{
      if(tour.running)applyTourPose(tour.tick(performance.now()));if(isContinuous())cadence.add(performance.now());
      const job=sampleRequest&&!sampleRequest.assigned&&(!profiler.supported||!timestampPending)?sampleRequest:null;
      if(job)job.assigned=true;
      const capture=profiler.supported&&!timestampPending&&(!!job||forceSample||submitted===0||(routeFrames!==null?performance.now()-gpuRequestedAt>=250:(submitted+1)%15===0));
      if(capture)gpuRequestedAt=performance.now();
      const context=frameContext(),settings=JSON.stringify(settingsOf(context));
      const reason:FrameReason=submitted===0?'startup':job?job.reason:forceSample?forcedReason:settings!==previousSettings?'settings':tour.running?'animation':'interaction';previousSettings=settings;
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
        scene:{benchmark:benchmarkResult,frameScheduling:{scheduler,maxFramesInFlight,renderLoop:continuous?'continuous':'demand',cadence:cadence.snapshot()},model:{...model.stats,revision:model.revision,layoutRevision:__DISTRICT_LAYOUT_REVISION__},lighting:lighting.snapshot(),memory:{...renderer.info.memory},bootMs,warmup,district:{blocks:4,houses:16,staticLamps:12,lightmap:model.lightmap},tour:{running:tour.running,seconds:tour.seconds,periodSeconds:TOUR_PERIOD,lengthMetres:TOUR_LENGTH},errors:errors.slice()},
        latestFrame,...capturedHistory,
      });
      reportStatus.dataset.reportId=receipt.id;reportStatus.textContent=`已上报 · ${capturedHistory.history.frameCount} 帧 / ${capturedHistory.history.gpuSampleCount} 次 GPU · ${receipt.id.slice(0,8)}`;reportButton.textContent='再次上报';
    }catch(error){reportStatus.textContent=`上报失败：${describeError(error)}。请重试。`;reportButton.textContent='重试上报';}
    finally{reportButton.disabled=false;}
  };
  reportButton.addEventListener('click',()=>void uploadReport());

  const tourButton=document.querySelector<HTMLButtonElement>('.tour-toggle')!;
  const setTour=(value:boolean,reset=false)=>{if(reset)tour.seek(0);tour.setRunning(value);controls.enabled=!value&&!benchmarkActive&&!comparisonActive;tourButton.textContent=value?'停止巡游':'巡游';tourButton.setAttribute('aria-pressed',String(value));if(value){view='tour';applyTourPose(districtPose(tour.seconds));}for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view&&!value));cadence.reset();request();};
  const setView=(name:View)=>{if(!views[name])throw Error('Unknown view');setTour(false);view=name;camera.position.fromArray(views[name].eye);controls.target.fromArray(views[name].target);controls.update();for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===name));request();};
  const setLight=(name:StreetLightMode)=>{lighting.setMode(name);lightMode=name;document.body.dataset.light=name;groundMaterial.color.set(name==='night'?'#26364b':'#b0b59d');for(const b of document.querySelectorAll<HTMLButtonElement>('[data-light]'))b.setAttribute('aria-pressed',String(b.dataset.light===name));request();};
  controls.addEventListener('change',request);
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view as View));
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-light]'))b.addEventListener('click',()=>setLight(b.dataset.light as StreetLightMode));
  tourButton.addEventListener('click',()=>setTour(!tour.running));
  document.querySelector('.metrics-toggle')!.addEventListener('click',()=>{metricsOpen=!metricsOpen;document.querySelector('.metrics')!.classList.toggle('open',metricsOpen);drawMetrics(true);if(metricsOpen){forcedReason='metrics';forceSample=true;request();}});
  window.addEventListener('keydown',event=>{if(event.code==='KeyH')document.body.classList.toggle('capture');});
  window.addEventListener('resize',()=>{cadence.reset();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);request();});
  const runBenchmark=async(kind:'tour'|'static',seconds=30,withinComparison=false)=>{
    if(benchmarkActive||sampleRequest||(comparisonActive&&!withinComparison))throw Error('已有采样正在进行');
    if(!Number.isFinite(seconds)||seconds<1||seconds>30)throw Error('Invalid measurement duration');
    const saved={continuous,tour:tour.running,time:tour.seconds,view,eye:camera.position.clone(),target:controls.target.clone()};
    const buttons=[...document.querySelectorAll<HTMLButtonElement>('.toolbar button,.report-actions button')];
    const initialContext=frameContext(),viewport=JSON.stringify(initialContext.viewport);let interrupted=false;
    const onHidden=()=>{if(document.hidden)interrupted=true;};
    const check=()=>{if(interrupted||document.hidden)throw Error('测量被切到后台，请保持页面可见后重试');if(JSON.stringify(frameContext().viewport)!==viewport)throw Error('测量期间窗口尺寸改变，请重试');if(kind==='static'&&!sameBenchmarkCamera(frameContext().camera,initialContext.camera))throw Error('测量期间相机改变，请重试');if(['pipeline','materialDiagnostic','lightMode','ao'].some(k=>frameContext()[k as keyof FrameContext]!==initialContext[k as keyof FrameContext]))throw Error('测量期间画面设置改变，请重试');};
    benchmarkActive=true;benchmarkResult=null;buttons.forEach(b=>b.disabled=true);controls.enabled=false;document.addEventListener('visibilitychange',onHidden);
    try{
      continuous=false;setTour(false);await idle();if(timestampPending)await timestampPending;
      if(kind==='tour'){tour.seek(0);view='tour';applyTourPose(districtPose(0));}
      // Switching a shader variant may need preparation even when its post
      // graph was used before. None of these frames enter the measurement.
      for(let i=0;i<6;i++){const f=await sampleOnce('diagnostic');check();if(i>0&&!f.newPipelines&&!f.newPrograms)break;if(i===5)throw Error('管线未能完成准备');}
      routeFrames=[];routeOverflow=false;benchmarkPhase=`${comparisonRound}${kind}/measure`;continuous=true;
      if(kind==='tour')setTour(true,true);cadence.reset();request();
      const end=performance.now()+seconds*1000;
      while(performance.now()<end){check();reportStatus.textContent=`${comparisonRound}${kind==='tour'?'固定路线巡游':'静态定点'}测量 · 剩余 ${Math.ceil((end-performance.now())/1000)} 秒`;await new Promise(resolve=>setTimeout(resolve,100));}
      continuous=false;setTour(false);await idle();if(timestampPending)await timestampPending;check();if(routeOverflow)throw Error('采样超过帧容量');
      const frames=routeFrames.filter(f=>f.startedAtMs<=end&&f.reason===(kind==='tour'?'animation':'interaction'));
      if(frames.length<2)throw Error('完整渲染帧不足，请延长测量');
      if(frames.some(f=>f.newPipelines||f.newPrograms))throw Error('测量期间仍有新建管线，请重试');
      const intervals=frames.slice(1).map((f,i)=>f.startedAtMs-frames[i].startedAtMs);
      const result={type:kind==='tour'?'district-tour':'static-continuous',seconds,frameCount:frames.length,route:kind==='tour'?{periodSeconds:TOUR_PERIOD,lengthMetres:TOUR_LENGTH}:null,cadence:summarizeIntervals(intervals),gpu:statistics(frames.map(f=>f.gpu)),cpu:statistics(frames.map(f=>f.cpu)),completion:statistics(frames.map(f=>f.completionMs)),context:frames[0].context,validation:{newPipelines:0,newPrograms:0,conditionsStable:true},gpuFrames:frames.filter(f=>f.gpu!==null),frameIntervalsMs:intervals};
      benchmarkResult=result;return result;
    }finally{
      document.removeEventListener('visibilitychange',onHidden);routeFrames=null;benchmarkPhase='';continuous=saved.continuous;tour.seek(saved.time);view=saved.view;camera.position.copy(saved.eye);controls.target.copy(saved.target);controls.update();benchmarkActive=false;setTour(saved.tour);buttons.forEach(b=>b.disabled=comparisonActive);cadence.reset();request();
    }
  };
  const pipelineButton=document.querySelector<HTMLButtonElement>('.pipeline-toggle')!;
  pipelineButton.textContent=lighting.snapshot().pipeline==='static'?'查看旧管线':'查看新管线';
  const setPipeline=(value:DistrictPipeline)=>{lighting.setPipeline(value);pipelineButton.textContent=value==='static'?'查看旧管线':'查看新管线';cadence.reset();request();};
  pipelineButton.addEventListener('click',()=>setPipeline(lighting.snapshot().pipeline==='static'?'reference':'static'));
  const runComparison=async(seconds=8)=>{
    if(comparisonActive||benchmarkActive||sampleRequest)throw Error('已有采样正在进行');
    if(!Number.isFinite(seconds)||seconds<1||seconds>30)throw Error('Invalid comparison duration');
    if(probe!=='none'||renderMode!=='optimized'||postMode!=='optimized')throw Error('分项对照需要默认渲染设置，请移除诊断网址参数');
    const saved={pipeline:lighting.snapshot().pipeline,diagnostic:lighting.snapshot().materialDiagnostic,continuous,tour:tour.running};
    let interrupted=false;const onHidden=()=>{if(document.hidden)interrupted=true;};document.addEventListener('visibilitychange',onHidden);
    const buttons=[...document.querySelectorAll<HTMLButtonElement>('.toolbar button,.report-actions button')];
    comparisonActive=true;benchmarkResult=null;delete reportStatus.dataset.reportId;buttons.forEach(b=>b.disabled=true);controls.enabled=false;
    try{
      continuous=false;setTour(false);await idle();if(timestampPending)await timestampPending;
      const viewport=JSON.stringify(frameContext().viewport),cameraPose=frameContext().camera;
      const variants=districtComparisonVariants(lightMode),order=balancedDistrictOrder(variants);
      const check=()=>{
        if(interrupted||document.hidden)throw Error('对照被切到后台，请重试');
        if(JSON.stringify(frameContext().viewport)!==viewport||!sameBenchmarkCamera(frameContext().camera,cameraPose))throw Error('对照条件发生改变，请重试');
      };
      // Warm every resident material, including variants off-screen at this pose.
      // The entire suite uses one fixed camera, resolution and static light state.
      for(const variant of variants){
        check();setPipeline(variant.pipeline);setDiagnostic(variant.diagnostic);reportStatus.textContent=`正在准备：${variant.label}…`;
        const visibility=new Map<THREE.Object3D,boolean>();scene.traverse(object=>{if(object instanceof THREE.Mesh){visibility.set(object,object.frustumCulled);object.frustumCulled=false;}});
        try{for(let i=0;i<6;i++){const stable=await sampleOnce();check();if(i>0&&!stable.newPipelines&&!stable.newPrograms)break;if(i===5)throw Error('管线未能完成准备');}}
        finally{visibility.forEach((value,object)=>{object.frustumCulled=value;});}
      }
      const rounds:(Awaited<ReturnType<typeof runBenchmark>>&{variant:string;round:number;lighting:ReturnType<typeof lighting.snapshot>})[]=[];
      // Forward/reverse order places each variant symmetrically in time. Every
      // diagnostic removes one feature from static, not from the previous arm.
      for(const [i,variant] of order.entries()){
        check();comparisonRound=`${i+1}/${order.length} ${variant.label} · `;setPipeline(variant.pipeline);setDiagnostic(variant.diagnostic);
        rounds.push({variant:variant.id,round:i+1,...await runBenchmark('static',seconds,true),lighting:lighting.snapshot()});
        check();
      }
      const summary=(id:string)=>{
        const selected=rounds.filter(r=>r.variant===id),frames=selected.flatMap(r=>r.gpuFrames);
        return {gpu:statistics(frames.map(f=>f.gpu)),rounds:selected.map(r=>r.round),sampleFrames:frames.map(f=>f.frame)};
      };
      const reference=summary('fused'),optimized=summary('static');
      benchmarkResult={type:'district-cost-comparison',protocol:'Fixed camera; warmed variants in forward/reverse order; diagnostic removals are not final quality modes',secondsPerRound:seconds,target:{medianMs:3,p95Ms:5},baselineVariant:'fused',optimizedVariant:'static',variants:variants.map(v=>({...v,...summary(v.id)})),reference,optimized,medianImprovementPercent:reference.gpu.median&&optimized.gpu.median!==null?100*(1-optimized.gpu.median/reference.gpu.median):null,rounds};
      return benchmarkResult;
    }catch(error){benchmarkResult=null;throw error;}finally{
      document.removeEventListener('visibilitychange',onHidden);comparisonRound='';comparisonActive=false;setDiagnostic(saved.diagnostic);setPipeline(saved.pipeline);continuous=saved.continuous;setTour(saved.tour);buttons.forEach(b=>b.disabled=false);controls.enabled=!saved.tour;cadence.reset();request();
    }
  };
  document.querySelector('.compare-performance')!.addEventListener('click',async()=>{try{await runComparison();await uploadReport();}catch(error){reportStatus.textContent=`对照失败：${describeError(error)}`;}});
  for(const [selector,kind] of [['.benchmark-performance','tour'],['.static-benchmark','static']] as const)document.querySelector(selector)!.addEventListener('click',async()=>{try{await runBenchmark(kind);await uploadReport();}catch(error){reportStatus.textContent=`测量失败：${describeError(error)}`;}});
  document.addEventListener('visibilitychange',()=>{tour.resetClock();cadence.reset();if(document.hidden){cancelAnimationFrame(raf);raf=0;}else request();});
  (window as any).__lightStudy={
    settle:idle,shaders:()=>shaderPrograms.map(p=>({...p as object})),comparison:runComparison,diagnostic:(value:DistrictDiagnostic)=>{setDiagnostic(value);request();return idle();},pipeline:(value:DistrictPipeline)=>{setPipeline(value);return idle();},benchmark:(seconds=30)=>runBenchmark('tour',seconds),staticBenchmark:(seconds=30)=>runBenchmark('static',seconds),
    loop:(enabled:boolean)=>{continuous=enabled;cadence.reset();request();return idle();},
    snapshot:()=>({ready:ready(),scene:'district',renderLoop:continuous?'continuous':'demand',cadence:cadence.snapshot(),tour:{running:tour.running,seconds:tour.seconds,periodSeconds:TOUR_PERIOD,lengthMetres:TOUR_LENGTH},warmup,renderer:'WebGPU',adapter:adapterInfo,model:{...model.stats,revision:model.revision,layoutRevision:__DISTRICT_LAYOUT_REVISION__},materials:library.snapshot(),lightmap:model.lightmap,lighting:lighting.snapshot(),lightMode,view,camera:{position:camera.position.toArray(),target:controls.target.toArray()},render:counters,submitted,inFlight:inFlight>0,framesInFlight:inFlight,maxFramesInFlight,scheduler,benchmarkActive,comparisonActive,benchmarkResult,skipped,cpuSubmitMs:cpu,completionMs,timestampEnabled:timing,gpuMs:gpu,gpuPassSumMs:gpuPassSum,gpuOverlapMs:gpuOverlap,gpuSampleFrame,gpuPasses,samples:history.values(),historyFrames:history.size,errors:errors.slice(),bootMs:bootMs??performance.now()-started,viewport:frameContext().viewport,memory:{...renderer.info.memory}}),
    view:(name:View)=>{setView(name);return idle();},light:(name:StreetLightMode)=>{setLight(name);return idle();},
    ao:(value:boolean)=>{aoEnabled=value;lighting.setAO(value);request();return idle();},
    orbit:(eye:[number,number,number],target:[number,number,number])=>{setTour(false);camera.position.fromArray(eye);controls.target.fromArray(target);controls.update();request();return idle();},
    tour:(value:boolean)=>{setTour(value);return idle();},routeTime:(seconds:number)=>{setTour(false);tour.seek(seconds);view='tour';applyTourPose(districtPose(seconds));request();return idle();},
    draw:sampleOnce,capture:(value:boolean)=>document.body.classList.toggle('capture',value),
  };
  setView((params.get('view') as View)||'overview');if(params.has('light'))setLight(params.get('light') as StreetLightMode);
  if(params.get('ao')==='0'){aoEnabled=false;lighting.setAO(false);}
  // Warm every resident material/pass combination before an orbit or tour can
  // reveal it. Frustum culling resumes immediately afterwards; nothing unloads.
  const visibility=new Map<THREE.Object3D,boolean>();scene.traverse(object=>{if(object instanceof THREE.Mesh){visibility.set(object,object.frustumCulled);object.frustumCulled=false;}});
  const warmStart=performance.now(),pipelinesStart=backend.pipelineCreations,programsStart=backend.programCreations;
  try{
    for(let i=0;i<6;i++){
      const pipelines=backend.pipelineCreations,programs=backend.programCreations;
      renderer.info.reset();profiler.startFrame(false);lighting.render();await device.queue.onSubmittedWorkDone();warmup.frames++;
      if(errors.length)throw Error(errors.join('\n'));
      if(i>0&&pipelines===backend.pipelineCreations&&programs===backend.programCreations&&!lighting.snapshot().sun.shadowNeedsUpdate)break;
      if(i===5)throw Error('街区管线与阴影未能完成准备');
    }
  }finally{visibility.forEach((value,object)=>{object.frustumCulled=value;});}
  warmup.newPipelines=backend.pipelineCreations-pipelinesStart;warmup.newPrograms=backend.programCreations-programsStart;warmup.ms=performance.now()-warmStart;
  booting=false;request();await idle();bootMs=performance.now()-started;loader.hidden=true;loadStage='街区运行';
  if(params.get('tour')==='1')setTour(true,true);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(raf);controls.dispose();profiler.dispose();lighting.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});(ground.material as THREE.Material).dispose();model.dispose();library.dispose();renderer.dispose();},{once:true});
}
start().catch(fail);
