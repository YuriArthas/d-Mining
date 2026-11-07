const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
(async()=>{
  const dir=path.resolve(__dirname,process.env.ARTIFACT_DIR||'../artifacts/day-r1');fs.mkdirSync(dir,{recursive:true});
  const url='https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?scene=street&light=day';
  const report={url,startedAt:new Date().toISOString(),errors:[],warnings:[],bundles:[],views:[],checks:[]};
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
    const shot=async name=>{await call('settle');const s=await snap();assert.deepEqual(report.errors,[]);assert.deepEqual(s.errors,[]);await page.screenshot({path:path.join(dir,name+'.png'),timeout:120000});report.views.push({name,...s,compiledShaders:await page.evaluate(()=>window.__compiledShaders)});save();console.log('Captured '+name);return s;};
    const click=async(selector)=>{await call('capture',false);await page.locator(selector).click();await call('settle');await call('capture',true);};
    await call('capture',true);await call('draw');
    const first=await shot('day-entrance');assert.equal(first.scene,'street');assert.equal(first.lightMode,'day');
    const submitted=first.submitted;await page.waitForTimeout(1500);assert.equal((await snap()).submitted,submitted);
    for(const v of ['walk','lamp']){await click(`[data-view="${v}"]`);const s=await shot('day-'+v);assert.equal(s.view,v);assert.deepEqual(s.model,first.model);assert.equal(s.lighting.shadowInvalidations,first.lighting.shadowInvalidations);}
    // Change camera and lighting in the same task so the software renderer need
    // not render an intermediate state. The light transition uses the real UI.
    await call('capture',false);await page.evaluate(()=>{void window.__lightStudy.view('entrance');document.querySelector('[data-light="night"]').click();});await call('settle');await call('capture',true);
    const night=await shot('night-preserved');assert.equal(night.lightMode,'night');assert.equal(night.lighting.environmentIntensity,.095);assert.equal(night.lighting.exposure,1);assert.equal(night.lighting.sun.intensity,.24);
    await click('[data-light="day"]');const restored=await shot('day-restored');assert.equal(restored.lightMode,'day');assert.deepEqual(restored.camera,first.camera);assert.deepEqual(restored.model,first.model);
    assert.equal(restored.lighting.environmentBuilds,2);assert.equal(restored.lighting.stableEnvironmentBinding,true);assert.equal(restored.lighting.shadowInvalidations,first.lighting.shadowInvalidations+2);
    report.checks.push('Public daytime URL and all three camera buttons','Static idle submits no new frames; camera changes preserve cached shadows and resident model','Actual night/day buttons restore day and retain two cached environment maps');
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.warnings,[]);report.completedAt=new Date().toISOString();save();
  }catch(e){report.failure=String(e.stack||e);save();throw e;}finally{if(browser)await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
