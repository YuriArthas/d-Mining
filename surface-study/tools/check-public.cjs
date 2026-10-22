const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const url=process.env.SCENE_URL||'https://w-sunjun-public.dev.clock-p.com/games/mining-surface/index.html';
 const dir=path.resolve(__dirname,process.env.ARTIFACT_DIR||'../artifacts/public');await fs.mkdir(dir,{recursive:true});
 const report={url,startedAt:new Date().toISOString(),errors:[],checks:[],views:[],profile:[]};
 const browser=await chromium.launch({dumpio:process.env.DEBUG_GPU==='1',args:['--no-sandbox','--disable-quic',...(process.env.GPU_VULKAN==='1'?['--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface']:['--use-angle=swiftshader']),'--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 let page=await browser.newPage({viewport:{width:1440,height:900}});
 const observe=()=>{page.setDefaultTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});};observe();
 const snap=()=>page.evaluate(()=>window.__surfaceStudy?.snapshot());
 const check=text=>{report.checks.push(text);console.log('PASS',text)};
 const shot=async name=>{await page.evaluate(()=>window.__surfaceStudy.draw());await page.screenshot({path:path.join(dir,name+'.png'),timeout:120000})};
 const openScene=async()=>{
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.loading.error')||window.__surfaceStudy?.snapshot().ready&&!document.querySelector('.loading:not([hidden])'),null,{timeout:240000,polling:500});
  if(await page.locator('.loading.error').count())throw Error(await page.locator('.loading.error').innerText());
 };
 const measuredFrames=async(count=3)=>{
  const frames=[];for(let i=0;i<count;i++){
   await page.evaluate(()=>window.__surfaceStudy.draw());const s=await snap();
   if(s.gpuMs!==null)assert.equal(s.gpuSampleFrame,s.submitted,'GPU timestamp belongs to the measured frame');
   frames.push({frame:s.submitted,gpuSampleFrame:s.gpuSampleFrame,cpu:s.cpuSubmitMs,gpu:s.gpuMs,render:s.render,memory:s.memory,adapter:s.adapter,assets:s.assets});
  }return frames;
 };
 try{
  console.log('Opening',url);await openScene();
  const s=await snap();assert.equal(s.renderer,'WebGPU');report.adapter=s.adapter;report.release=await page.locator('script[src]').evaluateAll(n=>n.map(e=>e.src));
  check('Independent public entry initializes actual WebGPU without fallback');
  if(process.env.SMOKE_ONLY==='1'){await shot('smoke');report.views.push(await snap());return;}
  if(process.env.PROFILE_ONLY==='1'){
   for(let i=0;i<2;i++)await page.evaluate(()=>window.__surfaceStudy.draw());
   await shot('overview');
   for(let i=0;i<5;i++){await page.evaluate(()=>window.__surfaceStudy.draw());report.profile.push(await snap());}
   if(process.env.TONE_COMPARE==='1'){
    for(const tone of ['aces','linear']){await page.evaluate(t=>window.__surfaceStudy.tone(t),tone);await shot('tone-'+tone);report.views.push(await snap());}
    await page.evaluate(()=>window.__surfaceStudy.tone('neutral'));
   }
   for(const view of ['bridge','quarry','garden']){await page.evaluate(v=>window.__surfaceStudy.view(v),view);await shot(view);report.views.push(await snap());}
   const candidates=[{name:'garden-clear',eye:[26,9,23],target:[16,3.5,2]},{name:'bridge-full',eye:[12,11,47],target:[0,4,2]}];
   for(const c of candidates){await page.evaluate(c=>window.__surfaceStudy.orbit(c.eye,c.target),c);await shot(c.name);}
   assert.deepEqual(report.errors,[]);report.completedAt=new Date().toISOString();return;
  }
  await shot('01-overview');report.views.push(await snap());
  // Initial shadow textures can invalidate once during allocation in r186.
  await page.evaluate(()=>window.__surfaceStudy.draw());
  const warm=await snap();assert.equal(warm.lighting.shadowNeedsUpdate,false);assert.equal(warm.render.frameCalls,2);report.defaultWarm=warm;
  assert.equal(warm.assets.postPixelation,false);assert.ok(warm.geometry.texturedBatches>0);assert.ok(warm.geometry.texturedTriangles>0);
  assert.equal(warm.assets.atlases.length,2);for(const atlas of warm.assets.atlases){assert.ok(atlas.width<=512&&atlas.height<=512);assert.equal(atlas.magFilter,'nearest');}
  assert.equal(await page.locator('[data-pixel]').count(),0);
  check('New Blender meshes preserve their pixel atlas UVs at native output resolution; old screen-pixel controls removed');
  check('Warm default uses two render passes with the static shadow map cached');
  const before=(await snap()).submitted;await page.waitForTimeout(2000);assert.equal((await snap()).submitted,before);check('Idle scene submits zero additional GPU frames over two seconds');
  for(const view of ['bridge','quarry','garden']){
   await page.locator(`[data-view="${view}"]`).click();await page.waitForFunction(v=>{const s=window.__surfaceStudy.snapshot();return s.view===v&&s.ready&&!s.inFlight},view,{polling:300});
   await shot(view);report.views.push(await snap());console.log('Captured',view);
  }
  check('All curated views open and render without page or GPU errors');
  await page.locator('[data-view="overview"]').click();await page.evaluate(()=>window.__surfaceStudy.draw());
  await page.locator('[data-light="golden"]').click();await shot('05-golden');report.views.push(await snap());
  await page.locator('[data-light="day"]').click();await page.evaluate(()=>window.__surfaceStudy.draw());
  // Matched lighting/camera A/B includes all geometry, AO and output passes.
  for(const enabled of [false,true]){
   await page.evaluate(v=>window.__surfaceStudy.ao(v),enabled);await shot(enabled?'07-ao':'06-no-ao');
   const s=await snap();assert.equal(s.lighting.ao,enabled);assert.equal(s.render.frameCalls,enabled?6:2);
   report.profile.push({ao:enabled,frames:await measuredFrames()});
  }
  await page.evaluate(()=>window.__surfaceStudy.ao(false));
  check('AO comparison records measured GPU timestamps and complete render counters');
  await page.locator('canvas').dragTo(page.locator('canvas'),{sourcePosition:{x:720,y:450},targetPosition:{x:820,y:470}});
  await page.evaluate(()=>window.__surfaceStudy.draw());assert.notDeepEqual((await snap()).camera.position,report.views[0].camera.position);check('Pointer orbit changes the actual camera');
  await page.evaluate(()=>window.__surfaceStudy.ao(false));
  for(const view of [{name:'10-side',eye:[-37,17,29],target:[0,3,-3]},{name:'11-pet-rear',eye:[26,10,-13],target:[17,3,3]}]){await page.evaluate(v=>window.__surfaceStudy.orbit(v.eye,v.target),view);await shot(view.name);report.views.push(await snap());}
  await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>window.__surfaceStudy.view('overview'));await shot('08-overview-1080');
  assert.equal((await snap()).viewport.width,1920);check('Desktop 1920 by 1080 resize keeps scene and view controls usable');
  report.final=await snap();
  await page.evaluate(()=>window.__surfaceStudy.capture(true));await page.screenshot({path:path.join(dir,'09-clean-overview-1080.png'),timeout:120000});
  await page.goto('https://w-sunjun-public.dev.clock-p.com/',{waitUntil:'domcontentloaded'});
  await page.locator('a[href*="games/mining-surface/index.html"]').waitFor();assert.equal(await page.locator('a[href*="games/mining/index.html"]').count(),1);assert.equal(await page.locator('a[href*="games/mining-test/index.html"]').count(),1);
  check('Public launcher includes independent scene beside both Mining releases');
  // Close the first page before creating another WebGPU device. This host uses
  // a software adapter, so concurrent heavy pages would distort measurements.
  await page.close();page=await browser.newPage({viewport:{width:1439,height:917},deviceScaleFactor:1.5});observe();await openScene();
  for(let i=0;i<2;i++)await page.evaluate(()=>window.__surfaceStudy.draw());
  await shot('native-dpr15');const highDpi=await snap();assert.equal(highDpi.viewport.dpr,1.5);assert.equal(highDpi.render.frameCalls,2);assert.equal(highDpi.assets.postPixelation,false);report.highDpi=highDpi;
  check('Desktop DPR 1.5 uses native rendering with authored surface texels');
  assert.deepEqual(report.errors,[]);report.completedAt=new Date().toISOString();
 }catch(e){report.failure=String(e);report.snapshot=await snap().catch(()=>null);await page.screenshot({path:path.join(dir,'failure.png'),timeout:30000}).catch(()=>{});throw e;}
 finally{await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
