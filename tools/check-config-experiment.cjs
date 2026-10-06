const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/runtime-refactor/config-experiment';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const report={errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('.loading-screen')&&window.__miningValidation?.snapshot().ready,undefined,{polling:100});
  report.initial=await page.evaluate(()=>window.__miningValidation.snapshot());
  assert.equal(report.initial.sellZone.x,-8.3);assert.equal(report.initial.sellZone.z,56);
  const placement=report.initial.content.servicePlacements.find(p=>p.x===-15);
  assert.equal(placement.asset,'simulator-upgrade');assert.equal(placement.yaw,Math.PI/2);
  assert.equal(report.initial.lighting.keyLight.intensity,2.45);
  assert.equal(report.initial.facilities.surfaceDetails.grassInstances,600);
  const room=report.initial.content.rooms.find(r=>r.id==='old_mine');assert.equal(room.spawn[1],-439.9);
  assert.equal(report.initial.content.layers.find(l=>l.id==='old_mine').theme,'frozen_cave');
  // New service zone really triggers after physics lands, even with the shop model as appearance.
  await page.evaluate(()=>{const g=window.__miningValidation,s=g.snapshot().sellZone;g.teleport([s.x,.1,s.z]);g.look(Math.PI/2,.22);});
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.economy.inSellZone;},undefined,{polling:100});
  report.facility=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(report.facility.economy.shopId,null);
  await page.screenshot({path:out+'/moved-facility.png'});
  await page.evaluate(spawn=>window.__miningValidation.teleport(spawn),room.spawn);
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.position[1]<-439&&s.position[1]>-441;},undefined,{polling:100});
  report.room=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(report.room.economy.destinations[0].depth,440);assert.equal(report.room.economy.destinations[0].unlocked,true);
  assert.equal(report.room.lighting.keyLight.position[1],42-440);assert.equal(report.room.lighting.surfaceArea.active,false);
  await page.screenshot({path:out+'/changed-layer.png'});
  assert.deepEqual(report.errors,[]);report.passed=true;
  console.log('public configuration-only facility, lighting, grass, depth/theme, collision landing and unlock checks passed');
 }finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
