const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out=process.env.OUT_DIR||'artifacts/runtime-refactor/runtime';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('.loading-screen')&&window.__miningValidation?.snapshot().ready,undefined,{polling:100});
  const snapshot=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  report.surface=await snapshot();assert.equal(report.surface.startup.sky.time,'night');assert.equal(report.surface.facilities.visuals.length,10);
  if(process.env.STARTUP_ONLY){
   assert.equal(report.surface.content.layers.find(l=>l.id==='old_mine').depth,400);
   assert.equal(report.surface.content.layers.find(l=>l.id==='old_mine').theme,'timber_mine');
   assert.equal(report.surface.facilities.surfaceDetails.grassInstances,780);
   assert.equal(report.surface.lighting.keyLight.intensity,2.25);
   assert.ok(Math.abs(report.surface.sellZone.x+12)<1e-9);
   assert.equal(report.surface.facilities.surfaceShading.instances,1113);
   assert.equal(report.surface.facilities.surfaceShading.bytes,8153642);
   assert.deepEqual(report.errors,[]);report.passed=true;
   console.log('final public startup and restored content/resources passed');return;
  }
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='day',undefined,{polling:100});
  report.day=await snapshot();assert.equal(report.day.lighting.surfaceArea.activeLights,0);
  await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='night',undefined,{polling:100});
  // Same public debug command used by the UI's travel adapter; waits for collision-ready destination.
  await page.evaluate(()=>window.__miningValidation.teleport('deep'));
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.position[1]<-3500;},undefined,{polling:100});
  report.deep=await snapshot();assert.equal(report.deep.lighting.surfaceArea.active,false);assert.equal(report.deep.lighting.surfaceFog,true);
  assert.equal(report.deep.facilities.visuals.length,10);assert.equal(report.deep.economy.destinations.every(d=>d.unlocked),true);
  await page.evaluate(()=>window.__miningValidation.teleport('surface'));
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.position[1]>-1;},undefined,{polling:100});
  report.returned=await snapshot();assert.equal(report.returned.lighting.surfaceArea.active,true);assert.equal(report.returned.lighting.surfaceFog,false);
  // Exercise the real destruction -> collection -> sale path (no inventory injection).
  report.harvest=await page.evaluate(async()=>{
   const game=window.__miningValidation,before=game.snapshot().economy.inventory.totalCount;
   let cell=null;
   for(let y=-2;y>=-8&&!cell;y--)for(let x=-3;x<=3&&!cell;x++)for(let z=-3;z<=3&&!cell;z++)if(game.cell([x,y,z])===1)cell=[x,y,z];
   if(!cell)throw Error('No soil target in surface test region');
   let result;
   for(let i=0;i<12;i++){result=game.hit(cell);if(result.status==='breaking')break;await new Promise(r=>setTimeout(r,400));}
   return {cell,before,result};
  });
  assert.equal(report.harvest.result.status,'breaking');
  await page.waitForFunction(before=>window.__miningValidation.snapshot().economy.inventory.totalCount>before,report.harvest.before,{polling:100});
  const preSale=await snapshot();
  await page.evaluate(()=>{const g=window.__miningValidation,s=g.snapshot().sellZone;g.teleport([s.x,s.y+.1,s.z]);});
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.economy.inSellZone&&s.economy.inventory.totalCount===0;},undefined,{polling:100});
  report.sale=await snapshot();assert.ok(report.sale.economy.coins>preSale.economy.coins);
  assert.deepEqual(report.errors,[]);report.passed=true;
  console.log('public startup, day/night, deep travel, unlocks, resident scenery and return passed');
 }finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
