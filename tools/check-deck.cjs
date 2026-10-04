const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
(async()=>{
 const base=process.argv[2]||'http://127.0.0.1:4175/',label=process.argv[3]||'deck-local',report={checks:[],samples:[],errors:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{for(const [layout,viewport,touch] of [['desktop',{width:1280,height:720},false],['mobile',{width:844,height:390},true]].filter(([l])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(l))){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)report.errors.push(r.url())});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
  const shot=async view=>{const s=await snap();await page.screenshot({path:`artifacts/${label}-${layout}-${view}.png`});report.samples.push({layout,view,render:s.renderer,position:s.position,lighting:s.lighting})};
  await page.goto(base+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  assert.equal((await snap()).camera.obstructed,false);await shot('arrival');
  await page.evaluate(()=>window.__miningValidation.teleport([0,.1,6.8]));await ready();
  if(touch){
   const cdp=await page.context().newCDPSession(page),y=viewport.height-96,x=180;
   assert.ok(await page.evaluate(({x,y,end})=>[x,x+24,end].every(px=>document.querySelector('.scene').contains(document.elementFromPoint(px,y))),{x,y,end:x+Math.PI/.006}),'gesture crosses UI');
   // Queue an ordered, continuous gesture before waiting for browser acknowledgements.
   // A slow software GPU can delay the start acknowledgement past the mine-hold deadline.
   const start=cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   const firstMove=cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+24,y,id:1}]});
   const finalMove=cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+Math.PI/.006,y,id:1}]});
   await start;await firstMove;await finalMove;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{await page.mouse.move(150,500);await page.mouse.down({button:'right'});await page.mouse.move(150+Math.PI/.004,500,{steps:3});await page.mouse.up({button:'right'});}
  try{await page.waitForFunction(()=>Math.abs(Math.abs(window.__miningValidation.snapshot().view.yaw)-Math.PI)<.03)}catch(e){
   await fs.writeFile(`artifacts/${label}-${layout}-failure.json`,JSON.stringify({snapshot:await snap(),input:await page.evaluate(()=>window.__mining?.getInput())},null,2));throw e;
  }
  await page.waitForTimeout(400);await shot('reverse');
  if(!touch){
   await page.locator('.scene').focus();await page.keyboard.down('w');await page.waitForFunction(()=>window.__miningValidation.snapshot().position[2]>14);await page.keyboard.up('w');await ready();assert.ok(Math.abs((await snap()).position[1]-2)<.05);
   await page.keyboard.down('s');await page.waitForFunction(()=>window.__miningValidation.snapshot().position[2]<7);await page.keyboard.up('s');await ready();assert.ok((await snap()).position[1]<.05);
  }
  const still=await snap();await page.waitForFunction(n=>window.__miningValidation.snapshot().frames>=n,still.frames+15);assert.equal((await snap()).lighting.staticShadowUpdates,still.lighting.staticShadowUpdates);
  report.checks.push(`${layout}: clear arrival, real camera drag to reverse view, cached shadows`+(touch?'':', actual walking up and down deck ramp without jump'));
  await page.close();
 }
 assert.deepEqual(report.errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2));console.log(report.checks);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
