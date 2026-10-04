const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const {digCells}=require('./combat-browser.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report=process.env.TRAVEL_ONLY?JSON.parse(await fs.readFile('artifacts/meadow-interactions.json','utf8')):{errors:[],checks:[],samples:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(150000);
  if(process.env.SOFTWARE_FRAME_MS)await page.addInitScript(ms=>{const frame=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>frame(()=>setTimeout(()=>cb(performance.now()),ms));},Number(process.env.SOFTWARE_FRAME_MS));
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){console.log(m.text());report.errors.push(m.text())}});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const save=()=>fs.writeFile('artifacts/meadow-interactions.json',JSON.stringify(report,null,2));
  const check=async message=>{report.checks.push(message);console.log(message);await save()};
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
  const teleport=async position=>{await page.evaluate(p=>window.__miningValidation.teleport(p),position);await ready();console.log('teleport',JSON.stringify(position))};
  const shot=async name=>{if(!process.env.SHOTS||process.env.SHOTS.split(',').includes(name))await page.screenshot({path:`artifacts/meadow-desktop-${name}.png`,timeout:150000});report.samples.push({name,snapshot:await snap()});await save();console.log(name)};
  const look=async(yaw,pitch=.35)=>{
   console.log('look',yaw,pitch);const s=await snap();await page.mouse.move(600,360);await page.mouse.down({button:'right'});await page.mouse.move(600+(s.view.yaw-yaw)/.004,360+(pitch-s.view.pitch)/.004,{steps:4});await page.mouse.up({button:'right'});
   await page.waitForFunction(([y,p])=>{const v=window.__miningValidation.snapshot().view;return Math.abs(v.yaw-y)<.03&&Math.abs(v.pitch-p)<.03},[yaw,pitch]);
  };
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const start=await snap();assert.ok(start.position[1]<.05);assert.equal(start.camera.obstructed,false);assert.equal(start.lighting.surfaceFog,false);assert.equal(start.lighting.cameraFar,10000);
  const scenery=[...start.facilities.visuals];assert.equal(scenery.length,10);
  assert.equal(await page.evaluate(()=>{let n=0;for(let x=-10;x<10;x++)for(let z=-10;z<10;z++)if(window.__miningValidation.canMine([x,-1,z]))n++;return n}),64);
  await check('Flat spawn, clear camera, exact 64-cell entrance, all 10 scenery sites resident, far 10000, no surface fog');await shot('arrival');
  if(!process.env.TRAVEL_ONLY){
  await teleport([0,.1,18]);await look(0);await page.locator('.scene').focus();await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__miningValidation.snapshot().position[2]<10);await page.keyboard.up('w');await ready();assert.ok((await snap()).position[1]<.05);await check('Actual walking through the former platform and ramp stays on flat ground');
  await teleport([0,.1,9.5]);await digCells(page,[[-1,-1,3],[0,-1,3]]);await ready();assert.ok((await snap()).economy.inventory.used>0);await shot('open-pit');
  await teleport([15,.1,11]);await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.inventory.used===0);assert.ok((await snap()).economy.coins>0);await check('Two blocks mined through combat and sold automatically at the relocated sale circle');
  await teleport([9,.1,16]);await look(-.5,.20);await shot('sale');
  }
  await teleport([0,.1,90]);assert.deepEqual((await snap()).facilities.visuals,scenery);await look(0,.06);await shot('distant');await check('Ordinary scenery remains resident beyond former distance boundary');
  await teleport('deep');const below=await snap();assert.deepEqual(below.facilities.visuals,scenery);assert.notEqual(below.facilities.colliders,start.facilities.colliders);await teleport('surface');assert.deepEqual((await snap()).facilities.visuals,scenery);await check('Underground round trip preserves scenery while physics residency changes independently');
  await teleport([0,.1,10]);await look(-2.65,.2);await shot('reverse');
  assert.deepEqual(report.errors,[]);await check('No page or shader errors');
 }finally{await browser.close();await fs.writeFile('artifacts/meadow-interactions.json',JSON.stringify(report,null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
