const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const out='artifacts/reflection-off-v18';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[],environment:'public desktop software GPU; not iPhone performance'};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));});
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready);console.log('ready');
  await page.evaluate(()=>{window.__miningValidation.teleport([0,.1,34]);window.__miningValidation.look(0,.32);});
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&!s.queue&&!s.inFlight;});
  const frame=await page.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);
  await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+3,frame);
  report.state=await page.evaluate(()=>window.__miningValidation.snapshot());
  assert.equal(report.state.renderer.profile.reflectionMode,'off');
  assert.equal(report.state.renderer.profile.reflectionCalls,0);
  assert.equal(report.state.facilities.ponds.reflectionTarget.captures,0);
  assert.equal(report.state.facilities.ponds.reflectionTarget.enabled,false);
  assert.equal(report.state.renderer.calls,report.state.renderer.profile.mainCalls);
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  await page.screenshot({path:`${out}/ponds-off.png`});
  assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report.state.renderer));
 }finally{await fs.writeFile(`${out}/public-report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
