const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source='/root/threejs_space/d-game1/data/mining-light-reports/5450a143-4527-402e-94d7-c74bcd1581b3.json';
const r=JSON.parse(fs.readFileSync(source)).report,h=r.history;
const history=h.rows.map(row=>Object.fromEntries(h.columns.map((k,i)=>[k,row[i]])));
const out=path.resolve(__dirname,'../artifacts/iphone-reports/5450a143/replay.json');
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html',source,stages:[],errors:[],startedAt:new Date().toISOString()};
const save=()=>fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:655},deviceScaleFactor:1.5});page.setDefaultTimeout(240000);
  page.on('pageerror',e=>result.errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))result.errors.push(m.text());});
  await page.addInitScript(()=>{
   window.__creationEvents=[];const modules=new WeakMap();
   const shader=GPUDevice.prototype.createShaderModule;
   GPUDevice.prototype.createShaderModule=function(d){const t=performance.now(),module=shader.call(this,d);const item={type:'shader',label:d.label,ms:performance.now()-t,length:d.code.length};window.__creationEvents.push(item);modules.set(module,item);return module;};
   const pipeline=GPUDevice.prototype.createRenderPipeline;
   GPUDevice.prototype.createRenderPipeline=function(d){const t=performance.now(),p=pipeline.call(this,d);window.__creationEvents.push({type:'pipeline',label:d.label,ms:performance.now()-t,samples:d.multisample?.count,targets:d.fragment?.targets.map(t=>t.format),vertex:modules.get(d.vertex.module)?.label,fragment:modules.get(d.fragment?.module)?.label});return p;};
  });
  await page.goto(result.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.loading.error')||window.__lightStudy?.snapshot().ready&&document.querySelector('.loading')?.hidden);
  assert.equal(await page.locator('.loading.error').count(),0);
  const record=async name=>{const state=await page.evaluate(()=>({sample:window.__lightStudy.snapshot().samples.at(-1),events:window.__creationEvents.splice(0),errors:window.__lightStudy.snapshot().errors}));result.stages.push({name,...state});save();console.log(name,JSON.stringify(state.events.filter(e=>e.type==='pipeline').map(e=>({label:e.label,ms:e.ms,fragment:e.fragment,samples:e.samples}))));};
  await record('initial');
  // Replay every actual camera frame up to the reported spike. No synthetic scene.
  for(const f of history.filter(f=>f.frame>=2&&f.frame<=147)){
   await page.evaluate(async f=>{await window.__lightStudy.orbit([f.eyeX,f.eyeY,f.eyeZ],[f.targetX,f.targetY,f.targetZ]);},f);
   if([2,145,146,147].includes(f.frame))await record('source-frame-'+f.frame);
   else {const events=await page.evaluate(()=>window.__creationEvents.splice(0));if(events.length){result.stages.push({name:'source-frame-'+f.frame,events});save();}}
  }
  // Crossing the same visibility boundary again should reuse the pipelines.
  for(const id of [145,146]){
   await page.evaluate(async f=>{await window.__lightStudy.orbit([f.eyeX,f.eyeY,f.eyeZ],[f.targetX,f.targetY,f.targetZ]);},history.find(f=>f.frame===id));await record('repeat-source-frame-'+id);
  }
  assert.deepEqual(result.errors,[]);result.passed=true;save();
 }finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
