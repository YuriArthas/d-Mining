// All rendering checks use the published entry. One browser/GPU workload at a
// time; compare identical physical pixels, camera and lighting state.
const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const base='https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html';
const dir=path.resolve(__dirname,process.env.ARTIFACT_DIR||'../artifacts/lighting-optimization/final');
const variants=(process.env.VARIANTS||'reference,optimized').split(',');
const sampleCount=Number(process.env.SAMPLES||3),visual=process.env.VISUAL!=='0';
const viewport={width:Number(process.env.WIDTH||1440),height:Number(process.env.HEIGHT||900),dpr:1};
const report={hostMemoryEventsBefore:fs.readFileSync('/sys/fs/cgroup/memory.events','utf8'),startedAt:new Date().toISOString(),base,viewport,variants:[],errors:[],warnings:[]};
fs.mkdirSync(dir,{recursive:true});
const save=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({args:['--no-sandbox','--disable-quic','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
  for(let index=0;index<variants.length;index++){
   // Release the previous WebGPU device before starting another variant. A
   // new browser also avoids accumulated driver resources skewing later runs.
   if(index>0){await browser.close();browser=await chromium.launch({args:['--no-sandbox','--disable-quic','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});}
   const variant=variants[index],label=`${index}-${variant.replaceAll('&','-').replaceAll('=','-')}`;
   const output=path.join(dir,label);fs.mkdirSync(output,{recursive:true});
   const url=base+'?render='+variant;
   const item={variant,label,url,bundles:[],frames:[],views:[],checks:[]};report.variants.push(item);save();
   const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});page.setDefaultTimeout(240000);
   const scripts=new Set();
   page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('.js'))scripts.add(r.url());});
   page.on('crash',()=>{report.errors.push({variant,message:'Browser page crashed'});save();});
   page.on('pageerror',e=>report.errors.push({variant,message:String(e)}));
   page.on('console',m=>{if(m.type()==='error')report.errors.push({variant,message:m.text()});if(m.type()==='warning')report.warnings.push({variant,message:m.text()});});
   await page.addInitScript(()=>{
    window.__shaders=[];
    const original=GPUDevice.prototype.createShaderModule;
    GPUDevice.prototype.createShaderModule=function(d){
     window.__shaders.push({label:d.label,code:d.code});const shader=original.call(this,d);
     shader.getCompilationInfo().then(info=>{for(const e of info.messages)if(e.type==='error')console.error('WGSL '+e.message);});return shader;
    };
   });
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
   await page.waitForFunction(()=>document.querySelector('.loading.error')||(window.__lightStudy?.snapshot().ready&&document.querySelector('.loading')?.hidden),null,{timeout:240000});
   if(await page.locator('.loading.error').count())throw Error(await page.locator('.loading.error').innerText());
   const call=(method,...args)=>page.evaluate(({method,args})=>window.__lightStudy[method](...args),{method,args});
   const shot=async name=>{
    await call('settle');const snapshot=await call('snapshot');assert.deepEqual(snapshot.errors,[]);assert.deepEqual(report.errors,[]);
    await page.screenshot({path:path.join(output,name+'.png'),timeout:120000});item.views.push({name,...snapshot});save();return snapshot;
   };
   for(const source of scripts){const response=await page.request.get(source);assert.ok(response.ok());item.bundles.push({url:source,sha256:createHash('sha256').update(await response.body()).digest('hex')});}
   await call('capture',true);
   for(let i=0;i<2;i++)await call('draw');
   for(let i=0;i<sampleCount;i++){
    await call('draw');const s=await call('snapshot');assert.equal(s.gpuSampleFrame,s.submitted);assert.deepEqual(s.errors,[]);assert.deepEqual(report.errors,[]);
    item.frames.push(s);save();console.log(label+' GPU '+s.gpuMs+' ms; '+JSON.stringify(s.gpuPasses));
   }
   const first=await shot('night-entrance');
   if(visual){
    await page.waitForTimeout(500);assert.equal((await call('snapshot')).submitted,first.submitted);item.checks.push('Idle stops submitting');
    for(const v of ['walk','lamp']){await call('view',v);await shot('night-'+v);}
    await page.evaluate(()=>{void window.__lightStudy.view('entrance');document.querySelector('[data-light="day"]').click();});await call('settle');
    await call('draw');item.dayFrame=await call('snapshot');await shot('day-entrance');
    for(const v of ['walk','lamp']){await call('view',v);await shot('day-'+v);}
    await page.evaluate(()=>{void window.__lightStudy.view('entrance');document.querySelector('[data-light="night"]').click();});await call('settle');await shot('night-restored');
    await call('ao',false);await shot('night-no-ao');await call('ao',true);await shot('night-ao-restored');
    item.checks.push('Day/night and AO switches');
    if(variant==='optimized'){
     await call('capture',false);await page.locator('.metrics-toggle').click();await call('settle');
     item.metrics=await page.locator('.metrics').innerText();assert.ok(item.metrics.includes(`${viewport.width} × ${viewport.height}`));await page.screenshot({path:path.join(output,'metrics.png')});await call('capture',true);
     await page.setViewportSize({width:1280,height:800});await page.waitForFunction(()=>window.__lightStudy.snapshot().viewport.bufferWidth===1280);await call('settle');await shot('resized');
     await page.setViewportSize({width:viewport.width,height:viewport.height});await page.waitForFunction(width=>window.__lightStudy.snapshot().viewport.bufferWidth===width,viewport.width);await call('settle');
     await page.mouse.move(viewport.width*.4,viewport.height*.45);await page.mouse.down();await page.mouse.move(viewport.width*.6,viewport.height*.5);await page.mouse.up();await page.waitForFunction(position=>JSON.stringify(window.__lightStudy.snapshot().camera.position)!==JSON.stringify(position),first.camera.position);await call('settle');
     await call('view','entrance');await shot('night-controls-restored');item.checks.push('Metrics, resize and actual pointer camera controls');
    }
   }
   const shaders=await page.evaluate(()=>window.__shaders);const shaderDir=path.join(output,'shaders');fs.mkdirSync(shaderDir,{recursive:true});
   shaders.forEach((s,i)=>fs.writeFileSync(path.join(shaderDir,i+'.wgsl'),s.code));
   item.shaders=shaders.map((s,i)=>({file:i+'.wgsl',label:s.label,bytes:s.code.length}));
   assert.deepEqual(report.errors,[]);assert.deepEqual(report.warnings,[]);item.completedAt=new Date().toISOString();save();await page.close();
  }
  report.completedAt=new Date().toISOString();save();
 }catch(error){report.failure=String(error.stack||error);save();throw error;}finally{if(browser)await browser.close();report.hostMemoryEventsAfter=fs.readFileSync('/sys/fs/cgroup/memory.events','utf8');save();}
})().catch(e=>{console.error(e);process.exitCode=1;});
