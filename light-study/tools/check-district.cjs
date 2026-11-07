const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const phase=process.argv[2]||'final',dir=path.resolve(__dirname,'../artifacts/district-public',phase);fs.mkdirSync(dir,{recursive:true});
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?loop=demand',environment:'Chromium / SwiftShader; functional and visual evidence only',errors:[],responses:[],views:{}};
const save=()=>fs.writeFileSync(path.join(dir,'check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
try{
  const p=await browser.newPage({viewport:{width:960,height:640}});p.setDefaultTimeout(240000);
  p.on('pageerror',error=>{result.errors.push(String(error));save();});p.on('console',message=>{if(['error','warning'].includes(message.type())){result.errors.push(message.text());save();}});
  p.on('requestfailed',request=>{result.errors.push(request.url()+': '+request.failure()?.errorText);save();});
  p.on('response',response=>{result.responses.push({url:response.url(),status:response.status(),length:Number(response.headers()['content-length']||0),encoding:response.headers()['content-encoding']||'identity'});});
  await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
  assert.equal(await p.locator('.loading.error').count(),0,await p.locator('#status').innerText());
  result.initial=await p.evaluate(()=>window.__lightStudy.snapshot());assert.equal(result.initial.scene,'district');assert.equal(result.initial.model.buildings,16);assert.equal(result.initial.model.blocks,4);assert.equal(result.initial.lighting.runtimePointLights,0);
  if(!process.argv.includes('--route-only'))for(const mode of ['night','day']){
    await p.evaluate(mode=>window.__lightStudy.light(mode),mode);
    for(const view of ['overview','entrance','lamp']){
      await p.evaluate(view=>window.__lightStudy.view(view),view);await p.evaluate(()=>window.__lightStudy.draw());
      await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,`${mode}-${view}.png`)});await p.evaluate(()=>window.__lightStudy.capture(false));
      result.views[`${mode}-${view}`]=await p.evaluate(()=>window.__lightStudy.snapshot());save();console.log('Captured',phase,mode,view);
    }
  }
  if(phase==='final'){
    await p.locator('button[data-light="night"]').click();await p.locator('[data-view="overview"]').click();await p.evaluate(()=>window.__lightStudy.settle());
    await p.evaluate(()=>window.__lightStudy.loop(true));let start=await p.evaluate(()=>window.__lightStudy.snapshot().submitted);await p.waitForFunction(n=>window.__lightStudy.snapshot().submitted>=n+3,start);
    result.continuous=await p.evaluate(()=>window.__lightStudy.snapshot());assert.ok(result.continuous.cadence.fps>0);
    await p.locator('.tour-toggle').click();await p.waitForFunction(()=>window.__lightStudy.snapshot().tour.seconds>1);await p.locator('.tour-toggle').click();await p.evaluate(()=>window.__lightStudy.loop(false));
    const paused=await p.evaluate(()=>window.__lightStudy.snapshot());await p.evaluate(()=>window.__lightStudy.draw());assert.deepEqual((await p.evaluate(()=>window.__lightStudy.snapshot())).camera,paused.camera);
    for(const seconds of [7.5,15,22.5]){await p.evaluate(s=>window.__lightStudy.routeTime(s),seconds);await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,`tour-${seconds}.png`)});await p.evaluate(()=>window.__lightStudy.capture(false));}
    await p.locator('[data-view="overview"]').click();await p.locator('.metrics-toggle').click();await p.locator('.benchmark-performance').click();
    await p.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId||document.querySelector('.report-status').textContent.startsWith('测量失败'));
    result.reportId=await p.locator('.report-status').getAttribute('data-report-id');
    assert.ok(result.reportId,await p.locator('.report-status').innerText());
    const report=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+result.reportId+'.json')).report;
    result.benchmark=report.scene.benchmark;result.build=report.build;
    assert.equal(result.benchmark.type,'district-tour');assert.equal(result.benchmark.seconds,30);assert.equal(result.benchmark.context.motion,'off');assert.equal(result.benchmark.context.cameraMotion,'tour');assert.ok(result.benchmark.frameCount>=2);
    assert.ok(report.history.rows.length>=result.benchmark.frameCount);
    console.log('Tour report',result.reportId);
  }
  assert.deepEqual(result.errors,[]);assert.ok(result.responses.every(r=>r.status>=200&&r.status<300));result.passed=true;save();
}finally{await browser.close();save();}})().catch(error=>{result.failure=String(error.stack||error);save();console.error(error);process.exitCode=1;});
