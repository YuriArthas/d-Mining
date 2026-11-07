// Public WebGPU descriptors and timestamps, captured without changing application shaders.
const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/post-targets/descriptors');fs.mkdirSync(dir,{recursive:true});
const report={startedAt:new Date().toISOString(),runs:[]};
const save=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
(async()=>{
 for(const mode of ['reference','optimized','timing-off']){
  console.log('START descriptors',mode);
  const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
  const item={mode,errors:[]};report.runs.push(item);
  try{
   const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(240000);
   page.on('pageerror',e=>item.errors.push(String(e)));
   page.on('console',m=>{if(['error','warning'].includes(m.type()))item.errors.push(m.text());});
   await page.addInitScript(()=>{
    window.__passes=[];window.__rawTimes=[];const views=new WeakMap();
    const createView=GPUTexture.prototype.createView;
    GPUTexture.prototype.createView=function(...args){const result=createView.apply(this,args);views.set(result,{label:this.label,width:this.width,height:this.height,format:this.format,samples:this.sampleCount,usage:this.usage});return result;};
    const beginPass=GPUCommandEncoder.prototype.beginRenderPass;
    GPUCommandEncoder.prototype.beginRenderPass=function(d){
     window.__passes.push({colors:d.colorAttachments.map(a=>a?{texture:views.get(a.view),resolve:views.get(a.resolveTarget),store:a.storeOp,load:a.loadOp}:null),depth:d.depthStencilAttachment?{texture:views.get(d.depthStencilAttachment.view),store:d.depthStencilAttachment.depthStoreOp,load:d.depthStencilAttachment.depthLoadOp}:null,timestamps:d.timestampWrites?{begin:d.timestampWrites.beginningOfPassWriteIndex,end:d.timestampWrites.endOfPassWriteIndex}:null});
     return beginPass.call(this,d);
    };
    const mapped=GPUBuffer.prototype.getMappedRange;
    GPUBuffer.prototype.getMappedRange=function(...args){const result=mapped.apply(this,args);if(this.label==='street-frame-times')window.__rawTimes=Array.from(new BigUint64Array(result),x=>String(x));return result;};
   });
   const post=mode==='reference'?'reference':'optimized';
   item.url='https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?render=optimized&post='+post+(mode==='timing-off'?'&timing=off':'');
   await page.goto(item.url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.loading.error')||window.__lightStudy?.snapshot().ready&&document.querySelector('.loading')?.hidden);
   assert.equal(await page.locator('.loading.error').count(),0,await page.locator('#status').textContent());
   await page.evaluate(()=>window.__lightStudy.draw());
   await page.evaluate(()=>{window.__passes=[];window.__rawTimes=[];return window.__lightStudy.draw();});
   Object.assign(item,await page.evaluate(()=>({snapshot:window.__lightStudy.snapshot(),passes:window.__passes,rawTimes:window.__rawTimes})));
   assert.deepEqual(item.errors,[]);assert.deepEqual(item.snapshot.errors,[]);assert.equal(item.passes.length,8);
   const main=item.passes.find(p=>p.colors.length===2);assert.ok(main);assert.ok(main.colors.every(a=>a.texture.samples===4&&a.texture.format==='rgba16float'&&a.resolve.samples===1));
   assert.equal(main.depth.texture.samples,4);assert.ok(main.colors.every(a=>a.store===(post==='reference'?'store':'discard')));assert.equal(main.depth.store,post==='reference'?'store':'discard');
   // RenderPipeline opens its encoder before its dependent scene/effect passes;
   // it submits that encoder last. Descriptor creation order is not GPU order.
   const final=item.passes[0];assert.equal(final.colors.length,1);assert.equal(final.colors[0].texture.samples,1);assert.equal(!!final.depth,post==='reference');
   if(mode==='timing-off'){
    assert.equal(item.snapshot.gpuMs,null);assert.ok(item.passes.every(p=>p.timestamps===null));assert.equal(item.rawTimes.length,0);
   }else{
    assert.ok(item.passes.every(p=>p.timestamps!==null));
    const times=item.rawTimes.map(BigInt),intervals=item.passes.map(p=>({start:times[p.timestamps.begin],end:times[p.timestamps.end]}));
    const first=intervals.reduce((a,b)=>a<b.start?a:b.start,intervals[0].start),last=intervals.reduce((a,b)=>a>b.end?a:b.end,intervals[0].end);
    item.timestampAudit={spanMs:Number(last-first)/1e6,sumMs:intervals.reduce((sum,p)=>sum+Number(p.end-p.start)/1e6,0)};
    assert.ok(Math.abs(item.timestampAudit.spanMs-item.snapshot.gpuMs)<1e-4);
    assert.ok(Math.abs(item.timestampAudit.sumMs-item.snapshot.gpuPassSumMs)<1e-4);
    const edges=intervals.flatMap(p=>[[p.start,1],[p.end,-1]]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
    let active=0,overlap=0n,previous=edges[0][0];
    for(const [at,delta] of edges){if(active>1)overlap+=(at-previous)*BigInt(active-1);active+=delta;previous=at;}
    item.timestampAudit.overlapMs=Number(overlap)/1e6;
    assert.ok(Math.abs(item.timestampAudit.overlapMs-item.snapshot.gpuOverlapMs)<1e-4);
    assert.equal(item.snapshot.gpuSampleFrame,item.snapshot.submitted);
    assert.equal(item.snapshot.gpuSampleCompletionMs,item.snapshot.completionMs);
    assert.equal(new Set(item.snapshot.gpuPasses.map(p=>p.label)).size,8);
    assert.ok(item.snapshot.gpuPasses.some(p=>p.label==='Final composite'&&p.samples===1));
   }
   await page.evaluate(()=>window.__lightStudy.capture(true));await page.screenshot({path:path.join(dir,mode+'.png')});
   // A normal camera redraw must clear reused render-pass timestamp descriptors.
   assert.notEqual((item.snapshot.submitted+1)%15,0);
   await page.evaluate(()=>{window.__passes=[];window.__rawTimes=[];return window.__lightStudy.view('entrance');});
   item.unsampled=await page.evaluate(()=>({snapshot:window.__lightStudy.snapshot(),passes:window.__passes,rawTimes:window.__rawTimes}));
   assert.equal(item.unsampled.passes.length,8);assert.ok(item.unsampled.passes.every(p=>p.timestamps===null));assert.deepEqual(item.unsampled.rawTimes,[]);
   assert.equal(item.unsampled.snapshot.gpuSampleFrame,item.snapshot.gpuSampleFrame);
   assert.equal(item.unsampled.snapshot.gpuSampleCompletionMs,item.snapshot.gpuSampleCompletionMs);
   if(mode==='optimized'){
    await page.evaluate(()=>window.__lightStudy.capture(false));await page.locator('.metrics-toggle').click();
    await page.evaluate(()=>window.__lightStudy.draw());
    item.metrics=await page.locator('.metrics').innerText();assert.match(item.metrics,/GPU frame span/);assert.match(item.metrics,/Pass sum/);assert.match(item.metrics,/overlap/);
    await page.screenshot({path:path.join(dir,'metrics.png')});
   }
   const count=await page.evaluate(()=>window.__lightStudy.snapshot().submitted);await page.waitForTimeout(500);
   assert.equal(await page.evaluate(()=>window.__lightStudy.snapshot().submitted),count);
   assert.deepEqual(item.errors,[]);
   item.passed=true;save();console.log('PASS descriptors',mode,JSON.stringify({gpu:item.snapshot.gpuMs,complete:item.snapshot.completionMs,audit:item.timestampAudit}));
  }finally{await browser.close();save();}
 }
 report.passed=true;report.completedAt=new Date().toISOString();save();
})().catch(e=>{report.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
