const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const {digCells}=require('./combat-browser.cjs');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'room-entry-public':'room-entry-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),errors=[];
 const page=await browser.newPage({viewport:{width:1120,height:630}});page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
 try{
  await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1&samples=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  await digCells(page,[[-3,-188,-2],[-3,-189,-2]]);
  await page.evaluate(()=>window.__miningValidation.teleport([-5,-377.9,-3]));await ready();
  const before=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(before.economy.destinations[0].unlocked,false);
  await digCells(page,[[-3,-190,-2]]);
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.grounded&&s.position[1]<-399.9&&s.position[1]>-400.1});await ready();
  const after=await page.evaluate(()=>window.__miningValidation.snapshot());
  assert.ok(after.economy.destinations[0].unlocked);assert.equal(after.economy.destinations[1].unlocked,false);assert.deepEqual(after.facilities.colliders,['rest-400']);
  assert.ok(after.camera.position.every(Number.isFinite));assert.deepEqual(errors,[]);
  await page.screenshot({path:`artifacts/${label}.png`});
  const report={checks:['mine through real room ceiling at 378m; fall into 10-cell-high cavity; stream in fixed platform before landing; land at 400m without falling through; unlock on arrival'],position:after.position,facilities:after.facilities,timings:after.timings,errors};
  await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
