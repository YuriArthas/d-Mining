import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadBlockcraftAssets } from './assets.ts';
import { buildLandscape } from './landscape.ts';
import { batchStatic, useDiffuseLighting, materials } from './kit.ts';
import { createLighting } from './lighting.ts';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<div class="loading" role="status"><div class="mark">◇</div><h2>松风矿谷</h2><p id="load-status">沿着溪流，去山间看看。</p></div><div class="chrome"><header class="brand"><div class="eyebrow">PINEWIND QUARRY</div><h1>松风矿谷</h1><p>一座溪谷里的采矿小镇</p></header><a class="back" href="/">返回场景列表 ↗</a><div class="hint">拖动环视 · 滚轮靠近 · 右键平移</div><nav class="toolbar" aria-label="观景视角"><button data-view="overview" aria-pressed="true">矿镇全景</button><button data-view="bridge" aria-pressed="false">溪桥</button><button data-view="quarry" aria-pressed="false">矿井</button><button data-view="garden" aria-pressed="false">宠物小院</button><span class="separator"></span><button class="light" data-light="day" aria-pressed="true">晴日</button><button class="light" data-light="golden" aria-pressed="false">暖阳</button></nav><button class="metrics-toggle" aria-label="显示性能信息">性能</button><output class="metrics" aria-live="off"></output></div>`;
const loader=document.querySelector<HTMLDivElement>('.loading')!,status=document.querySelector('#load-status')!;
const views={
  overview:{eye:[31,29,58],target:[0,2,-5]},
  bridge:{eye:[12,12,50],target:[0,4,2]},
  quarry:{eye:[19,21,25],target:[0,4,-11]},
  garden:{eye:[26,9,23],target:[16,3.5,2]},
} as const;
type View=keyof typeof views;
const params=new URLSearchParams(location.search);
const errors:string[]=[];
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
async function start(){
  const boot=performance.now();
  let bootMs:number|null=null;
  if(!navigator.gpu)throw Error('此场景需要 WebGPU。请使用启用硬件加速的新版 Chrome 或 Edge 打开。');
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)throw Error('当前浏览器没有可用的 WebGPU 适配器。请检查硬件加速设置。');
  const adapterInfo={vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description};
  const device=await adapter.requestDevice({requiredFeatures:[...adapter.features] as GPUFeatureName[]});
  status.textContent='正在搭建矿镇与森林…';
  const options={antialias:true,alpha:false,powerPreference:'high-performance' as const,trackTimestamp:true};
  const backend=new THREE.WebGPUBackend({...options,device});const renderer=new THREE.Renderer(backend,options);renderer.library=new THREE.StandardNodeLibrary();
  renderer.onDeviceLost=(info)=>{errors.push(`Device lost: ${info.message}`);fail(Error('图形设备连接中断，请刷新场景。'));};
  renderer.onError=(info:unknown)=>{const message=typeof info==='string'?info:String((info as {message?:string}).message??info);errors.push(message);fail(Error(message));};
  await renderer.init();if(!backend.isWebGPUBackend)throw Error('场景未启用 WebGPU。');
  renderer.info.autoReset=false;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);app.prepend(renderer.domElement);
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','松风矿谷三维场景');
  const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.2,400);
  if(params.get('shading')!=='standard')useDiffuseLighting();
  status.textContent='正在载入矿镇模型与贴图…';
  const assets=await loadBlockcraftAssets();
  const authoring=new THREE.Group();const landscape=buildLandscape(assets.nature);authoring.add(assets.architecture,landscape.group);
  const built=batchStatic(authoring);scene.add(built.group);for(const water of landscape.water){scene.add(water);water.castShadow=false;water.receiveShadow=true;}
  const waterTriangles=landscape.water.reduce((n,mesh)=>n+(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,0);
  const geometry={...built.stats,waterTriangles,totalTriangles:built.stats.triangles+waterTriangles};
  const lighting=createLighting(renderer,scene,camera,materials.matte instanceof THREE.MeshLambertMaterial);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,2,-3);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=7;controls.maxDistance=145;controls.zoomSpeed=.75;controls.panSpeed=.65;
  let currentView:View='overview',dirty=true,inFlight=false,raf=0,disposed=false,submitted=0,skipped=0,lastCpu=0,lastGpu:number|null=null,metricsOpen=false;
  let timestampPending:Promise<void>|null=null,forceGpuSample=false,lastGpuFrame=0;
  const frameSamples:{frame:number,cpu:number,gpu:number|null,draws:number,triangles:number}[]=[];
  let metrics:any={};
  const renderMetrics=()=>{document.querySelector('.metrics')!.textContent=`WebGPU · ${adapterInfo.description||adapterInfo.architecture||adapterInfo.vendor}\n${geometry.totalTriangles.toLocaleString()} triangles · ${built.stats.batches} static batches\n${metrics.drawCalls??0} draws / ${metrics.frameCalls??0} passes\nNative resolution · textured models\nCPU submit ${lastCpu.toFixed(2)} ms · GPU sample ${lastGpu===null?'n/a':lastGpu.toFixed(2)+' ms'}\nGPU sample frame ${lastGpuFrame} · rendered ${submitted}\nTracked GPU buffers ${((renderer.info.memory.total||0)/1048576).toFixed(1)} MB\nIdle: render on demand`;
  };
  const request=()=>{dirty=true;if(!raf&&!inFlight&&!document.hidden&&!disposed)raf=requestAnimationFrame(render);};
  async function render(){
    raf=0;if(disposed||document.hidden||!dirty)return;
    if(inFlight){skipped++;return;}dirty=false;inFlight=true;
    try{
      renderer.info.reset();const begin=performance.now();lighting.render();lastCpu=performance.now()-begin;submitted++;
      metrics={...renderer.info.render};
      const sample={frame:submitted,cpu:lastCpu,gpu:null as number|null,draws:metrics.drawCalls,triangles:metrics.triangles};
      frameSamples.push(sample);if(frameSamples.length>180)frameSamples.shift();
      // Readback never owns the rendering gate. Tools explicitly await it when
      // measuring a frame; pointer interaction only waits for queue completion.
      if(renderer.hasFeature('timestamp-query')&&!timestampPending&&(forceGpuSample||submitted===1||submitted%15===0)){
        timestampPending=renderer.resolveTimestampsAsync('render').then(value=>{
          if(typeof value==='number'&&Number.isFinite(value)){sample.gpu=value;lastGpu=value;lastGpuFrame=sample.frame;}
          if(metricsOpen)renderMetrics();
        }).catch(error=>{errors.push(String(error));fail(error);}).finally(()=>{timestampPending=null;});
      }
      forceGpuSample=false;
      // Only one submitted scene frame at a time, even on a very slow adapter.
      await device.queue.onSubmittedWorkDone();
      if(metricsOpen)renderMetrics();
    }catch(error){errors.push(String(error));fail(error);}finally{inFlight=false;if(dirty)request();}
  }
  const setView=(name:View)=>{const view=views[name];if(!view)throw Error('Unknown view');currentView=name;camera.position.fromArray(view.eye);controls.target.fromArray(view.target);controls.update();for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===name));request();};
  controls.addEventListener('change',request);
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view as View));
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-light]'))button.addEventListener('click',()=>{lighting.setMode(button.dataset.light as 'day'|'golden');for(const b of document.querySelectorAll<HTMLButtonElement>('[data-light]'))b.setAttribute('aria-pressed',String(b===button));request();});
  document.querySelector('.metrics-toggle')!.addEventListener('click',()=>{metricsOpen=!metricsOpen;document.querySelector('.metrics')!.classList.toggle('open',metricsOpen);renderMetrics();});
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);request();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else request();});
  window.addEventListener('keydown',e=>{if(e.code==='KeyH'&&!(e.target instanceof HTMLInputElement))document.body.classList.toggle('capture');});
  const isReady=()=>submitted>0&&!inFlight;
  const waitIdle=()=>new Promise<void>((resolve,reject)=>{const start=performance.now();const poll=()=>{if(errors.length)reject(Error(errors.join('\n')));else if(isReady()&&!dirty)resolve();else if(performance.now()-start>180000)reject(Error('Render did not settle'));else setTimeout(poll,50);};poll();});
  (window as any).__surfaceStudy={
    snapshot:()=>({ready:isReady(),renderer:'WebGPU',adapter:adapterInfo,shading:materials.matte.type,view:currentView,camera:{position:camera.position.toArray(),target:controls.target.toArray()},geometry,assets:assets.snapshot(),lighting:lighting.snapshot(),render:metrics,memory:{...renderer.info.memory},submitted,inFlight,skipped,cpuSubmitMs:lastCpu,gpuMs:lastGpu,gpuSampleFrame:lastGpuFrame,samples:frameSamples.slice(),errors:errors.slice(),bootMs:bootMs??performance.now()-boot,viewport:{width:innerWidth,height:innerHeight,dpr:renderer.getPixelRatio()}}),
    view:(name:View)=>{setView(name);return waitIdle();},
    light:(name:'day'|'golden')=>{lighting.setMode(name);request();return waitIdle();},
    ao:(value:boolean)=>{lighting.setAO(value);request();return waitIdle();},
    tone:(value:'neutral'|'aces'|'linear')=>{lighting.setTone(value);request();return waitIdle();},
    draw:async()=>{await waitIdle();await timestampPending;forceGpuSample=true;request();await waitIdle();await timestampPending;},
    orbit:(eye:[number,number,number],target:[number,number,number])=>{camera.position.set(...eye);controls.target.set(...target);controls.update();request();return waitIdle();},
    capture:(value:boolean)=>document.body.classList.toggle('capture',value),
  };
  setView((params.get('view') as View)||'overview');
  if(params.get('ao')==='1')lighting.setAO(true);
  if(params.get('light')==='golden')lighting.setMode('golden');
  if(params.has('tone'))lighting.setTone(params.get('tone') as 'neutral'|'aces'|'linear');
  await waitIdle();bootMs=performance.now()-boot;loader.hidden=true;
  window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;cancelAnimationFrame(raf);controls.dispose();lighting.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});renderer.dispose();},{once:true});
}
function fail(error:unknown){loader.hidden=false;loader.classList.add('error');status.textContent=error instanceof Error?error.message:String(error);console.error(error);}
start().catch(fail);
