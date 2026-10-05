const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/render-rate-v25';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const report={errors:[],states:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));});
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  await page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded;});
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const capture=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const initial=await capture();report.states.push(initial);assert.equal(initial.renderer.renderRate,'display');
  await page.getByRole('button',{name:'切换为60帧上限',exact:true}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().renderer.renderRate==='60');report.states.push(await capture());
  await page.getByRole('button',{name:'跟随屏幕刷新率',exact:true}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().renderer.renderRate==='display');report.states.push(await capture());
  for(const s of report.states){assert.equal(s.startup.sceneAttachMs,initial.startup.sceneAttachMs);assert.equal(s.lighting.shadowEnabled,false);assert.equal(s.facilities.surfaceDetails.bakedShadows.enabled,true);assert.deepEqual(s.renderer.bufferSize,initial.renderer.bufferSize);}
  assert.deepEqual(report.errors,[]);await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  await page.screenshot({path:`${out}/controls.png`});console.log('display / 60 / display passed; scene not reloaded');
 }finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
