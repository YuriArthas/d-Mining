const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const dir=require('node:path').resolve(__dirname,process.env.GUIDE_ROUTE_OUTPUT||(process.env.GUIDE_ROUTE_LAYOUT_ONLY?'../artifacts/guide-route-layout-final':'../artifacts/guide-route-final'));await fs.mkdir(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--disable-http2','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(90000);
 const report={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html',checks:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 const frames=async()=>{const n=(await snap()).renderer.submission.submitted;await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+2,n,{polling:500});};
 const shot=async name=>{await frames();await page.screenshot({path:dir+'/'+name+'.png',timeout:90000});};
 const check=s=>{report.checks.push(s);console.log(s);};
 try{
  await page.goto(report.url+'?debug=1&submission=fenced&saveTest=long-route-'+Date.now(),{waitUntil:'domcontentloaded'});await page.bringToFront();
  await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000,polling:500});
  await page.evaluate(()=>{window.__miningValidation.performance({submission:'fenced',framesInFlight:1});const gl=document.querySelector('canvas').getContext('webgl2');setInterval(()=>gl.flush(),100);});
  await frames();let s=await snap();report.spawn={position:s.position,route:s.guideDirection};
  assert.ok(s.guideDirection.visible);assert.ok(s.guideDirection.length>30);
  assert.equal(s.guideDirection.style,'roblox-image-v1');assert.match(s.guideDirection.texture,/roblox-arrow-v1/);
  assert.ok(await page.evaluate(()=>Array.from(document.images).some(i=>i.src.includes('roblox-arrow-v1')&&i.complete&&i.naturalWidth>0)));
  assert.equal(s.guideDirection.destination[0],s.economy.guideDestination[0]);assert.equal(s.guideDirection.destination[2],s.economy.guideDestination[2]);
  await shot('01-continuous-arrow');check('One continuous arrow spans from the player to the mine entrance');
  if(process.env.GUIDE_ROUTE_LAYOUT_ONLY){
   if(process.env.GUIDE_ARROW_STYLE||process.env.GUIDE_RIBBON_STYLE){
    await page.evaluate(()=>{window.__miningValidation.teleport([4,0,25]);window.__miningValidation.look(.25,.42);});
    await page.waitForFunction(()=>window.__miningValidation.snapshot().ready,null,{polling:500});
    await shot('02-arrow-near');
    await page.getByRole('button',{name:'切换到白天',exact:true}).click();await shot('03-arrow-day');
    await page.evaluate(()=>{window.__miningValidation.teleport([0,0,10]);window.__miningValidation.look(0,.35);});
    await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.guide?.id==='dig',null,{polling:500});
    await frames();assert.equal((await snap()).guideDirection.visible,false);await shot('04-mining-lesson');
    check('API-generated opaque cartoon arrow checked at an oblique angle in both night and day lighting');
   }
   assert.deepEqual(report.errors,[]);return;
  }
  await page.mouse.move(1200,700); // Do not preselect a block to unlock the lesson.
  await page.keyboard.down('w');
  try {await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.guide?.id==='dig',null,{timeout:180000,polling:250});}finally{await page.keyboard.up('w');}
  await frames();s=await snap();report.arrival={position:s.position,lesson:s.guideMining,guide:s.economy.guide};
  assert.equal(s.economy.onboarding.minedOnce,false);assert.equal(s.guideDirection.visible,false);
  await page.waitForFunction(()=>window.__miningValidation.snapshot().guideMining.visible,null,{polling:500});
  assert.equal(await page.locator('.guide-left-mouse').count(),1);
  await shot('02-arrival-mouse-highlight');check('Real WASD approach starts mining lesson without requiring a prior mouse target');
  await page.getByRole('button',{name:'操作帮助',exact:true}).click();await frames();assert.equal((await snap()).guideMining.visible,false);
  await page.keyboard.press('Escape');await frames();assert.equal((await snap()).guideMining.visible,true);check('Modal hides the block highlight and mouse lesson; closing restores them');
  const box=await page.locator('.guide-dig-ring').boundingBox();assert.ok(box);
  const cell=(await snap()).guideMining.cell;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.waitForFunction(cell=>JSON.stringify(window.__miningValidation.snapshot().target)===JSON.stringify(cell),cell,{polling:500});
  await shot('03-pointer-on-highlight');
  await page.mouse.down({button:'left'});
  try{await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.onboarding.minedOnce,null,{timeout:60000,polling:500});}finally{await page.mouse.up({button:'left'});}
  await frames();s=await snap();report.mined={cell,inventory:s.economy.inventory,guide:s.economy.guide};
  assert.equal(await page.evaluate(c=>window.__miningValidation.cell(c),cell),0);
  assert.ok(s.economy.inventory.totalCount>0);assert.equal(s.guideMining.visible,false);assert.equal(await page.locator('.guide-left-mouse').count(),0);
  await shot('04-first-block-mined');check('Actual left mouse hold destroys the highlighted block, collects ore and dismisses the lesson');
  assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=String(e);report.snapshot=await snap().catch(()=>null);await page.screenshot({path:dir+'/failure.png',timeout:30000}).catch(()=>{});throw e;}
 finally{await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
