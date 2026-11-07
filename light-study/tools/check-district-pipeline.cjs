const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/district-public/static-pipeline-release');fs.mkdirSync(dir,{recursive:true});
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?loop=demand',environment:'Desktop Chromium / SwiftShader, not Apple GPU acceptance',errors:[],views:{}};
const save=()=>fs.writeFileSync(path.join(dir,process.argv.includes('--compare-only')?'comparison-check.json':process.argv.includes('--day-only')?'day-check.json':'night-check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{const browser=await chromium.launch({dumpio:true,args:['--disable-dev-shm-usage','--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
try{
 const p=await browser.newPage({viewport:{width:960,height:640}});p.setDefaultTimeout(240000);
 p.on('crash',()=>{result.errors.push('PAGE CRASH');save();});
 p.on('pageerror',e=>{result.errors.push(String(e));save();});p.on('console',m=>{if(['error','warning'].includes(m.type())){result.errors.push(m.text());save();}});
 await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
 assert.equal(await p.locator('.loading.error').count(),0,await p.locator('#status').innerText());
 result.initial=await p.evaluate(()=>window.__lightStudy.snapshot());assert.equal(result.initial.lighting.pipeline,'static');assert.equal(result.initial.model.triangles,642264);
 for(const light of (process.argv.includes('--compare-only')?[]:process.argv.includes('--day-only')?['day']:['night'])){
  await p.evaluate(x=>window.__lightStudy.light(x),light);
  for(const view of ['overview','entrance','lamp']){
   await p.evaluate(x=>window.__lightStudy.view(x),view);
   for(const variant of ['reference','static']){
    await p.evaluate(x=>window.__lightStudy.pipeline(x),variant);await p.evaluate(()=>window.__lightStudy.draw());
    await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,`${light}-${view}-${variant}.png`)});await p.evaluate(()=>window.__lightStudy.capture(false));
    const snapshot=await p.evaluate(()=>window.__lightStudy.snapshot());result.views[`${light}-${view}-${variant}`]=snapshot;
    assert.equal(snapshot.render.frameCalls,variant==='static'?(light==='night'?3:7):8);assert.ok(snapshot.gpuPasses.every(pass=>pass.samples===(pass.label.startsWith('Lighting')?4:1)));
    save();console.log('Captured',light,view,variant);
   }
  }
 }
 if(process.argv.includes('--visual-only')){assert.deepEqual(result.errors,[]);result.passed=true;save();return;}
 // With AO disabled, isolate HDR alpha and fused blur differences from the
 // intentionally different contact-shadow algorithm.
 await p.evaluate(()=>window.__lightStudy.light('night'));await p.evaluate(()=>window.__lightStudy.view('lamp'));await p.evaluate(()=>window.__lightStudy.ao(false));
 for(const variant of ['reference','static']){
  await p.evaluate(v=>window.__lightStudy.pipeline(v),variant);await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,`halo-${variant}.png`)});await p.evaluate(()=>window.__lightStudy.capture(false));
 }
 await p.evaluate(()=>window.__lightStudy.ao(true));await p.evaluate(()=>window.__lightStudy.view('overview'));await p.evaluate(()=>window.__lightStudy.pipeline('static'));
 await p.locator('.metrics-toggle').click();await p.locator('.compare-performance').click();
 await p.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId||/对照失败|上报失败/.test(document.querySelector('.report-status').textContent),null,{timeout:300000});
 result.reportId=await p.locator('.report-status').getAttribute('data-report-id');assert.ok(result.reportId,await p.locator('.report-status').innerText());
 const report=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+result.reportId+'.json')).report;
 result.comparison=report.scene.benchmark;assert.equal(result.comparison.type,'district-pipeline-comparison');assert.deepEqual(result.comparison.rounds.map(r=>r.variant),['reference','static','static','reference']);
 const pose=result.comparison.rounds[0].context.camera;
 for(const round of result.comparison.rounds){assert.ok(['position','target'].every(k=>round.context.camera[k].every((v,i)=>Math.abs(v-pose[k][i])<=1e-7)));assert.ok(round.frameCount>=2);assert.ok(round.gpuFrames.length>0);assert.ok(round.gpuFrames.every(f=>!f.newPipelines&&!f.newPrograms));}
 assert.equal(report.latestFrame.context.pipeline,'static');assert.ok(JSON.stringify(report).length<2*1024*1024);
 await p.screenshot({path:path.join(dir,'comparison.png')});
 assert.deepEqual(result.errors,[]);result.passed=true;save();console.log('Comparison report',result.reportId);
}finally{await browser.close();save();}})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
