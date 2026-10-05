const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/performance-probe-v20';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[],stages:[],environment:'public desktop software GPU; diagnostic mechanics only'};
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();page.setDefaultTimeout(180000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));});
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  await page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded;});
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const original=await page.evaluate(()=>window.__miningValidation.snapshot());report.original=original;console.log('ready');
  await page.getByRole('button',{name:'性能诊断',exact:true}).click();await page.getByRole('button',{name:'开始诊断',exact:true}).click();
  for(const mode of ['idle','unlit','no-shadows','low-resolution']){
   // Capture atomically in the page: shader compilation on SwiftShader can
   // consume an entire stage between separate protocol round trips.
   const captured=await page.waitForFunction(({mode,original})=>{
    const s=window.__miningValidation.snapshot();
    if(s.renderer.probeMode!==mode)return false;
    if(mode==='no-shadows'&&(s.lighting.shadowEnabled||s.lighting.sunCastsShadow))return false;
    if(mode==='low-resolution'&&s.renderer.bufferSize[0]!==Math.floor(original.renderer.bufferSize[0]/2))return false;
    return s;
   },{mode,original},{polling:50});
   const state=await captured.jsonValue();report.stages.push({mode,state});console.log(mode);
   assert.equal(state.startup.sceneAttachMs,original.startup.sceneAttachMs,'probe must not reload the scene');
   if(mode==='no-shadows')assert.equal(state.lighting.shadowEnabled,false);
   if(mode==='low-resolution'){
    assert.equal(state.renderer.bufferSize[0],Math.floor(original.renderer.bufferSize[0]/2));assert.equal(state.renderer.bufferSize[1],Math.floor(original.renderer.bufferSize[1]/2));
   }
  }
  await page.getByText('已恢复正常画面。对比前后两次正常画面，检查是否存在明显温度/负载漂移。',{exact:true}).waitFor();
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.renderer.probeMode==='normal'&&s.lighting.shadowEnabled;});
  report.restored=await page.evaluate(()=>window.__miningValidation.snapshot());assert.deepEqual(report.restored.renderer.bufferSize,original.renderer.bufferSize);
  assert.equal(await page.locator('.performance-probe tbody tr').count(),6);report.table=await page.locator('.performance-probe table').innerText();
  await page.getByRole('button',{name:'复制结果',exact:true}).click();await page.getByText('结果已复制。',{exact:true}).waitFor();report.copied=await page.evaluate(()=>navigator.clipboard.readText());assert.match(report.copied,/暂停 3D 绘制/);
  await page.screenshot({path:`${out}/results.png`});
  // Cancel must restore the active temporary override as well.
  await page.getByRole('button',{name:'开始诊断',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().renderer.probeMode==='idle');
  await page.getByRole('button',{name:'取消',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().renderer.probeMode==='normal');report.cancelRestores=true;
  await page.getByRole('button',{name:'关闭',exact:true}).click();assert.equal(await page.locator('.performance-probe').count(),0);report.closeWorks=true;
  assert.deepEqual(report.errors,[]);
 }finally{await fs.writeFile(`${out}/public-report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
