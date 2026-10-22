// Public desktop navigation checks; isolated save and debug movement only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../../d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), assert = require('node:assert/strict');
(async () => {
 const dir = require('node:path').resolve(__dirname, process.env.GUIDE_CHECK_DESTINATIONS ? '../artifacts/guide-destinations-final' : '../artifacts/guide-arrows-final');
 await fs.mkdir(dir, {recursive:true});
 const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page = await browser.newPage({viewport:{width:1280,height:800}});
 page.setDefaultTimeout(90000);
 const report = {url:'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html',checks:[],errors:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 const snap = () => page.evaluate(()=>window.__miningValidation.snapshot());
 const rendered = async () => { const n=(await snap()).renderer.submission.submitted;await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+3,n,{polling:500}); };
 const shot = name => page.screenshot({path:dir+'/'+name+'.png',timeout:90000});
 const check = name => {report.checks.push(name);console.log(name);};
 try {
  await page.goto(report.url+'?debug=1&submission=fenced&saveTest=arrows-'+Date.now(),{waitUntil:'domcontentloaded'});
  await page.bringToFront();
  await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000,polling:500});
  await page.evaluate(()=>{window.__miningValidation.performance({submission:'fenced',framesInFlight:1});const gl=document.querySelector('canvas').getContext('webgl2');setInterval(()=>gl.flush(),100);});
  await rendered();
  if (!process.env.GUIDE_CHECK_DESTINATIONS) {
  let s=await snap();assert.ok(s.guideDirection.visible);report.initial=s.guideDirection;
  await shot('01-mine-direction');check('Fresh save shows the player direction arrow and destination marker');
  const view=s.view;
  await page.evaluate(v=>window.__miningValidation.look(v.yaw+Math.PI,v.pitch),view);await rendered();
  assert.equal(await page.locator('.guide-marker').getAttribute('data-offscreen'),'true');
  assert.equal((await snap()).guideDirection.yaw,s.guideDirection.yaw);
  await shot('02-target-behind');check('Camera rotation preserves world heading and shows offscreen marker');
  await page.evaluate(v=>window.__miningValidation.look(v.yaw,v.pitch),view);await rendered();
  await page.keyboard.down('d');await page.waitForTimeout(1400);await page.keyboard.up('d');await rendered();
  const moved=await snap();assert.ok(Math.abs(moved.position[0]-s.position[0])>.5);
  const target=moved.economy.guideDestination,pos=moved.renderedPosition;
  assert.ok(Math.abs(moved.guideDirection.yaw-Math.atan2(target[0]-pos[0],target[2]-pos[2]))<.001);
  await shot('03-moved');check('Actual keyboard movement updates arrow position and target heading');
  await page.getByRole('button',{name:'操作帮助',exact:true}).click();await rendered();assert.equal((await snap()).guideDirection.visible,false);
  await page.keyboard.press('Escape');await rendered();assert.equal((await snap()).guideDirection.visible,true);check('Opening a panel hides arrows; closing restores them');
  await page.setViewportSize({width:1120,height:700});await rendered();await shot('04-desktop-1120');
  await page.evaluate(p=>window.__miningValidation.teleport([p[0],0,p[2]]),target);await rendered();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().ready&&!window.__miningValidation.snapshot().guideDirection.visible,null,{polling:500});
  await rendered();await shot('05-arrived');check('Reaching the mine entrance hides the movement arrow');
  await page.getByRole('button',{name:'跳过引导',exact:true}).click();await rendered();assert.equal((await snap()).guideDirection.visible,false);assert.equal(await page.locator('.guide-marker').count(),0);check('Skipping hides navigation');
  } else {
   await shot('01-mine-1280');await page.setViewportSize({width:1120,height:700});await rendered();await shot('02-mine-1120');
   check('Final marker layout captured at both desktop sizes');
   await page.setViewportSize({width:1280,height:800});
   const name='guide-destinations-'+Date.now();
   await page.evaluate(async name=>{
    const p=structuredClone(window.__miningSave.progress());
    p.onboarding={version:1,status:'active',minedOnce:true,soldOnce:true,equippedOnce:false};
    p.wallet.coins=80;p.pickaxe.level=2;p.inventory.items={'ore.soil':50};
    const store=await window.__miningSave.openTestStore(name);
    await store.commit({expectedRevision:null,head:{formatVersion:1,revision:1,savedAt:Date.now(),regionCount:0,world:{generationVersion:9,seed:0,regionEncoding:1}},progress:p,regions:[]});store.close();
   },name);
   await page.goto(report.url+'?debug=1&submission=fenced&saveTest=store-'+name,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000,polling:500});
   await page.evaluate(()=>{window.__miningValidation.performance({submission:'fenced',framesInFlight:1});const gl=document.querySelector('canvas').getContext('webgl2');setInterval(()=>gl.flush(),100);});
   await rendered();let s=await snap();
   assert.equal(s.economy.guide.id,'sell');assert.ok(s.guideDirection.visible);await shot('03-surface-sale');
   const travel=async p=>{await page.evaluate(p=>window.__miningValidation.teleport(p),p);await page.waitForFunction(()=>window.__miningValidation.snapshot().ready,null,{polling:500});await rendered();};
   await travel([0,-20,0]);s=await snap();assert.equal(s.economy.guide.id,'return');assert.equal(s.guideDirection.visible,false);assert.equal(s.economy.guideAnchor,null);
   await travel(s.content.rooms[0].spawn);s=await snap();assert.equal(s.economy.guide.id,'sell');assert.ok(s.economy.guideAnchor[1]<-20);assert.ok(s.guideDirection.visible);await shot('04-room-sale');
   const sale=s.economy.guideAnchor;await travel([sale[0],sale[1]-1,sale[2]]);
   await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.inventory.totalCount===0,null,{polling:500});
   await rendered();assert.equal((await snap()).guideDirection.visible,false);check('Surface sale has an arrow; mine uses return; room points to its own sale and clears after selling');
   await travel('surface');s=await snap();assert.equal(s.economy.guide.id,'egg');assert.ok(s.guideDirection.visible);await shot('05-egg-direction');
   await travel(s.economy.guideDestination);
   await page.waitForFunction(()=>document.querySelector('.egg-world-prompt')?.style.visibility==='visible',null,{polling:500});await rendered();
   assert.equal((await snap()).guideDirection.visible,false);await shot('06-egg-arrived');
   check('Egg direction leads to its interaction zone and yields to the E prompt');
  }
  assert.deepEqual(report.errors,[]);
 } catch(e) {report.failure=String(e);report.snapshot=await snap().catch(()=>null);await shot('failure').catch(()=>{});throw e;}
 finally {await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
