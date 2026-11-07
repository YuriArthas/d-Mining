const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const variant=process.argv[2]||'motion';
assert.ok(['motion','resize','ao'].includes(variant));
const dir=path.resolve(__dirname,'../artifacts/phone-shadow/regression-'+variant);fs.mkdirSync(dir,{recursive:true});
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?motion=paused',variant,errors:[],states:[]};
const save=()=>fs.writeFileSync(path.join(dir,'check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
 const p=await browser.newPage({viewport:{width:390,height:655},deviceScaleFactor:1.5});p.setDefaultTimeout(180000);
 p.on('pageerror',e=>result.errors.push(String(e)));p.on('console',m=>{if(['error','warning'].includes(m.type()))result.errors.push(m.text());});
 await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);assert.equal(await p.locator('.loading.error').count(),0);
 const capture=async name=>{result.states.push({name,snapshot:await p.evaluate(()=>window.__lightStudy.snapshot())});await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,name+'.png')});await p.evaluate(()=>window.__lightStudy.capture(false));save();console.log(name);};
 await p.evaluate(()=>window.__lightStudy.motionTime(12));
 if(variant==='motion'){
  await capture('entrance');
  const before=await p.evaluate(()=>window.__lightStudy.snapshot().submitted);
  await p.evaluate(()=>{window.__lightStudy.motion('moving');});
  await p.waitForFunction(n=>window.__lightStudy.snapshot().submitted>=n+3,before);
  await p.evaluate(()=>window.__lightStudy.motion('paused'));
  const paused=await p.evaluate(()=>window.__lightStudy.snapshot());assert.equal(paused.movingLantern.mode,'paused');assert.ok(paused.movingLantern.seconds>12);
  await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>window.__lightStudy.snapshot().submitted),paused.submitted);
  await capture('after-motion');
  await p.locator('.metrics-toggle').click();await p.locator('.report-performance').click();await p.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId);
  result.reportId=await p.locator('.report-status').getAttribute('data-report-id');
  const report=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+result.reportId+'.json')).report;
  assert.equal(report.latestFrame.context.dynamicShadow,'screen');assert.ok(report.history.rows.some(r=>r[3]==='animation'));result.build=report.build;
 }else if(variant==='resize'){
  await p.setViewportSize({width:640,height:426});await p.evaluate(()=>window.__lightStudy.settle());
  await p.evaluate(()=>window.__lightStudy.orbit([4.93,11.72,9.79],[-1,1.6,-8]));
  await capture('even-buffer');
  let s=result.states.at(-1).snapshot;assert.deepEqual(s.lighting.dynamicShadow.outputSize,[960,639]);assert.deepEqual(s.lighting.dynamicShadow.rawSize,[480,320]);
  await p.setViewportSize({width:391,height:657});await p.evaluate(()=>window.__lightStudy.settle());await capture('odd-buffer');
  s=result.states.at(-1).snapshot;assert.deepEqual(s.lighting.dynamicShadow.outputSize,[586,985]);assert.deepEqual(s.lighting.dynamicShadow.rawSize,[293,493]);
 }else{
  await p.evaluate(()=>window.__lightStudy.ao(false));await p.evaluate(()=>window.__lightStudy.draw());await capture('ao-disabled');
  const s=result.states.at(-1).snapshot;assert.equal(s.lighting.ao,false);for(const label of ['Geometry normals','Moving shadow filtering','Moving shadow reconstruction'])assert.ok(s.gpuPasses.some(p=>p.label===label));
 }
 assert.deepEqual(result.errors,[]);result.passed=true;save();
 }finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
