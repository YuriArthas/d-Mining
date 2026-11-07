const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/dynamic-optimization');
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html',startedAt:new Date().toISOString(),checks:[],reports:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(dir,'regression-check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:640}});page.setDefaultTimeout(180000);
  const posts=[];
  page.on('pageerror',e=>result.errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type())&&!m.text().includes('503 (Service Unavailable)'))result.errors.push(m.text());});
  page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/mining-light/performance-reports'))posts.push(r.postDataJSON());});
  await page.addInitScript(()=>{
   const original=GPUBuffer.prototype.mapAsync;
   GPUBuffer.prototype.mapAsync=function(...args){
    const mapped=original.apply(this,args);
    if(this.label!=='street-frame-times'||!window.__holdNextTimestamp)return mapped;
    window.__holdNextTimestamp=false;
    return mapped.then(()=>new Promise(resolve=>{window.__releaseTimestamp=resolve;window.__timestampHeld=true;}));
   };
  });
  const load=async(query)=>{
   await page.goto(result.url+query,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
   assert.equal(await page.locator('.loading.error').count(),0,await page.locator('#status').innerText());
  };
  const receipt=async()=>{
   await page.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId);
   const id=await page.locator('.report-status').getAttribute('data-report-id');
   const saved=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+id+'.json')).report;
   assert.deepEqual(saved,posts.at(-1));assert.equal(saved.schemaVersion,3);
   assert.equal(saved.history.rows.at(-1)[0],saved.latestFrame.frame);
   result.reports.push({id,build:saved.build,device:saved.device,motion:saved.latestFrame.context.motion,frameCount:saved.history.frameCount,gpuSampleCount:saved.history.gpuSampleCount});save();return saved;
  };
  await load('?motion=paused');await page.evaluate(()=>window.__lightStudy.draw());
  assert.equal(posts.length,0);await page.evaluate(()=>{window.__holdNextTimestamp=true;});
  await page.locator('.metrics-toggle').click();await page.waitForFunction(()=>window.__timestampHeld);
  await page.evaluate(()=>window.__lightStudy.settle());
  await page.locator('.report-performance').click();await page.evaluate(()=>window.__lightStudy.settle());
  assert.equal(posts.length,0);assert.ok(await page.locator('.report-performance').isDisabled());
  await page.evaluate(()=>{window.__releaseTimestamp();});
  const pausedReport=await receipt();assert.equal(pausedReport.latestFrame.context.motion,'paused');assert.equal(typeof pausedReport.latestFrame.gpu,'number');
  result.checks.push('Paused report completes after an earlier GPU readback is deliberately held beyond its render completion and then released');save();console.log(result.checks.at(-1));
  await page.locator('.metrics-toggle').click();
  await page.evaluate(async()=>{await window.__lightStudy.motionTime(8);await window.__lightStudy.ao(false);await window.__lightStudy.draw();});
  const noAO=await page.evaluate(()=>window.__lightStudy.snapshot());assert.equal(noAO.lighting.ao,false);assert.ok(noAO.gpuPasses.some(p=>p.label==='Moving shadow filtering'));assert.ok(noAO.gpuPasses.some(p=>p.label==='Geometry normals'));
  await page.evaluate(()=>window.__lightStudy.ao(true));result.checks.push('Screen shadow retains its depth/normal dependency with AO disabled');
  await page.locator('button[data-light="day"]').click();await page.evaluate(()=>window.__lightStudy.settle());
  const day=await page.evaluate(()=>window.__lightStudy.snapshot());assert.equal(day.lightMode,'day');assert.equal(day.movingLantern.seconds,8);assert.deepEqual(day.errors,[]);
  await page.screenshot({path:path.join(dir,'day-regression.png')});result.checks.push('Day mode renders with the paused moving light and no runtime errors');
  await page.locator('button[data-light="night"]').click();await page.evaluate(()=>window.__lightStudy.settle());
  await page.locator('.motion-pause').click();const before=await page.evaluate(()=>window.__lightStudy.snapshot().submitted);
  await page.waitForFunction(n=>window.__lightStudy.snapshot().submitted>=n+2,before);
  await page.locator('.motion-pause').click();await page.evaluate(()=>window.__lightStudy.settle());
  const paused=await page.evaluate(()=>window.__lightStudy.snapshot());await page.waitForTimeout(700);
  const idle=await page.evaluate(()=>window.__lightStudy.snapshot());assert.equal(idle.submitted,paused.submitted);assert.deepEqual(idle.movingLantern.position,paused.movingLantern.position);
  await page.locator('.motion-toggle').click();await page.evaluate(()=>window.__lightStudy.settle());
  assert.equal(await page.evaluate(()=>window.__lightStudy.snapshot().movingLantern.mode),'off');
  result.checks.push('Final build resumes continuous motion, pauses at a stable position, and switches the lantern off');save();console.log(result.checks.at(-1));
  await load('?timing=off');
  assert.equal(await page.evaluate(()=>window.__lightStudy.snapshot().movingLantern.mode),'moving');
  await page.locator('.metrics-toggle').click();await page.locator('.report-performance').click();
  const untimed=await receipt();assert.equal(untimed.device.timestampEnabled,false);assert.equal(untimed.latestFrame.gpu,null);assert.equal(untimed.latestFrame.context.motion,'moving');assert.ok(untimed.latestFrame.completionMs>0);
  assert.ok(untimed.history.rows.every(r=>r[6]===null));
  result.checks.push('Animation report works with GPU timing disabled; CPU/completion and moving-light history persist with null GPU timings');
  await page.evaluate(()=>window.__lightStudy.motion('paused'));
  await page.route('**/api/mining-light/performance-reports',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Injected report-storage failure'})}));
  await page.locator('.report-performance').click();await page.waitForFunction(()=>document.querySelector('.report-status').textContent.startsWith('上报失败'));
  assert.equal(await page.locator('.report-status').getAttribute('data-report-id'),null);assert.ok(await page.locator('.report-performance').isEnabled());
  await page.unroute('**/api/mining-light/performance-reports');await page.locator('.report-performance').click();await receipt();
  result.checks.push('Storage failure removes the prior receipt; explicit retry persists a fresh complete report');
  // Simulate visibility events deterministically; test the latched cancellation, not a hidden-tab render timing assumption.
  await page.evaluate(()=>{window.__attempt=window.__lightStudy.benchmark({samples:1,rounds:1,poses:1,motionSeconds:0}).then(()=>null,e=>String(e));});
  await page.waitForFunction(()=>window.__lightStudy.snapshot().benchmarkActive);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  assert.match(await page.evaluate(()=>window.__attempt),/后台/);
  assert.equal(await page.evaluate(()=>window.__lightStudy.snapshot().benchmarkActive),false);
  assert.equal(await page.evaluate(()=>window.__lightStudy.snapshot().benchmarkResult),null);
  assert.ok(await page.locator('.benchmark-performance').isEnabled());
  result.checks.push('Visibility interruption cancels comparison and restores the controls with no stale success');
  await page.setViewportSize({width:390,height:655});await page.evaluate(()=>window.__lightStudy.settle());
  const bounds=await page.locator('.benchmark-performance').boundingBox();assert.ok(bounds.height>=44&&bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y>=0);
  assert.ok(await page.locator('.benchmark-performance').evaluate(b=>{const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;}));
  await page.screenshot({path:path.join(dir,'report-controls.png')});result.checks.push('Automatic report button has a visible, unobstructed 44px target at a 390px viewport');
  assert.deepEqual(result.errors,[]);result.passed=true;result.completedAt=new Date().toISOString();save();console.log(JSON.stringify(result));
 }finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
