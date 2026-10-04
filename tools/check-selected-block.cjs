const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
  await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);let next=0;const jobs=new Map();window.requestAnimationFrame=cb=>{const id=++next,j={timer:0,frame:0};jobs.set(id,j);j.timer=setTimeout(()=>{j.frame=raf(t=>{jobs.delete(id);cb(t)})},1500);return id;};window.cancelAnimationFrame=id=>{const j=jobs.get(id);if(j){clearTimeout(j.timer);cancel(j.frame);jobs.delete(id)}};});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit},null,{polling:400});
  await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  await page.evaluate(()=>{window.__miningValidation.teleport([0,.1,0]);window.__miningValidation.look(.3,.7)});await ready();
  await page.mouse.move(690,420);await page.waitForFunction(()=>window.__miningValidation.snapshot().target!==null,null,{polling:500});
  const frame=await page.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);
  await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+2,frame,{polling:400});
  await page.screenshot({path:'artifacts/mine-details-v2/selected-block.png'});
  const state=await page.evaluate(()=>window.__miningValidation.snapshot());assert.ok(state.target);assert.equal(state.aim.mode,'mouse');assert.deepEqual(errors,[]);
  await fs.writeFile('artifacts/mine-details-v2/selection-report.json',JSON.stringify({errors,state},null,2));
  await page.getByRole('button',{name:/^退出游戏/}).click();await page.waitForURL('https://w-sunjun-public.dev.clock-p.com/');
  console.log('Public selected-block shader, mouse targeting and exit passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
