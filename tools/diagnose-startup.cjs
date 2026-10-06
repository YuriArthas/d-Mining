const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises');
(async()=>{
 const dir=process.env.OUT_DIR||'artifacts/startup-audit';await fs.mkdir(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
   performance.setResourceTimingBufferSize(2000);
   const audit=window.__startupAudit={gl:{},shaders:[],fences:[],workers:[],slowGL:[],raf:[],longTasks:[],status:[],finished:0};
   new PerformanceObserver(list=>{for(const e of list.getEntries())audit.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
   let last='';new MutationObserver(()=>{const s=document.querySelector('.stage-label')?.textContent;if(s&&s!==last){last=s;audit.status.push({at:performance.now(),text:s});}}).observe(document,{subtree:true,childList:true,characterData:true});
   const proto=WebGL2RenderingContext.prototype;
   for(const name of ['compileShader','linkProgram','getProgramParameter','getProgramInfoLog','getShaderInfoLog','getShaderParameter','getUniformLocation','getAttribLocation','texImage2D','texSubImage2D','compressedTexImage2D','compressedTexSubImage2D','bufferData','bufferSubData','clientWaitSync','finish','flush','drawElements','drawArrays','drawElementsInstanced']){
    const fn=proto[name];if(!fn)continue;
    proto[name]=function(...args){const start=performance.now();try{return fn.apply(this,args);}finally{if(!audit.finished){const ms=performance.now()-start,s=audit.gl[name]??={calls:0,totalMs:0,maxMs:0};s.calls++;s.totalMs+=ms;s.maxMs=Math.max(s.maxMs,ms);if(ms>4)audit.slowGL.push({name,start,ms});}}};
   }
   const shaderSource=proto.shaderSource;
   proto.shaderSource=function(shader,source){audit.shaders.push({bytes:source.length,lines:source.split('\n').length,fragment:source.includes('gl_FragColor'),compact:source.includes('i < miningSpotCount'),directCalls:(source.match(/RE_Direct\( directLight/g)||[]).length,metalnessMap:/^#define USE_METALNESSMAP/m.test(source)});return shaderSource.call(this,shader,source);};
   const fences=new Map(),makeFence=proto.fenceSync,deleteFence=proto.deleteSync;
   proto.fenceSync=function(...args){const fence=makeFence.apply(this,args);fences.set(fence,performance.now());return fence;};
   proto.deleteSync=function(fence){const start=fences.get(fence);if(start!==undefined){audit.fences.push({start,ms:performance.now()-start});fences.delete(fence);}return deleteFence.call(this,fence);};
   const NativeWorker=window.Worker;
   window.Worker=class extends NativeWorker{constructor(...args){super(...args);const pending=new Map();this.addEventListener('message',e=>{const key=e.data.id??e.data.type,start=pending.get(key);if(start!==undefined){audit.workers.push({url:String(args[0]),type:e.data.type,start,ms:performance.now()-start});pending.delete(key);}});const post=this.postMessage;this.postMessage=(message,...rest)=>{pending.set(message.id??message.type,performance.now());return post.call(this,message,...rest);};}};
   const raf=window.requestAnimationFrame;
   window.requestAnimationFrame=cb=>raf.call(window,time=>{
    if(audit.finished)return;
    const start=performance.now();cb(time);const end=performance.now();if(end-start>8)audit.raf.push({start,ms:end-start});
    const s=window.__miningValidation?.snapshot();
    if(s?.startup.firstPlayableMs&&s.frames>=3){audit.finished=performance.now();audit.snapshot={startup:s.startup,assets:s.facilities.surfaceShading,terrain:s.timings,render:s.renderer,frames:s.frames};}
   });
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');
  if(process.env.NETWORK_LATENCY_MS){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:Number(process.env.NETWORK_LATENCY_MS),downloadThroughput:2.5*1024*1024,uploadThroughput:1024*1024});}
  await cdp.send('Profiler.setSamplingInterval',{interval:1000});
  for(const name of (process.env.SINGLE?['cold']:['cold','warm'])){
   await cdp.send('Profiler.start');
   if(name==='cold')await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1',{waitUntil:'domcontentloaded'});else await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__startupAudit?.finished>0,undefined,{polling:100});
   const {profile}=await cdp.send('Profiler.stop');
   const data=await page.evaluate(()=>({...window.__startupAudit,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,start:e.startTime,end:e.responseEnd,duration:e.duration,transfer:e.transferSize,encoded:e.encodedBodySize,decoded:e.decodedBodySize})),navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON())}));
   data.errors=errors;await fs.writeFile(`${dir}/${name}.json`,JSON.stringify(data,null,2));await fs.writeFile(`${dir}/${name}.cpuprofile`,JSON.stringify(profile));
   const a=data.snapshot.assets;console.log(JSON.stringify({name,finished:data.finished,startup:data.snapshot.startup,models:a.assets.length,downloadTaskMsSum:a.assets.reduce((n,a)=>n+a.downloadMs,0),decodeUploadMs:a.assets.reduce((n,a)=>n+a.decodeMs,0),prepareMs:a.prepareMs,gl:data.gl,longTasks:data.longTasks,raf:data.raf},null,2));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
