const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{createHash}=require('crypto');
(async()=>{
 const dir=path.resolve(__dirname,'../artifacts/static-shadow-final');fs.mkdirSync(dir,{recursive:true});
 const base='https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html';
 let report={startedAt:new Date().toISOString(),errors:[],warnings:[],bundles:[],views:[],profiles:[],checks:[]};
 if(process.env.RESUME_FROM_RESIZE){report=JSON.parse(fs.readFileSync(path.join(dir,'report.json')));report.testHarnessRetryReason=report.failure;delete report.failure;for(const v of report.views)if(v.name==='cached-resized'&&v.viewport.bufferWidth!==1280){v.name='cached-resized-before-event-invalid';v.validation='Superseded; read before resize event, retained in resize-test-first-attempt.json';}}
 const save=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));let browser;
 try{
  browser=await chromium.launch({args:['--no-sandbox','--disable-quic','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
  for(const mode of ['cached','live']){
   const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(240000);
   const scripts=new Set();page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('.js'))scripts.add(r.url());});
   page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
   await page.addInitScript(()=>{window.__shaders=[];const original=GPUDevice.prototype.createShaderModule;GPUDevice.prototype.createShaderModule=function(d){window.__shaders.push({label:d.label,code:d.code});const m=original.call(this,d);m.getCompilationInfo().then(i=>{for(const e of i.messages)if(e.type==='error')console.error('WGSL '+e.message);});return m;};});
   await page.goto(base+(mode==='live'?'?shadows=live':''),{waitUntil:'domcontentloaded',timeout:120000});
   await page.waitForFunction(()=>document.querySelector('.loading.error')||(window.__lightStudy?.snapshot().ready&&document.querySelector('.loading')?.hidden),null,{timeout:240000});
   if(await page.locator('.loading.error').count())throw Error(await page.locator('.loading.error').innerText());
   const call=(method,...args)=>page.evaluate(({method,args})=>window.__lightStudy[method](...args),{method,args});
   for(const url of scripts){const r=await page.request.get(url);assert.ok(r.ok());report.bundles.push({mode,url,sha256:createHash('sha256').update(await r.body()).digest('hex')});}
   const shot=async name=>{await call('settle');const s=await call('snapshot');assert.deepEqual(s.errors,[]);assert.deepEqual(report.errors,[]);await page.screenshot({path:path.join(dir,mode+'-'+name+'.png'),timeout:120000});report.views.push({name:mode+'-'+name,...s});save();console.log('Captured '+mode+'-'+name);return s;};
   await call('capture',true);
   let first;
   if(!(mode==='cached'&&process.env.RESUME_FROM_RESIZE)){
   await call('draw');
   const frames=[];for(let i=0;i<3;i++){await call('draw');const s=await call('snapshot');assert.equal(s.gpuSampleFrame,s.submitted);frames.push(s);console.log(mode+' GPU '+s.gpuMs+' ms');}
   report.profiles.push({mode,frames});save();

   first=await shot('night-entrance');
   const submitted=first.submitted;await page.waitForTimeout(1200);assert.equal((await call('snapshot')).submitted,submitted);
   for(const v of ['walk','lamp']){await call('view',v);await shot('night-'+v);}
   if(mode==='cached'){
    // Buttons use the same public interaction path; batch view/mode in one frame.
    await page.evaluate(()=>{void window.__lightStudy.view('entrance');document.querySelector('[data-light="day"]').click();});await call('settle');
    await shot('day-entrance');
    for(const v of ['walk','lamp']){await call('view',v);await shot('day-'+v);}
    await page.evaluate(()=>{void window.__lightStudy.view('entrance');document.querySelector('[data-light="night"]').click();});await call('settle');await shot('night-restored');
    await call('ao',false);await shot('night-no-ao');await call('ao',true);await shot('night-ao-restored');
   }
   }else first=report.views.find(v=>v.name==='cached-night-entrance');
   if(mode==='cached'){
    await call('capture',false);await page.locator('.metrics-toggle').click();await call('settle');
    const metrics=await page.locator('.metrics').innerText();assert.match(metrics,/1440 × 900/);assert.match(metrics,/static visibility atlas/);report.metrics=metrics;
    await page.screenshot({path:path.join(dir,'metrics.png')});await call('capture',true);
    await page.setViewportSize({width:1280,height:800});await page.waitForFunction(()=>window.__lightStudy.snapshot().viewport.bufferWidth===1280);await call('settle');const resized=await shot('resized');assert.equal(resized.viewport.bufferWidth,1280);assert.equal(resized.viewport.bufferHeight,800);
    await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>window.__lightStudy.snapshot().viewport.bufferWidth===1440);await call('settle');
    await page.mouse.move(650,420);await page.mouse.down();await page.mouse.move(850,470);await page.mouse.up();await page.waitForFunction(position=>JSON.stringify(window.__lightStudy.snapshot().camera.position)!==JSON.stringify(position),first.camera.position);await call('settle');assert.notDeepEqual((await call('snapshot')).camera,first.camera);
    await call('view','entrance');await shot('night-controls-restored');
    assert.equal((await call('snapshot')).lighting.environmentBuilds,2);
    report.checks.push('idle stops; camera controls; day/night and AO restore; resize; warm metrics sample');
   }
   const shaders=await page.evaluate(()=>window.__shaders);const shaderDir=path.join(dir,mode+'-shaders');fs.mkdirSync(shaderDir,{recursive:true});shaders.forEach((s,i)=>fs.writeFileSync(path.join(shaderDir,i+'.wgsl'),s.code));
   report[mode+'Shaders']=shaders.map((s,i)=>({file:i+'.wgsl',label:s.label,bytes:s.code.length,cube:s.code.includes('texture_depth_cube'),pcss:s.code.includes('i < 24')}));save();await page.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.warnings,[]);report.completedAt=new Date().toISOString();save();
 }catch(e){report.failure=String(e.stack||e);save();throw e;}finally{if(browser)await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
