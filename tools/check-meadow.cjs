const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
(async()=>{
 const base=process.argv[2]||'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html',label=process.argv[3]||'meadow',report={errors:[],samples:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{for(const [layout,viewport,touch] of [['mobile',{width:844,height:390},true],['desktop',{width:1280,height:720},false]].filter(([name])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(name))){
   const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch});page.setDefaultTimeout(150000);
   if(process.env.SOFTWARE_FRAME_MS)await page.addInitScript(ms=>{const frame=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>frame(()=>setTimeout(()=>cb(performance.now()),ms));},Number(process.env.SOFTWARE_FRAME_MS));
   page.on('pageerror',e=>{report.errors.push(e.message);console.log('ERROR',e.message)});
   page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('GL',m.text().slice(0,1600))}});
   page.on('response',r=>{if(r.status()>=400)report.errors.push(r.url())});
   const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
   const shot=async name=>{await page.screenshot({path:`artifacts/${label}-${layout}-${name}.png`,timeout:150000});report.samples.push({layout,name,snapshot:await page.evaluate(()=>window.__miningValidation.snapshot())});console.log(layout,name);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2))};
   if(base.includes('w-sunjun-public')){
    await page.goto(new URL('../../',base).href);
    const preview=page.locator('a[href$="games/mining-test/index.html"]');assert.equal(await preview.count(),1);
    assert.equal(await page.locator('a[href$="games/mining/index.html"]').count(),1);
    assert.equal(await preview.evaluate(el=>el.previousElementSibling.querySelector('strong').textContent),'Mining');
    if(!touch)await page.screenshot({path:'artifacts/meadow-public-game-list.png'});
    await preview.click();await page.waitForURL('**/games/mining-test/index.html');report.launcherEntry=true;
   }
   await page.goto(base+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   const start=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(start.facilities.surfaceShading.version,'surface-look-v3-matte');assert.equal(start.camera.obstructed,false);if(!process.env.SKIP_ARRIVAL)await shot('arrival');
   if(!touch){
    await page.evaluate(()=>window.__miningValidation.teleport([0,.1,90]));await ready();
    const view=await page.evaluate(()=>window.__miningValidation.snapshot().view);
    await page.mouse.move(600,360);await page.mouse.down({button:'right'});await page.mouse.move(600+view.yaw/.004,360+(.06-view.pitch)/.004,{steps:4});await page.mouse.up({button:'right'});
    await page.waitForFunction(()=>Math.abs(window.__miningValidation.snapshot().view.yaw)<.03);await shot('panorama');
   }
   await page.evaluate(()=>window.__miningValidation.teleport('deep'));await ready();
   const homeButton=page.getByRole('button',{name:'返回地表',exact:true});if(touch)await homeButton.tap();else await homeButton.click();await ready();
   const returned=await page.evaluate(()=>window.__miningValidation.snapshot());
   assert.ok(Math.abs(returned.position[0]+13)<.05&&Math.abs(returned.position[2]-18)<.05&&returned.position[1]<.05);assert.equal(returned.economy.atHome,true);
   assert.equal(returned.facilities.visuals.length,10);report.returnToHome=true;console.log(layout,'returned home');
   if(base.includes('w-sunjun-public')){
    const exitButton=page.getByRole('button',{name:/^退出游戏/});if(touch)await exitButton.tap();else await exitButton.click();
    await page.waitForURL(new URL('../../',base).href);await page.getByRole('heading',{name:'游戏列表',exact:true}).waitFor();report.exitToLauncher=true;console.log(layout,'exit to game list');
   }
   await page.close();await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2));
 }assert.deepEqual(report.errors,[]);
 }finally{await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
