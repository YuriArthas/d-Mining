const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1';
(async()=>{
 const out='artifacts/loading-page';await fs.mkdir(out,{recursive:true});const report={errors:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>report.errors.push(e.message));
  let release;const held=new Promise(resolve=>release=resolve);
  await page.route('**/*.part',async route=>{await held;await route.continue();});
  // Record visible phase transitions without slowing the game loop.
  await page.addInitScript(()=>{window.__loadingPhases=[];window.__loadingProgress=[];new MutationObserver(()=>{const bar=document.querySelector('.loading-track');if(bar){const value=Number(bar.getAttribute('aria-valuenow'));if(window.__loadingProgress.at(-1)!==value)window.__loadingProgress.push(value);}const phase=document.querySelector('.loading-screen')?.dataset.phase;if(phase&&window.__loadingPhases.at(-1)!==phase)window.__loadingPhases.push(phase);}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-phase','aria-valuenow']});});
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.loading-screen').waitFor();
  assert.equal(await page.locator('.game-header').isVisible(),false);assert.equal(await page.locator('.inventory-hud').count(),0);
  assert.equal(await page.locator('.scene').getAttribute('inert'),'');
  await page.keyboard.press('w');assert.equal((await page.evaluate(()=>window.__mining.getInput())).moveY,0);
  await page.screenshot({path:`${out}/loading.png`});release();
  await page.waitForFunction(()=>!document.querySelector('.loading-screen')&&!!window.__miningValidation?.snapshot().startup.firstPlayableMs);
  report.ready=await page.evaluate(()=>{const s=window.__miningValidation.snapshot();return {firstPlayableMs:s.startup.firstPlayableMs,submitted:s.renderer.submission.submitted,grounded:s.grounded,ready:s.ready,phases:window.__loadingPhases,progress:window.__loadingProgress};});
  assert.ok(report.ready.submitted>0);assert.ok(report.ready.ready&&report.ready.grounded);assert.ok(report.ready.phases.includes('shaders'));assert.ok(!report.ready.phases.includes('error'));
  assert.equal(report.ready.progress[0],0);assert.equal(report.ready.progress.at(-1),100);assert.ok(report.ready.progress.every((v,i,a)=>i===0||v>=a[i-1]));
  assert.ok(await page.locator('.inventory-hud').isVisible());assert.ok(await page.locator('.game-header').isVisible());
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='day');assert.equal(await page.locator('.loading-screen').count(),0);
  assert.deepEqual(report.errors,[]);await page.close();
  if(process.env.NORMAL_ONLY){report.passed=true;console.log('public total progress 0 to 100, monotonic stages and first-frame handoff passed');return;}
  // A real failed HTTP resource must produce a usable retry page.
  const failed=await browser.newPage({viewport:{width:1280,height:720}});failed.setDefaultTimeout(90000);
  await failed.route('**/*.part',route=>route.fulfill({status:503,body:'test failure'}));
  await failed.goto(url,{waitUntil:'domcontentloaded'});await failed.locator('.loading-screen[data-phase="error"]').waitFor();
  report.failure=await failed.locator('.loading-error').innerText();assert.match(report.failure,/503/);
  assert.ok(await failed.getByRole('button',{name:'重新加载',exact:true}).isVisible());
  await failed.unroute('**/*.part');await failed.getByRole('button',{name:'重新加载',exact:true}).click();
  await failed.waitForFunction(()=>!document.querySelector('.loading-screen')&&!!window.__miningValidation?.snapshot().startup.firstPlayableMs);
  report.retryPassed=true;await failed.close();
  // Exit must remain available before model requests finish.
  const leaving=await browser.newPage();leaving.setDefaultTimeout(90000);
  let unblockExit;const blockExit=new Promise(resolve=>unblockExit=resolve);
  await leaving.route('**/*.part',async route=>{await blockExit;await route.abort().catch(()=>{});});
  await leaving.goto(url,{waitUntil:'domcontentloaded'});await leaving.locator('.loading-screen').waitFor();
  await leaving.locator('.loading-screen').getByRole('button',{name:'退出游戏',exact:false}).click();unblockExit();await leaving.waitForURL('https://w-sunjun-public.dev.clock-p.com/');report.exitPassed=true;await leaving.close();
  // Main module download is held: the initial HTML must already show a loader.
  const boot=await browser.newPage();let start;const gate=new Promise(resolve=>start=resolve);
  await boot.route('**/assets/index-*.js',async route=>{await gate;await route.abort();});
  await boot.goto(url,{waitUntil:'commit'});await boot.locator('.boot-loading').waitFor();assert.match(await boot.locator('#boot-status').innerText(),/正在载入/);start();
  await boot.waitForFunction(()=>document.querySelector('#boot-status')?.textContent.includes('下载失败'));report.bootstrapPassed=true;await boot.close();
  report.passed=true;console.log('public loading screen, first-frame handoff, error/retry, exit, and HTML bootstrap passed');
 }finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
