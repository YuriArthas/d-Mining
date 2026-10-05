const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/initial-pit-v29';await fs.mkdir(out,{recursive:true});const report={errors:[]};const save=()=>fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(()=>{const run=()=>window.__pauseRender?setTimeout(run,30):cb(performance.now());setTimeout(run,500);});});
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded;});await ready();
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const cdp=await page.context().newCDPSession(page);
  const shot=async(name)=>{await page.evaluate(()=>{window.__pauseRender=true;});const {data}=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(`${out}/${name}.png`,Buffer.from(data,'base64'));await page.evaluate(()=>{window.__pauseRender=false;});};
  const pose=async(p,yaw,pitch)=>{await page.evaluate(({p,yaw,pitch})=>{window.__miningValidation.teleport(p);window.__miningValidation.look(yaw,pitch);},{p,yaw,pitch});await ready();const f=(await snap()).frames;await page.waitForFunction(f=>window.__miningValidation.snapshot().frames>f+1,f);};
  await pose([0,.1,8.5],0,.85);report.pit=await snap();
  report.cells=await page.evaluate(()=>({air:[-1,-2,-3,-4].map(y=>window.__miningValidation.cell([0,y,-1])),floor:window.__miningValidation.cell([0,-5,-1]),rim:window.__miningValidation.cell([3,-1,3]),protected:window.__miningValidation.cell([4,-1,0])}));
  assert.deepEqual(report.cells.air,[0,0,0,0]);assert.ok(report.cells.floor>0);assert.ok(report.cells.rim>0);assert.equal(report.cells.protected,7);assert.equal(report.pit.editBytes,0);assert.equal(report.pit.economy.inventory.used,0);await save();
  await shot('initial-pit');
  await pose([38,.1,9],-Math.PI/2,-.12);report.boundary=await snap();
  const lights=report.boundary.lighting.surfaceArea.wallLights;assert.equal(lights.length,22);assert.ok(lights.every(l=>l.position[0]>=-43&&l.position[0]<=61&&l.position[2]>=-35&&l.position[2]<=77));await save();await shot('half-step-walls');
  await pose([1,.1,-1],0,.2);report.landed=await snap();assert.ok(Math.abs(report.landed.position[1]+8)<.1);assert.equal(report.landed.economy.inventory.used,0);
  assert.deepEqual(report.errors,[]);report.passed=true;await save();console.log('uneven initial pit, protected apron, real floor collision, zero rewards, compact wall torch anchors: passed');
 }catch(e){report.failure=String(e);throw e;}finally{await save();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
