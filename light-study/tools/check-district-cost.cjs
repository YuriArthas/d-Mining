// Public desktop checks. SwiftShader validates graph/appearance/receipts only.
const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/district-public/half-halo-release');fs.mkdirSync(dir,{recursive:true});
const comparison=process.argv.includes('--comparison'),day=process.argv.includes('--day');
const result={environment:'Desktop public Chromium / SwiftShader; not iPhone performance acceptance',errors:[],views:{},diagnostics:{}};
const sameImage=(a,b)=>JSON.parse(require('node:child_process').execFileSync('python3',['-c',"import sys,json;from PIL import Image;import numpy as np;a=np.array(Image.open(sys.argv[1])).astype(float);b=np.array(Image.open(sys.argv[2])).astype(float);d=abs(a-b);print(json.dumps({'mean':float(d.mean()),'max':float(d.max())}));assert np.array_equal(a,b), 'Restored image differs'",path.join(dir,a),path.join(dir,b)],{encoding:'utf8'}));
const save=()=>fs.writeFileSync(path.join(dir,comparison?'comparison.json':process.argv.includes('--tour-only')?'tour.json':process.argv.includes('--all-views')?'views.json':day?'day.json':'night.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{
 const browser=await chromium.launch({args:['--disable-dev-shm-usage','--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
  const p=await browser.newPage({viewport:{width:960,height:640}});p.setDefaultTimeout(240000);
  p.on('pageerror',e=>{result.errors.push(String(e));save();});p.on('crash',()=>{result.errors.push('Page crashed');save();});
  p.on('console',m=>{if(m.text().startsWith('QA_PHASE'))console.log(m.text());if(['error','warning'].includes(m.type())){result.errors.push(m.text());console.log('BROWSER',m.type(),m.text());save();}});
  const url='https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?debug-shaders=1'+(comparison?'':'&loop=demand');
  await p.goto(url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
  assert.equal(await p.locator('.loading.error').count(),0,await p.locator('#status').innerText());
  result.build=await p.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).find(n=>/district-.*\.js/.test(n)));
  const snapshot=()=>p.evaluate(()=>window.__lightStudy.snapshot());
  const stable=async()=>{let f;for(let i=0;i<6;i++){f=await p.evaluate(()=>window.__lightStudy.draw());if(i>0&&!f.newPipelines&&!f.newPrograms)return f;}throw Error('Variant never stabilized');};
  result.initial=await snapshot();save();assert.equal(result.initial.lighting.pipeline,'static');assert.equal(result.initial.render.frameCalls,4);assert.equal(result.initial.model.triangles,642264);
  if(process.argv.includes('--tour-only')){
   result.tourFrames=[];
   for(const time of [7.5,15,22.5]){await p.evaluate(t=>window.__lightStudy.routeTime(t),time);const f=await stable();assert.equal(f.passes,4);result.tourFrames.push(f);save();console.log('Tour pose passed',time);}
   result.tourPoses=true;
  }else if(comparison){
   await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,'before-comparison.png')});await p.evaluate(()=>window.__lightStudy.capture(false));
   const before=result.initial.submitted;await p.waitForFunction(n=>window.__lightStudy.snapshot().submitted>=n+3,before);result.continuous=true;
   await p.evaluate(()=>{let phase='';new MutationObserver(()=>{const text=document.querySelector('.report-status').textContent;const key=text.split(' · ')[0];if(key!==phase){phase=key;console.log('QA_PHASE '+key);}}).observe(document.querySelector('.report-status'),{childList:true,subtree:true,characterData:true});});
   await p.locator('.metrics-toggle').click();await p.locator('.compare-performance').click();
   await p.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId||/对照失败|上报失败/.test(document.querySelector('.report-status').textContent),null,{timeout:900000});
   result.status=await p.locator('.report-status').innerText();result.reportId=await p.locator('.report-status').getAttribute('data-report-id');assert.ok(result.reportId,result.status);
   const receipt=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+result.reportId+'.json')).report;
   assert.equal(receipt.scene.benchmark.type,'district-cost-comparison');
   const order=['fused','static','no-halo','no-environment','no-shadow','baked-material'];
   assert.deepEqual(receipt.scene.benchmark.rounds.map(r=>r.variant),[...order,...order.slice().reverse()]);
   const pose=receipt.scene.benchmark.rounds[0].context.camera;
   for(const r of receipt.scene.benchmark.rounds){
    assert.ok(r.frameCount>=2);assert.ok(r.gpuFrames.length>0);assert.equal(r.validation.newPipelines,0);
    assert.ok(['position','target'].every(k=>r.context.camera[k].every((v,i)=>Math.abs(v-pose[k][i])<=1e-7)));
    const passes=r.variant==='fused'?3:r.variant==='no-halo'?2:4;
    for(const f of r.gpuFrames){assert.equal(f.passes,passes);assert.equal(f.newPipelines,0);assert.equal(f.newPrograms,0);}
   }
   result.reportBytes=Buffer.byteLength(JSON.stringify(receipt));assert.ok(result.reportBytes<2*1024*1024);
   result.comparison=receipt.scene.benchmark;result.restored=await snapshot();
   assert.equal(result.restored.renderLoop,'continuous');assert.equal(result.restored.lighting.pipeline,'static');assert.equal(result.restored.lighting.materialDiagnostic,'none');
   await p.evaluate(()=>window.__lightStudy.loop(false));await stable();await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,'after-comparison.png')});await p.evaluate(()=>window.__lightStudy.capture(false));
   result.restoredPixels=sameImage('before-comparison.png','after-comparison.png');
   // A second run invalidated after measurement starts must clear the preceding
   // receipt and result, restore the complete scene, and release every control.
   await p.locator('.compare-performance').click();await p.waitForFunction(()=>window.__lightStudy.snapshot().benchmarkActive,null,{timeout:600000});
   assert.equal(await p.locator('button[data-light="day"]').isDisabled(),true);
   await p.setViewportSize({width:1000,height:650});await p.waitForFunction(()=>/对照失败/.test(document.querySelector('.report-status').textContent),null,{timeout:240000});
   result.abortStatus=await p.locator('.report-status').innerText();assert.match(result.abortStatus,/窗口尺寸改变/);
   const state=await snapshot();assert.equal(state.benchmarkResult,null);assert.equal(state.comparisonActive,false);assert.equal(state.benchmarkActive,false);assert.equal(state.lighting.materialDiagnostic,'none');assert.equal(state.lighting.pipeline,'static');assert.equal(state.renderLoop,'demand');
   assert.equal(await p.locator('.report-status').getAttribute('data-report-id'),null);assert.equal(await p.locator('.report-performance').isDisabled(),false);
   console.log('Receipt and interrupted-run restore passed',result.reportId);
  }else{
   for(const day of (process.argv.includes('--all-views')?[false,true]:[process.argv.includes('--day')])){
   await p.evaluate(x=>window.__lightStudy.light(x),day?'day':'night');
   for(const view of (process.argv.includes('--diagnostics')?[]:['overview','entrance','lamp'])){
    await p.evaluate(x=>window.__lightStudy.view(x),view);
    for(const pipeline of ['fused','static']){
     await p.evaluate(x=>window.__lightStudy.pipeline(x),pipeline);const f=await stable();
     assert.equal(f.passes,(pipeline==='static'?4:3)+(day?4:0));assert.ok(f.gpuPasses.every(x=>x.samples===(x.label.startsWith('Lighting')?4:1)));
     await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,`${day?'day':'night'}-${view}-${pipeline}.png`)});await p.evaluate(()=>window.__lightStudy.capture(false));
     result.views[`${day?'day':'night'}-${view}-${pipeline}`]=await snapshot();save();console.log('Captured',day?'day':'night',view,pipeline);
    }
   }
   }
   if(!day){
    await p.evaluate(()=>window.__lightStudy.light('night'));
    await p.evaluate(()=>window.__lightStudy.view('overview'));await stable();await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,'before-diagnostics.png')});await p.evaluate(()=>window.__lightStudy.capture(false));
    const originals=await p.evaluate(()=>window.__lightStudy.shaders());fs.writeFileSync(path.join(dir,'baseline-shaders.json'),JSON.stringify(originals));
    for(const diagnostic of (process.argv.includes('--baked-only')?['baked-material','none']:['no-halo','no-environment','no-shadow','baked-material','none'])){
     console.log('Testing diagnostic',diagnostic);const n=await p.evaluate(()=>window.__lightStudy.shaders().length);
     await p.evaluate(x=>window.__lightStudy.diagnostic(x),diagnostic);const f=await stable();assert.equal(f.passes,diagnostic==='no-halo'?2:4);
     const programs=await p.evaluate(n=>window.__lightStudy.shaders().slice(n),n);fs.writeFileSync(path.join(dir,`shaders-${diagnostic}.json`),JSON.stringify(programs));
     const fragment=programs.filter(x=>x.stage==='fragment');
     if(['no-environment','no-shadow','baked-material'].includes(diagnostic))assert.ok(fragment.length>0,'Diagnostic did not generate changed shaders');
     if(diagnostic==='no-environment')assert.ok(fragment.every(x=>!x.code.includes('streetPMREM')));
     if(diagnostic==='no-shadow'||diagnostic==='baked-material')assert.ok(fragment.every(x=>!x.code.includes('textureSampleCompare')));
     if(diagnostic==='baked-material')assert.ok(fragment.every(x=>!x.code.includes('D_GGX')&&!x.code.includes('streetPMREM')));
     await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,`diagnostic-${diagnostic}.png`)});await p.evaluate(()=>window.__lightStudy.capture(false));
     result.diagnostics[diagnostic]={frame:f,programs:programs.map(x=>({name:x.name,stage:x.stage,bytes:x.code.length}))};save();console.log('Diagnostic passed',diagnostic);
    }
    result.restoredPixels=sameImage('before-diagnostics.png','diagnostic-none.png');
    for(const time of [7.5,15,22.5]){await p.evaluate(t=>window.__lightStudy.routeTime(t),time);assert.equal((await stable()).passes,4);}result.tourPoses=true;
   }
  }
  fs.writeFileSync(path.join(dir,comparison?'comparison-shaders.json':process.argv.includes('--all-views')?'view-shaders.json':'diagnostic-shaders.json'),JSON.stringify(await p.evaluate(()=>window.__lightStudy.shaders())));
  assert.deepEqual(result.errors,[]);result.passed=true;save();
 }finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
