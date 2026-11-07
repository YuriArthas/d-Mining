const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/performance-history'),stored='/root/threejs_space/d-game1/data/mining-light-reports';
fs.mkdirSync(dir,{recursive:true});
const report={startedAt:new Date().toISOString(),url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html',checks:[],reports:[],errors:[],console:[]};
const save=()=>fs.writeFileSync(path.join(dir,'public-check.json'),JSON.stringify(report,null,2)+'\n');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true});page.setDefaultTimeout(240000);
  const posts=[];let expectedFailure=false;
  page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/mining-light/performance-reports'))posts.push(r.postDataJSON());});
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('console',m=>{if(['error','warning'].includes(m.type())){report.console.push({expected:expectedFailure,message:m.text()});if(!expectedFailure)report.errors.push(m.text());}});
  await page.goto(report.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.loading.error')||window.__lightStudy?.snapshot().ready&&document.querySelector('.loading')?.hidden);
  assert.equal(await page.locator('.loading.error').count(),0,await page.locator('#status').textContent());
  assert.equal(posts.length,0);report.checks.push('No automatic reporting on load');
  await page.locator('.metrics-toggle').click();await page.evaluate(()=>window.__lightStudy.settle());
  const verifyStored=async name=>{
   await page.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId);
   const id=await page.locator('.report-status').getAttribute('data-report-id');
   const data=JSON.parse(fs.readFileSync(path.join(stored,id+'.json'),'utf8'));
   assert.deepEqual(data.report,posts.at(-1));
   assert.equal(data.report.schemaVersion,2);assert.match(data.report.sessionId,/^[a-f0-9-]{36}$/);
   const h=data.report.history;
   assert.equal(h.frameCount,h.rows.length);assert.ok(h.frameCount>0);
   assert.equal(h.gpuSampleCount,h.rows.filter(r=>r[6]!==null).length);
   assert.ok(h.stageLabels.includes('Final composite'));
   for(const frame of data.report.recentFrames){
    assert.ok(Math.abs(frame.cpu-(frame.cpuOutsideStagesMs+frame.cpuStages.reduce((n,s)=>n+s.exclusiveMs,0)))<.01);
    assert.ok(frame.cpuStages.every(s=>s.exclusiveMs<=s.inclusiveMs));
   }
   const current=await page.evaluate(()=>window.__lightStudy.snapshot()),frame=data.report.latestFrame;
   assert.equal(frame.frame,current.gpuSampleFrame);assert.equal(frame.gpu,current.gpuMs);assert.equal(frame.gpuPassSumMs,current.gpuPassSumMs);assert.equal(frame.gpuOverlapMs,current.gpuOverlapMs);assert.equal(frame.completionMs,current.gpuSampleCompletionMs);
   assert.deepEqual(frame.context.camera,current.camera);assert.deepEqual(frame.context.viewport,current.viewport);
   assert.equal(frame.gpuPasses.length,8);assert.deepEqual(data.report.scene.errors,[]);
   assert.equal(data.report.device.adapter.architecture,'swiftshader');
   assert.ok(data.report.build.module.includes('/assets/street-'));
   report.reports.push({name,id,history:{frameCount:h.frameCount,gpuSampleCount:h.gpuSampleCount,summary:h.summary},bytes:Buffer.byteLength(JSON.stringify(data.report)),latestFrame:frame});save();return id;
  };
  await page.evaluate(()=>{const b=document.querySelector('.report-performance');b.click();b.click();});
  await verifyStored('desktop');assert.equal(posts.length,1);report.checks.push('Double click creates one report; persisted payload exactly matches submitted frame');
  await page.screenshot({path:path.join(dir,'desktop.png')});
  await page.evaluate(()=>window.__lightStudy.capture(true));await page.screenshot({path:path.join(dir,'scene-clean.png')});await page.evaluate(()=>window.__lightStudy.capture(false));
  // Render more than the old 60-frame payload through normal camera changes.
  await page.setViewportSize({width:390,height:655});await page.evaluate(()=>window.__lightStudy.settle());
  await page.evaluate(async()=>{
   for(let i=0;i<72;i++)await window.__lightStudy.orbit([2.6+Math.sin(i/10)*.2,4.5,12.8],[-1,1.6,-8]);
  });
  const beforeUpload=await page.evaluate(()=>window.__lightStudy.snapshot());
  assert.ok(beforeUpload.historyFrames>60);const idleFrame=beforeUpload.submitted;
  await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>window.__lightStudy.snapshot().submitted),idleFrame);
  await page.locator('.report-performance').click();await verifyStored('history-one-click');
  const whole=posts.at(-1);assert.ok(whole.history.frameCount>60);
  assert.ok(whole.history.rows.some(r=>r[0]===beforeUpload.samples[0].frame));
  assert.equal(whole.latestFrame.reason,'report');assert.ok(whole.history.summary.some(s=>s.reason==='interaction'&&s.cpu.count>=60));
  assert.ok(whole.history.gpuSampleCount>=5);
  assert.equal(whole.sessionId,posts[0].sessionId);
  report.checks.push('One click includes 72 prior camera frames, GPU history, CPU stages, statistics and same session; idle preserves history');
  expectedFailure=true;
  await page.route('**/api/mining-light/performance-reports',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({ok:false,error:'test: storage unavailable'})}));
  await page.locator('.report-performance').click();
  await page.waitForFunction(()=>document.querySelector('.report-status').textContent.includes('上报失败'));
  assert.equal(await page.locator('.report-performance').isDisabled(),false);
  assert.equal(await page.locator('.report-status').getAttribute('data-report-id'),null);
  assert.equal(await page.locator('.loading.error').count(),0);
  await page.screenshot({path:path.join(dir,'failure.png')});report.checks.push('Save failure is visible, no stale success, button available for retry');
  await page.unroute('**/api/mining-light/performance-reports');expectedFailure=false;
  await page.locator('.report-performance').click();await verifyStored('retry');assert.equal(posts.length,4);report.checks.push('Retry succeeds after explicit error');
  await page.setViewportSize({width:390,height:655});await page.waitForFunction(()=>window.__lightStudy.snapshot().viewport.width===390);await page.evaluate(()=>window.__lightStudy.settle());
  const bounds=await page.locator('.report-performance').boundingBox();assert.ok(bounds.height>=44&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=655);
  await page.locator('.report-performance').tap();await verifyStored('narrow-touch');assert.equal(posts.length,5);
  await page.screenshot({path:path.join(dir,'narrow-touch.png')});report.checks.push('390x655 viewport: report button visible, >=44px high, touch submission succeeds');
  const before=await page.evaluate(()=>window.__lightStudy.snapshot().submitted);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__lightStudy.snapshot().submitted),before);report.checks.push('Reporting does not start continuous rendering');
  assert.deepEqual(report.errors,[]);assert.deepEqual(await page.evaluate(()=>window.__lightStudy.snapshot().errors),[]);
  report.passed=true;report.completedAt=new Date().toISOString();save();console.log(JSON.stringify({passed:report.passed,checks:report.checks,reports:report.reports.map(r=>({name:r.name,id:r.id,bytes:r.bytes}))},null,2));
 }finally{await browser.close();save();}
})().catch(e=>{report.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
