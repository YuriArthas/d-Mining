const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/moving-light');fs.mkdirSync(dir,{recursive:true});
const report={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html',startedAt:new Date().toISOString(),checks:[],states:[],errors:[]};const save=()=>fs.writeFileSync(path.join(dir,'public-check.json'),JSON.stringify(report,null,2)+'\n');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:640}});page.setDefaultTimeout(240000);
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))report.errors.push(m.text());});
  const posts=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/mining-light/performance-reports'))posts.push(r.postDataJSON());});
  await page.goto(report.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
  assert.equal(await page.locator('.loading.error').count(),0,await page.locator('#status').innerText());
  console.log('Loaded moving light');
  const first=await page.evaluate(()=>window.__lightStudy.snapshot());assert.equal(first.movingLantern.mode,'moving');
  await page.waitForFunction(n=>window.__lightStudy.snapshot().submitted>=n+3,first.submitted);
  const next=await page.evaluate(()=>window.__lightStudy.snapshot());assert.notDeepEqual(first.movingLantern.position,next.movingLantern.position);assert.equal(posts.length,0);
  report.checks.push('Default moving lamp continuously redraws and moves without camera input; no automatic report');report.states.push({name:'moving',state:next});save();
  await page.locator('.metrics-toggle').click();await page.locator('.report-performance').click();
  await page.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId);
  const id=await page.locator('.report-status').getAttribute('data-report-id'),saved=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+id+'.json'));
  assert.deepEqual(saved.report,posts.at(-1));assert.equal(saved.report.schemaVersion,3);assert.equal(saved.report.latestFrame.context.motion,'moving');assert.ok(saved.report.history.rows.some(row=>row[3]==='animation'));assert.ok(saved.report.history.contexts.some(c=>c.motion==='moving'));assert.equal(saved.report.history.rows.at(-1)[0],saved.report.latestFrame.frame);
  report.reportId=id;report.checks.push('One-click history upload completes during continuous animation and persists matching schema 3 frames/positions');save();
  await page.locator('.metrics-toggle').click();await page.locator('.motion-pause').click();await page.evaluate(()=>window.__lightStudy.settle());
  const paused=await page.evaluate(()=>window.__lightStudy.snapshot());await page.waitForTimeout(700);
  const still=await page.evaluate(()=>window.__lightStudy.snapshot());assert.equal(still.submitted,paused.submitted);assert.deepEqual(still.movingLantern.position,paused.movingLantern.position);report.checks.push('Pause freezes the lamp and returns to idle');
  for(const t of [0,8,16]){
   await page.evaluate(t=>window.__lightStudy.motionTime(t),t);await page.evaluate(()=>window.__lightStudy.draw());
   const s=await page.evaluate(()=>window.__lightStudy.snapshot());report.states.push({name:'time-'+t,state:s});
   assert.equal(s.movingLantern.seconds,t);assert.equal(s.movingLantern.mode,'paused');assert.deepEqual(s.errors,[]);
   await page.evaluate(()=>window.__lightStudy.capture(true));await page.screenshot({path:path.join(dir,'time-'+t+'.png')});await page.evaluate(()=>window.__lightStudy.capture(false));save();console.log('Captured position',t);
  }
  await page.locator('.motion-pause').click();const count=await page.evaluate(()=>window.__lightStudy.snapshot().submitted);await page.waitForFunction(n=>window.__lightStudy.snapshot().submitted>=n+2,count);await page.locator('.motion-toggle').click();await page.evaluate(()=>window.__lightStudy.settle());
  const off=await page.evaluate(()=>window.__lightStudy.snapshot());assert.equal(off.movingLantern.mode,'off');await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>window.__lightStudy.snapshot().submitted),off.submitted);report.checks.push('Resume animates again; Off hides the lantern and restores on-demand rendering');
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>window.__lightStudy.settle());await page.evaluate(()=>window.__lightStudy.draw());
  const baseline=await page.evaluate(()=>window.__lightStudy.snapshot());assert.equal(baseline.render.frameCalls,8);report.states.push({name:'off-baseline',state:baseline});
  await page.evaluate(()=>window.__lightStudy.capture(true));await page.screenshot({path:path.join(dir,'off-baseline.png')});await page.evaluate(()=>window.__lightStudy.capture(false));await page.screenshot({path:path.join(dir,'controls.png')});
  report.checks.push('Off baseline restores eight render passes');
  // The formerly missed lantern material should already be prepared.
  const source=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/5450a143-4527-402e-94d7-c74bcd1581b3.json')).report.history;
  const sourceFrame=Object.fromEntries(source.columns.map((k,i)=>[k,source.rows.find(r=>r[0]===146)[i]]));
  await page.evaluate(f=>window.__lightStudy.orbit([f.eyeX,f.eyeY,f.eyeZ],[f.targetX,f.targetY,f.targetZ]),sourceFrame);
  const warm=await page.evaluate(()=>window.__lightStudy.snapshot());report.states.push({name:'previous-creation-view',state:warm});assert.equal(warm.samples.at(-1).newPipelines,0);assert.equal(warm.samples.at(-1).newPrograms,0);report.checks.push('Previously cold view reuses prepared pipelines');
  assert.deepEqual(report.errors,[]);report.passed=true;report.completedAt=new Date().toISOString();save();console.log(JSON.stringify({passed:true,checks:report.checks,reportId:id}));
 }finally{await browser.close();save();}
})().catch(e=>{report.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
