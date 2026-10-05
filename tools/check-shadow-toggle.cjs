const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/shadow-toggle-v23';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[],states:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));});
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  await page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded;});
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const initial=await page.evaluate(()=>window.__miningValidation.snapshot());report.states.push(initial);
  assert.equal(initial.lighting.shadowEnabled,false);assert.equal(initial.lighting.sunCastsShadow,false);
  await page.getByRole('button',{name:'开启场景阴影',exact:true}).click();
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.lighting.shadowEnabled&&s.lighting.sunCastsShadow;});
  report.states.push(await page.evaluate(()=>window.__miningValidation.snapshot()));console.log('enabled');
  await page.getByRole('button',{name:'关闭场景阴影',exact:true}).click();
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return !s.lighting.shadowEnabled&&!s.lighting.sunCastsShadow;});
  report.states.push(await page.evaluate(()=>window.__miningValidation.snapshot()));console.log('disabled');
  for(const s of report.states){assert.equal(s.startup.sceneAttachMs,initial.startup.sceneAttachMs);assert.deepEqual(s.renderer.bufferSize,initial.renderer.bufferSize);assert.equal(s.lighting.surfaceArea.activeLights,12);}
  await page.screenshot({path:`${out}/off.png`});
  await page.getByRole('button',{name:'性能诊断',exact:true}).click();
  await page.getByRole('button',{name:'开始诊断',exact:true}).click();
  await page.getByRole('button',{name:'开启场景阴影',exact:true}).click();
  await page.getByText('阴影设置已改变，请重新开始诊断。',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'取消',exact:true}).count(),0);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'关闭场景阴影',exact:true}).click();
  await page.waitForFunction(()=>!window.__miningValidation.snapshot().lighting.shadowEnabled);
  report.probeCancelRestoresPreference=true;assert.deepEqual(report.errors,[]);
 }finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
