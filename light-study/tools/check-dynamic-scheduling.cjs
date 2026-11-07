const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/dynamic-optimization');fs.mkdirSync(dir,{recursive:true});
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?motion=paused',checks:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(dir,'scheduling-check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
  const p=await browser.newPage({viewport:{width:720,height:480}});p.setDefaultTimeout(240000);
  p.on('pageerror',e=>result.errors.push(String(e)));p.on('console',m=>{if(['error','warning'].includes(m.type()))result.errors.push(m.text());});
  const posts=[];p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/mining-light/performance-reports'))posts.push(r.postDataJSON());});
  await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
  assert.equal(await p.locator('.loading.error').count(),0,await p.locator('#status').innerText());
  await p.evaluate(()=>{window.__lightStudy.motion('moving');});
  await p.waitForFunction(()=>window.__lightStudy.snapshot().framesInFlight===2);
  assert.equal(await p.evaluate(()=>window.__lightStudy.snapshot().maxFramesInFlight),2);
  await p.evaluate(()=>window.__lightStudy.motion('paused'));const n=await p.evaluate(()=>window.__lightStudy.snapshot().submitted);
  await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>window.__lightStudy.snapshot().submitted),n);
  result.checks.push('Animation reaches two in-flight frames; pause drains and stops submission');save();console.log(result.checks.at(-1));
  const compare=await p.evaluate(()=>window.__lightStudy.benchmark({samples:1,rounds:1,poses:1,motionSeconds:0}));
  assert.equal(compare.rounds.length,5);assert.deepEqual(compare.rounds.map(r=>r.mode),['off','unshadowed','pcf','pcss','screen']);
  for(const r of compare.rounds){assert.equal(r.frames[0].newPipelines,0);assert.equal(r.frames[0].newPrograms,0);assert.ok(r.gpu.median>0);}
  result.comparison=compare;result.checks.push('Fixed-pose comparison captures separate warm off/unshadowed/PCF/PCSS/screen variants');save();console.log(result.checks.at(-1));
  await p.locator('.metrics-toggle').click();await p.locator('.report-performance').click();await p.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId);
  const id=await p.locator('.report-status').getAttribute('data-report-id');const stored=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+id+'.json')).report;
  assert.deepEqual(stored,posts.at(-1));assert.deepEqual(stored.scene.benchmark,compare);assert.ok(stored.history.contexts.some(c=>c.dynamicShadow==='pcf'));
  result.reportId=id;result.build=stored.build;result.checks.push('One persisted report contains comparison data and variant-specific history');assert.deepEqual(result.errors,[]);result.passed=true;save();console.log(JSON.stringify({passed:true,id}));
 }finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
