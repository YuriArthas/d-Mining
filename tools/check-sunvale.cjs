const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const {digCells}=require('./combat-browser.cjs');
(async()=>{
 const base='https://w-sunjun-public.dev.clock-p.com/',report={mode:process.env.SMOKE?'final-art-smoke':'full',errors:[],checks:[],samples:[],resources:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const save=()=>fs.writeFile('artifacts/sunvale-public-report.json',JSON.stringify(report,null,2));
 try{for(const [layout,viewport,touch] of [['desktop',{width:1280,height:720},false]].filter(([x])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(x))){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch});page.setDefaultTimeout(180000);
  // Software GPU only: cap harness presentation, preserving RAF cancellation.
  // This is not shipped and is not evidence of hardware frame rate.
  await page.addInitScript(()=>{
   const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);let next=0;const jobs=new Map();
   window.requestAnimationFrame=cb=>{const id=++next,j={timer:0,frame:0};jobs.set(id,j);j.timer=setTimeout(()=>{j.frame=raf(t=>{jobs.delete(id);cb(t)})},750);return id;};
   window.cancelAnimationFrame=id=>{const j=jobs.get(id);if(j){clearTimeout(j.timer);cancel(j.frame);jobs.delete(id)}};
  });
  page.on('pageerror',e=>{report.errors.push(e.message);console.log('ERROR',e.message)});
  page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('GL',m.text().slice(0,1400))}});
  page.on('requestfailed',r=>{report.errors.push(r.url()+': '+r.failure()?.errorText);console.log('NETWORK',r.url(),r.failure()?.errorText)});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=async()=>{try{return await page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit},null,{polling:500});}catch(error){report.lastState=await page.evaluate(()=>window.__miningValidation?.snapshot());await save();throw error;}};
  const shot=async name=>{await page.screenshot({path:`artifacts/sunvale-${layout}-${name}.png`,timeout:180000});report.samples.push({layout,name,snapshot:await snap()});await save();console.log(layout,name)};
  await page.goto(base);const preview=page.locator('a[href$="games/mining-test/index.html"]');assert.equal(await preview.count(),1);assert.equal(await page.locator('a[href$="games/mining/index.html"]').count(),1);assert.equal(await preview.evaluate(el=>el.previousElementSibling.querySelector('strong').textContent),'Mining');
  await page.goto(base+'games/mining-test/index.html?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const s=await snap();assert.equal(s.facilities.surfaceShading.version,'sunvale-material-v2');assert.equal(s.facilities.surfaceShading.runtimeOcclusionProbes,0);assert.equal(s.facilities.visuals.length,10);assert.equal(s.camera.obstructed,false);assert.equal(s.lighting.surfaceFog,false);assert.equal(s.startup.sky.sharedSkyLighting,true);
  const probes=await page.evaluate(()=>{const api=window.__miningValidation;let count=0;for(let x=-10;x<10;x++)for(let z=-10;z<10;z++)if(api.canMine([x,-1,z]))count++;return {count,shaft:[[-7.99,-7.99],[0,0],[7.99,7.99],[-7.99,7.99],[7.99,-7.99]].map(([x,z])=>api.surfaceHeight(x,z)),outside:api.surfaceHeight(8.01,0)}});
  assert.equal(probes.count,64);assert.ok(probes.shaft.every(h=>h===null));assert.ok(probes.outside!==null&&Math.abs(probes.outside)<.03);report.checks.push(layout+': open 64-cell shaft, flat spawn, sky IBL, ten scenery sites, no runtime AO');
  await shot('arrival');
  report.resources.push({layout,entries:await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/glb|webp|wasm|index-/.test(r.name)).map(r=>({name:r.name,duration:r.duration,bytes:r.encodedBodySize,transfer:r.transferSize})))});await save();
  if(!touch){
   if(!process.env.SMOKE){await page.evaluate(()=>window.__miningValidation.teleport([0,.1,9.5]));await ready();await digCells(page,[[-1,-1,3],[0,-1,3]]);await ready();assert.ok((await snap()).economy.inventory.used>0);
   await page.evaluate(()=>window.__miningValidation.teleport([15,.1,11]));await ready();assert.equal((await snap()).economy.inventory.used,0);assert.ok((await snap()).economy.coins>0);report.checks.push('mining and automatic sale');}
   await page.evaluate(()=>{window.__miningValidation.teleport([6,.1,18]);window.__miningValidation.look(-.55,.15)});await ready();await shot('market');
   const hill=await page.evaluate(()=>window.__miningValidation.surfaceHeight(72,32));await page.evaluate(y=>window.__miningValidation.teleport([72,y+.2,32]),hill);await ready();const h=await snap();assert.ok(Math.abs(h.position[1]-hill)<.15);assert.deepEqual(h.facilities.visuals,s.facilities.visuals);report.checks.push('authored hill mesh matches streamed collision; distant scenery persists');
  }
  if(!process.env.SMOKE){await page.evaluate(()=>window.__miningValidation.teleport('deep'));await ready();assert.equal((await snap()).facilities.visuals.length,10);
  const home=page.getByRole('button',{name:'返回地表',exact:true});if(touch)await home.tap();else await home.click();await ready();assert.equal((await snap()).economy.atHome,true);report.checks.push(layout+': underground/home round trip');}
  const exit=page.getByRole('button',{name:/^退出游戏/});if(touch)await exit.tap();else await exit.click();await page.waitForURL(base);report.checks.push(layout+': exit to public game list');await save();await page.close();
 }assert.deepEqual(report.errors,[]);
 }finally{await save();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
