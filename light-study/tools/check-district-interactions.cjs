const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/district-public/interactions');fs.mkdirSync(dir,{recursive:true});
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html',environment:'Desktop Chromium / SwiftShader, no hardware performance claim',errors:[]};
const save=()=>fs.writeFileSync(path.join(dir,'check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
try{
  const p=await browser.newPage({viewport:{width:960,height:640}});p.setDefaultTimeout(240000);
  p.on('pageerror',e=>result.errors.push(String(e)));p.on('console',m=>{if(['error','warning'].includes(m.type()))result.errors.push(m.text());});
  await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);assert.equal(await p.locator('.loading.error').count(),0);
  const first=await p.evaluate(()=>window.__lightStudy.snapshot());assert.equal(first.renderLoop,'continuous');assert.equal(first.tour.running,false);
  await p.waitForFunction(n=>window.__lightStudy.snapshot().submitted>=n+3,first.submitted);result.default=await p.evaluate(()=>window.__lightStudy.snapshot());
  // Controlled visibility event tests app scheduling, not an OS backgrounding claim.
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await p.waitForFunction(()=>!window.__lightStudy.snapshot().inFlight);const submitted=await p.evaluate(()=>window.__lightStudy.snapshot().submitted);
  await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>window.__lightStudy.snapshot().submitted),submitted);
  await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(n=>window.__lightStudy.snapshot().submitted>n,submitted);result.visibilityHandlerPassed=true;
  await p.evaluate(()=>window.__lightStudy.loop(false));
  // RGBM uses alpha as data. Check actual external-image GPU upload, including
  // tiny alpha values, rather than assuming a canvas round-trip is equivalent.
  const expected=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../artifacts/district-public/atlas-samples.json')));
  result.atlasUpload=await p.evaluate(async samples=>{
    const img=new Image();img.src=new URL('./assets/district-light.webp',location.href).href;await img.decode();
    const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
    const texture=device.createTexture({size:[1,1],format:'rgba8unorm',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT});
    const buffer=device.createBuffer({size:256*samples.length,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    for(let i=0;i<samples.length;i++){
      device.queue.copyExternalImageToTexture({source:img,origin:{x:samples[i].x,y:samples[i].y}},{texture,premultipliedAlpha:false},[1,1]);
      const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer,offset:i*256,bytesPerRow:256},[1,1]);device.queue.submit([encoder.finish()]);
    }
    await buffer.mapAsync(GPUMapMode.READ);const bytes=new Uint8Array(buffer.getMappedRange());
    const values=samples.map((s,i)=>({...s,uploaded:[...bytes.slice(i*256,i*256+4)]}));buffer.unmap();texture.destroy();buffer.destroy();device.destroy();return values;
  },expected);
  result.atlasUpload.forEach(s=>assert.deepEqual(s.uploaded,s.rgba));
  const before=await p.evaluate(()=>window.__lightStudy.snapshot().camera);await p.mouse.move(550,330);await p.mouse.down();await p.mouse.move(660,350,{steps:5});await p.mouse.up();await p.evaluate(()=>window.__lightStudy.settle());
  assert.notDeepEqual(await p.evaluate(()=>window.__lightStudy.snapshot().camera),before);result.orbitPassed=true;
  await p.keyboard.press('h');assert.equal(await p.evaluate(()=>document.body.classList.contains('capture')),true);await p.keyboard.press('h');assert.equal(await p.evaluate(()=>document.body.classList.contains('capture')),false);
  await p.setViewportSize({width:1100,height:700});await p.waitForFunction(()=>window.__lightStudy.snapshot().viewport.bufferWidth===1100);await p.evaluate(()=>window.__lightStudy.settle());
  await p.setViewportSize({width:960,height:640});await p.waitForFunction(()=>window.__lightStudy.snapshot().viewport.bufferWidth===960);await p.locator('[data-view="overview"]').click();await p.evaluate(()=>window.__lightStudy.settle());
  await p.locator('.metrics-toggle').click();await p.locator('.static-benchmark').click();
  await p.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId||document.querySelector('.report-status').textContent.startsWith('测量失败'));
  const id=await p.locator('.report-status').getAttribute('data-report-id');assert.ok(id,await p.locator('.report-status').innerText());
  const report=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+id+'.json')).report;
  result.staticReportId=id;result.benchmark=report.scene.benchmark;
  assert.equal(result.benchmark.type,'static-continuous');assert.equal(result.benchmark.seconds,30);assert.equal(result.benchmark.context.motion,'off');assert.ok(result.benchmark.frameCount>=2);
  const history=report.history;
  assert.ok(history.rows.length>=result.benchmark.frameCount);result.historyFrames=history.rows.length;
  await p.screenshot({path:path.join(dir,'performance.png')});assert.deepEqual(result.errors,[]);result.passed=true;save();console.log('Static report',id,'and desktop controls passed');
}finally{await browser.close();save();}})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
