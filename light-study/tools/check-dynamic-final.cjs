const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/dynamic-optimization');
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?motion=paused',checks:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(dir,'final-check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
 const p=await browser.newPage({viewport:{width:720,height:480}});p.setDefaultTimeout(240000);
 p.on('pageerror',e=>result.errors.push(String(e)));p.on('console',m=>{if(['error','warning'].includes(m.type()))result.errors.push(m.text());});
 const posts=[];p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/mining-light/performance-reports'))posts.push(r.postDataJSON());});
 await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
 assert.equal(await p.locator('.loading.error').count(),0,await p.locator('#status').innerText());
 await p.evaluate(()=>{window.__lightStudy.motion('moving');});await p.waitForFunction(()=>window.__lightStudy.snapshot().framesInFlight===2);
 assert.equal(await p.evaluate(()=>window.__lightStudy.snapshot().maxFramesInFlight),2);
 await p.evaluate(()=>window.__lightStudy.motion('paused'));
 const stable=await p.evaluate(()=>window.__lightStudy.snapshot());await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>window.__lightStudy.snapshot().submitted),stable.submitted);
 result.checks.push('Two in-flight frames; pause drains the queue and stops submissions');console.log(result.checks.at(-1));save();
 // A resize during comparison invalidates it, restores controls and cannot upload stale success.
 await p.evaluate(()=>{window.__attempt=window.__lightStudy.benchmark({samples:1,rounds:1,poses:1,motionSeconds:0}).then(()=>null,e=>String(e));});
 await p.waitForFunction(()=>window.__lightStudy.snapshot().benchmarkActive);assert.ok(await p.locator('.motion-pause').isDisabled());
 await p.setViewportSize({width:722,height:480});
 const failed=await p.evaluate(()=>window.__attempt);assert.match(failed,/窗口尺寸/);assert.equal(await p.evaluate(()=>window.__lightStudy.snapshot().benchmarkResult),null);
 assert.ok(await p.locator('.motion-pause').isEnabled());await p.setViewportSize({width:720,height:480});await p.evaluate(()=>window.__lightStudy.settle());
 result.checks.push('Resize interrupts comparison explicitly and restores controls without stale results');console.log(result.checks.at(-1));save();
 const before=await p.evaluate(()=>window.__lightStudy.snapshot());
 await p.locator('.metrics-toggle').click();await p.locator('.benchmark-performance').click();
 await p.waitForFunction(()=>window.__lightStudy.snapshot().benchmarkActive);
 assert.ok(await p.locator('.report-performance').isDisabled());assert.ok(await p.locator('.motion-pause').isDisabled());
 let last='';
 const deadline=Date.now()+15*60*1000;
 while(Date.now()<deadline){
  const status=await p.locator('.report-status').innerText();if(status!==last){console.log(status);last=status;}
  if(await p.locator('.report-status').getAttribute('data-report-id'))break;
  if(status.startsWith('对照失败')||status.startsWith('上报失败'))throw Error(status);
  await p.waitForTimeout(1000);
 }
 const id=await p.locator('.report-status').getAttribute('data-report-id');assert.ok(id);
 const stored=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+id+'.json')).report;
 assert.deepEqual(stored,posts.at(-1));assert.equal(posts.length,1);
 assert.ok(Buffer.byteLength(JSON.stringify(stored))<2*1024*1024);
 const compare=stored.scene.benchmark;assert.equal(compare.rounds.length,20);assert.deepEqual(compare.target,{gpuMedianMs:3,gpuP95Ms:5});assert.ok(compare.motion.frames>=2);assert.ok(compare.motion.gpu.count>=1);
 for(let i=0;i<4;i++)assert.deepEqual(compare.rounds.slice(i*5,i*5+5).map(r=>r.mode),i<2?['off','unshadowed','pcf','pcss','screen']:['screen','pcss','pcf','unshadowed','off']);
 for(const round of compare.rounds){
  assert.equal(round.frames.length,5);
  for(const f of round.frames){assert.equal(f.newPipelines,0);assert.equal(f.newPrograms,0);assert.equal(typeof f.gpu,'number');const cubes=f.gpuPasses.filter(p=>p.label.includes('Point Light Shadow'));assert.equal(cubes.length,['pcf','pcss','screen'].includes(round.mode)?6:0);if(round.mode==='screen'){assert.ok(f.gpuPasses.some(p=>p.label==='Moving shadow filtering'));assert.ok(f.gpuPasses.some(p=>p.label==='Moving shadow reconstruction'));}}
 }
 const after=await p.evaluate(()=>window.__lightStudy.snapshot());assert.deepEqual(after.camera,before.camera);assert.equal(after.movingLantern.mode,before.movingLantern.mode);assert.equal(after.movingLantern.seconds,before.movingLantern.seconds);
 result.reportId=id;result.build=stored.build;result.comparison=compare;result.history={frames:stored.history.frameCount,gpuSamples:stored.history.gpuSampleCount};
 result.checks.push('Actual button runs 30-second motion plus 20 warm five-sample variant groups; six cube faces regenerated in each shadowed comparison frame');
 result.checks.push('One report persisted exactly; restores original light/camera state; all timed query intervals pair with their captured frame');
 assert.deepEqual(result.errors,[]);result.passed=true;save();console.log(JSON.stringify({passed:true,id,build:stored.build}));
 }finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
