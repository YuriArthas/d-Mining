import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadMaterials} from './materials.ts';
import {loadCourtyard} from './model.ts';
import {createLighting,createFocusedLampGlass,type LightMode} from './lighting.ts';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<div class="loading" role="status"><h2>矿镇小院</h2><p id="status">正在准备石板与墙面的光影…</p></div><div class="chrome"><header class="brand"><div class="eyebrow">PINEWIND · LIGHT & MATERIAL</div><h1>矿镇小院</h1><p>石板 · 粉刷墙 · 日光与灯火</p></header><a class="back" href="./index.html">查看街景 ↗</a><span class="hint">拖动环视 · 滚轮靠近 · H 隐藏界面</span><nav class="toolbar" aria-label="光照与材质对照"><button data-view="courtyard" aria-pressed="true">小院</button><button data-view="ground" aria-pressed="false">石板</button><button data-view="wall" aria-pressed="false">墙角</button><span class="divider"></span><button data-light="day" aria-pressed="true">晴日</button><button data-light="golden" aria-pressed="false">暖阳</button><button data-light="night" aria-pressed="false">夜晚</button><span class="divider"></span><button data-detail="true" aria-pressed="true">表面细节</button><button data-detail="false" aria-pressed="false">纯色对照</button></nav><nav class="comparison" aria-label="夜景对照"><span>夜景对照</span><button data-study="baseline" aria-pressed="false">原版</button><button data-study="light" aria-pressed="false">只改光</button><button data-study="material" aria-pressed="false">只改材质</button><button data-study="both" aria-pressed="false">一起改</button></nav><button class="metrics-toggle" aria-label="显示性能信息">性能</button><output class="metrics"></output></div>`;
const loader=document.querySelector<HTMLDivElement>('.loading')!,status=document.querySelector('#status')!;
const params=new URLSearchParams(location.search),errors:string[]=[];
const views={courtyard:{eye:[9.6,7.8,12.4],target:[-.35,1.35,-.2]},ground:{eye:[6.7,3.9,8.2],target:[.5,.3,1.6]},wall:{eye:[4.5,3.1,6.8],target:[-1.3,1.85,-2.25]}} as const;
type View=keyof typeof views;
type Study='baseline'|'light'|'material'|'both';
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
function fail(error:unknown){loader.hidden=false;loader.classList.add('error');status.textContent=error instanceof Error?error.message:String(error);console.error(error);}
async function start(){
  const started=performance.now();
  if(!navigator.gpu)throw Error('此样板需要支持 WebGPU 的桌面 Chrome 或 Edge。');
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('当前浏览器没有可用的 WebGPU 图形适配器。');
  const device=await adapter.requestDevice({requiredFeatures:[...adapter.features] as GPUFeatureName[]});
  const adapterInfo={vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description};
  const options={antialias:true,alpha:false,trackTimestamp:true},backend=new THREE.WebGPUBackend({...options,device}),renderer=new THREE.Renderer(backend,options);renderer.library=new THREE.StandardNodeLibrary();
  renderer.onDeviceLost=info=>{errors.push(info.message);fail(Error('图形设备连接中断，请刷新样板。'));};
  renderer.onError=info=>{const message=String((info as {message?:string}).message??info);errors.push(message);fail(Error(message));};
  await renderer.init();if(!backend.isWebGPUBackend)throw Error('样板未启用 WebGPU。');
  renderer.info.autoReset=false;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);app.prepend(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','矿镇小院光照材质样板');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,250);
  const library=await loadMaterials();
  // Include the front of the solid wall in shadow depth. Back-face-only casting
  // places the blocker too near its rear plinth and leaks through the PCF/bias.
  library.materials.plaster_blue.shadowSide=THREE.DoubleSide;
  const focusedGlass=createFocusedLampGlass();
  const model=await loadCourtyard(library.materials,focusedGlass);scene.add(model.group);
  // A broad quiet setting leaves the authored stone and wall as the focal point.
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshStandardMaterial({color:'#b0b59d',roughness:.96}));ground.rotation.x=-Math.PI/2;ground.position.y=-.25;ground.receiveShadow=true;ground.layers.enable(1);scene.add(ground);
  const lighting=createLighting(renderer,scene,camera,library.materials.lampglass,focusedGlass);
  let study:Study='baseline',lightMode:LightMode='day';
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.485;controls.minDistance=3;controls.maxDistance=38;controls.zoomSpeed=.65;controls.panSpeed=.65;
  let dirty=true,inFlight=false,raf=0,disposed=false,submitted=0,skipped=0,view:View='courtyard',detailed=true,metricsOpen=false,bootMs:number|null=null;
  let cpu=0,gpu:number|null=null,gpuSampleFrame=0,forceSample=false,timestampPending:Promise<void>|null=null;
  let counters={drawCalls:0,triangles:0,frameCalls:0};
  const samples:{frame:number;cpu:number;gpu:number|null;draws:number;passes:number}[]=[];
  const drawMetrics=()=>{document.querySelector('.metrics')!.textContent=`WebGPU · ${adapterInfo.description||adapterInfo.architecture||adapterInfo.vendor}\n${model.stats.triangles.toLocaleString()} resident triangles / ${model.stats.batches} resident batches\n${counters.drawCalls} draws / ${counters.frameCalls} passes\nCPU submit ${cpu.toFixed(2)} ms\nGPU sample ${gpu===null?'n/a':gpu.toFixed(2)+' ms'} (frame ${gpuSampleFrame})\nRendered ${submitted} · idle stops drawing`;
  };
  const request=()=>{dirty=true;if(!raf&&!inFlight&&!document.hidden&&!disposed)raf=requestAnimationFrame(render);};
  async function render(){
    raf=0;if(disposed||document.hidden||!dirty)return;if(inFlight){skipped++;return;}dirty=false;inFlight=true;
    try{
      renderer.info.reset();const t=performance.now();lighting.render();cpu=performance.now()-t;submitted++;counters={...renderer.info.render};
      const sample={frame:submitted,cpu,gpu:null as number|null,draws:counters.drawCalls,passes:counters.frameCalls};samples.push(sample);if(samples.length>150)samples.shift();
      if(renderer.hasFeature('timestamp-query')&&!timestampPending&&(forceSample||submitted===1||submitted%15===0)){
        timestampPending=renderer.resolveTimestampsAsync('render').then(value=>{if(typeof value==='number'&&Number.isFinite(value)){sample.gpu=value;gpu=value;gpuSampleFrame=sample.frame;}if(metricsOpen)drawMetrics();}).catch(e=>{errors.push(String(e));fail(e);}).finally(()=>{timestampPending=null;});
      }
      forceSample=false;await device.queue.onSubmittedWorkDone();if(metricsOpen)drawMetrics();
    }catch(e){errors.push(String(e));fail(e);}finally{inFlight=false;if(dirty)request();}
  }
  const ready=()=>submitted>0&&!inFlight;
  const idle=()=>new Promise<void>((resolve,reject)=>{const since=performance.now();const poll=()=>{if(errors.length)reject(Error(errors.join('\n')));else if(ready()&&!dirty)resolve();else if(performance.now()-since>180000)reject(Error('Render did not settle'));else setTimeout(poll,50);};poll();});
  const setView=(name:View)=>{if(!views[name])throw Error('Unknown view');view=name;camera.position.fromArray(views[name].eye);controls.target.fromArray(views[name].target);controls.update();for(const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===name));request();};
  const applyStudy=()=>{
    const night=lightMode==='night',focused=night&&(study==='light'||study==='both');
    model.setFocused(focused);lighting.setVariant(focused?'focused':'baseline');
    library.setVariant(night&&(study==='material'||study==='both')?'crafted':'baseline');
    for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-study]'))button.setAttribute('aria-pressed',String(night&&button.dataset.study===study));
  };
  const setLight=(name:LightMode)=>{lighting.setMode(name);lightMode=name;applyStudy();document.body.dataset.light=name;(ground.material as THREE.MeshStandardMaterial).color.set(name==='night'?'#26364b':'#b0b59d');for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-light]'))button.setAttribute('aria-pressed',String(button.dataset.light===name));request();};
  const setDetail=(value:boolean)=>{detailed=value;library.setDetailed(value);for(const button of document.querySelectorAll<HTMLButtonElement>('[data-detail]'))button.setAttribute('aria-pressed',String(button.dataset.detail===String(value)));request();};
  const setStudy=(name:Study)=>{if(!['baseline','light','material','both'].includes(name))throw Error('Unknown study');study=name;setLight('night');};
  controls.addEventListener('change',request);
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view as View));
  for(const b of document.querySelectorAll<HTMLButtonElement>('button[data-light]'))b.addEventListener('click',()=>setLight(b.dataset.light as LightMode));
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-detail]'))b.addEventListener('click',()=>setDetail(b.dataset.detail==='true'));
  for(const b of document.querySelectorAll<HTMLButtonElement>('button[data-study]'))b.addEventListener('click',()=>setStudy(b.dataset.study as Study));
  document.querySelector('.metrics-toggle')!.addEventListener('click',()=>{metricsOpen=!metricsOpen;document.querySelector('.metrics')!.classList.toggle('open',metricsOpen);drawMetrics();});
  window.addEventListener('keydown',e=>{if(e.code==='KeyH')document.body.classList.toggle('capture');});
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);request();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else request();});
  (window as any).__lightStudy={
    snapshot:()=>({ready:ready(),renderer:'WebGPU',adapter:adapterInfo,model:{...model.stats,revision:model.revision,lampRevision:model.lampRevision},materials:library.snapshot(),lighting:lighting.snapshot(),study,fixture:model.fixture(),view,detailed,camera:{position:camera.position.toArray(),target:controls.target.toArray()},render:counters,submitted,inFlight,skipped,cpuSubmitMs:cpu,gpuMs:gpu,gpuSampleFrame,samples:samples.slice(),errors:errors.slice(),bootMs:bootMs??performance.now()-started,viewport:{width:innerWidth,height:innerHeight,dpr:renderer.getPixelRatio()},memory:{...renderer.info.memory}}),
    study:(name:Study)=>{setStudy(name);return idle();},view:(name:View)=>{setView(name);return idle();},light:(name:LightMode)=>{setLight(name);return idle();},detail:(value:boolean)=>{setDetail(value);return idle();},ao:(value:boolean)=>{lighting.setAO(value);request();return idle();},
    softShadows:(value:boolean)=>{lighting.setSoftShadows(value);request();return idle();},
    orbit:(eye:[number,number,number],target:[number,number,number])=>{camera.position.fromArray(eye);controls.target.fromArray(target);controls.update();request();return idle();},
    draw:async()=>{await idle();await timestampPending;forceSample=true;request();await idle();await timestampPending;},capture:(value:boolean)=>document.body.classList.toggle('capture',value),
  };
  setView((params.get('view') as View)||'courtyard');if(params.has('light'))setLight(params.get('light') as LightMode);if(params.has('study'))setStudy(params.get('study') as Study);if(params.get('detail')==='0')setDetail(false);if(params.get('ao')==='0')lighting.setAO(false);
  await idle();bootMs=performance.now()-started;loader.hidden=true;
  window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(raf);controls.dispose();lighting.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});(ground.material as THREE.Material).dispose();focusedGlass.dispose();library.dispose();renderer.dispose();},{once:true});
}
start().catch(fail);
