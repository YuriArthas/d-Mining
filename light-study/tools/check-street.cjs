const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
(async()=>{
  const mode=process.env.CHECK_MODE||'views',dir=path.resolve(__dirname,process.env.ARTIFACT_DIR||'../artifacts/street-r1');fs.mkdirSync(dir,{recursive:true});
  const url='https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html'+(mode==='courtyard'?'?light=night&study=both&view=wall':'');
  const report={url,mode,startedAt:new Date().toISOString(),errors:[],warnings:[],bundles:[],views:[],checks:[]};
  const save=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));let browser;
  try{
    browser=await chromium.launch({args:['--no-sandbox','--disable-quic','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
    const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(180000);
    const scripts=new Set();page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('.js'))scripts.add(r.url());});
    page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
    await page.addInitScript(()=>{window.__compiledShaders=[];const original=GPUDevice.prototype.createShaderModule;GPUDevice.prototype.createShaderModule=function(d){window.__compiledShaders.push({label:d.label,bytes:d.code.length});const m=original.call(this,d);m.getCompilationInfo().then(i=>{for(const e of i.messages)if(e.type==='error')console.error('WGSL '+d.label+': '+e.message);});return m;};});
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>document.querySelector('.loading.error')||(window.__lightStudy?.snapshot().ready&&document.querySelector('.loading')?.hidden),null,{timeout:240000});
    if(await page.locator('.loading.error').count())throw Error(await page.locator('.loading.error').innerText());
    const call=(method,...args)=>page.evaluate(({method,args})=>window.__lightStudy[method](...args),{method,args});
    const snap=()=>call('snapshot');
    for(const source of scripts){const res=await page.request.get(source);assert.ok(res.ok());report.bundles.push({url:source,sha256:createHash('sha256').update(await res.body()).digest('hex')});}save();
    const shot=async name=>{if(report.views.length===0||mode==='courtyard')await call('draw');else await call('settle');const s=await snap();assert.deepEqual(report.errors,[]);assert.deepEqual(s.errors,[]);await page.screenshot({path:path.join(dir,name+'.png'),timeout:120000});report.views.push({name,...s,compiledShaders:await page.evaluate(()=>window.__compiledShaders)});save();console.log('Captured '+name);return s;};
    if(mode==='courtyard'){await call('capture',true);await shot('courtyard-wall');}
    else {
      assert.equal((await snap()).scene,'street');
      if(mode==='views'){
        const first=await shot('entrance-ui');await call('capture',true);await shot('entrance');
        for(const v of ['walk','lamp']){await call('capture',false);await page.locator(`[data-view="${v}"]`).click();await page.waitForFunction(()=>window.__lightStudy.snapshot().ready);await call('capture',true);const s=await shot(v);assert.equal(s.view,v);assert.equal(s.lighting.shadowInvalidations,first.lighting.shadowInvalidations);assert.equal(s.model.triangles,first.model.triangles);}
        report.checks.push('Public default street; all three view buttons; resident geometry and cached shadows remain stable');
      }else if(mode==='runtime'){
        await call('capture',true);const first=await shot('night-before');
        const before=(await snap()).submitted;await page.waitForTimeout(2000);assert.equal((await snap()).submitted,before);report.checks.push('Idle submits zero new frames');
        await call('ao',false);await shot('no-ao');await call('ao',true);const restored=await shot('ao-restored');assert.equal(restored.lighting.shadowInvalidations,first.lighting.shadowInvalidations);
        await call('capture',false);await page.locator('[data-light="day"]').click();await page.waitForFunction(()=>window.__lightStudy.snapshot().ready);await call('capture',true);await shot('day');
        await call('capture',false);await page.locator('[data-light="night"]').click();await page.waitForFunction(()=>window.__lightStudy.snapshot().ready);await call('capture',true);await shot('night-restored');
        await call('capture',false);const canvas=page.locator('canvas');await canvas.click({position:{x:710,y:450}});await page.mouse.move(710,450);await page.mouse.down();await page.mouse.move(790,450,{steps:3});await page.mouse.up();await call('settle');const orbit=await snap();assert.notDeepEqual(orbit.camera,first.camera);assert.equal(orbit.model.geometryBytes,first.model.geometryBytes);
        await call('view','entrance');await call('capture',true);await shot('orbit-restored');
        report.checks.push('AO and day/night restoration; actual mouse orbit; no geometry unload');
      }else if(mode==='performance'){
        report.profile=[];await call('capture',true);
        for(const soft of (process.env.PERF_FILTER?[process.env.PERF_FILTER==='soft']:[false,true])){await call('softShadows',soft);await call('draw');const frames=[];for(let i=0;i<3;i++){await call('draw');const s=await snap();assert.equal(s.gpuSampleFrame,s.submitted);assert.equal(s.lighting.sun.shadowNeedsUpdate,false);assert.ok(s.lighting.lamps.every(l=>!l.shadowNeedsUpdate));frames.push({cpu:s.cpuSubmitMs,gpu:s.gpuMs,render:s.render,memory:s.memory,submitted:s.submitted});}report.profile.push({soft,frames});await shot(soft?'soft':'hard');}
        report.checks.push('Three warm exact frames each, same camera and light, cached maps; software renderer only');
      }
    }
    assert.deepEqual(report.errors,[]);report.completedAt=new Date().toISOString();save();
  }catch(e){report.failure=String(e.stack||e);save();throw e;}finally{if(browser)await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
