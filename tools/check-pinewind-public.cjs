const {chromium} = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'), path=require('node:path'), assert=require('node:assert/strict');
const {worldGateZ}=require('../src/game/content/worldJourney.ts');
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir=path.resolve(process.env.ARTIFACT_DIR||'artifacts/pinewind-public');
(async()=>{
 await fs.mkdir(dir,{recursive:true});
 const loadedParts=new Set();
 const report={url,startedAt:new Date().toISOString(),checks:[],errors:[],screens:[],validation:'Public desktop Chromium / SwiftShader; isolated test save'};
 const browser=await chromium.launch({args:['--remote-debugging-port=9337','--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.setDefaultTimeout(60000);
 page.on('response',r=>{if(r.url().split('?')[0].endsWith('.part'))loadedParts.add(r.url().split('/').at(-1).split('?')[0]);});
 page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE',e.message)});
 page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('CONSOLE',m.text().slice(0,1200))}});
 await page.addInitScript(()=>setInterval(()=>document.querySelector('canvas')?.getContext('webgl2')?.flush(),150));
 const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 const ready=async()=>{
  await page.waitForFunction(()=>document.querySelector('.loading-error:not([hidden])')||window.__miningValidation?.snapshot().ready&&!window.__miningValidation.snapshot().travelling&&!document.querySelector('.loading-screen'),null,{timeout:240000,polling:300});
  if(await page.locator('.loading-error:not([hidden])').count())throw Error(await page.locator('.loading-error').innerText());
 };
 const shot=async name=>{
  // Logical frames keep advancing while the optional diagnostic GPU fence is
  // pending. Drain it and wait for actual submissions, not simulation frames.
  if(name!=='failure'){
   const submitted=(await snap()).renderer.submission.submitted;
   await page.waitForFunction(n=>{
    document.querySelector('canvas').getContext('webgl2').finish();
    return window.__miningValidation.snapshot().renderer.submission.submitted>=n+2;
   },submitted,{timeout:120000,polling:300});
  }
  await page.screenshot({path:path.join(dir,name+'.png'),timeout:60000});report.screens.push(name);console.log('SHOT',name)
 };
 const check=text=>{report.checks.push(text);console.log('PASS',text)};
 try {
  await page.goto(url+'?debug=1&submission=fenced&framesInFlight=1&saveTest=pinewind-'+Date.now(),{waitUntil:'domcontentloaded'});await ready();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().grounded,null,{timeout:120000});
  const initial=await snap();report.initial={position:initial.position,facilities:initial.facilities.surfaceShading,lighting:initial.lighting,eggLabels:initial.eggLabels};await shot('01-spawn');
  assert.equal(report.initial.facilities.version,'pinewind-master-v2');
  assert.equal(report.initial.facilities.oldSurfaceAssetsLoaded,0);
  check('New authored surface and preserved game initialize on the public route');
  assert.ok(initial.facilities.surfaceDetails.bakedLight.meshes.map>0&&initial.facilities.surfaceDetails.bakedLight.meshes.vertex>0);
  await page.getByRole('button',{name:'关闭烘焙阴影'}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().facilities.surfaceDetails.shadowEnabled===false);
  await page.getByRole('button',{name:'开启烘焙阴影'}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().facilities.surfaceDetails.shadowEnabled===true);
  check('Mainline baked-shadow toggle controls the new authored contact shadows');
  if(process.env.PINEWIND_SMOKE==='1')return;
  if(process.env.PINEWIND_NIGHT_ONLY==='1'){
   await page.getByRole('button',{name:'跳过引导',exact:true}).click();
   await page.evaluate(()=>window.__miningValidation.advanceDayNight(450));
   await page.waitForFunction(()=>window.__miningValidation.snapshot().dayNight.daylight===0,null,{timeout:120000});
   await shot('10-night-settled');report.night=await snap();
   assert.equal(report.night.dayNight.daylight,0);assert.equal(report.night.facilities.surfaceDetails.daylight,0);
   assert.equal(report.night.facilities.surfaceShading.distanceUnloading,false);
   assert.ok(Math.abs(report.night.position[2]-46)<.5);assert.deepEqual(report.errors,[]);
   check('Night lighting and resident scenery are captured after camera and GPU submission settle');
   return;
  }
  const look=async(yaw,pitch=.22)=>{const frame=await page.evaluate(({yaw,pitch})=>{window.__miningValidation.look(yaw,pitch);return window.__miningValidation.snapshot().frames;},{yaw,pitch});await page.waitForFunction(n=>window.__miningValidation.snapshot().frames>n,frame,{timeout:120000});};
  const travel=async position=>{await page.evaluate(p=>window.__miningValidation.teleport(p),position);await ready();await page.waitForFunction(()=>window.__miningValidation.snapshot().grounded,null,{timeout:120000});};
  const walk=async(predicate,arg,key='w')=>{await page.locator('.game-shell').focus();await page.keyboard.down(key);try{await page.waitForFunction(({code,arg,key})=>{const done=(0,eval)('('+code+')')(arg);if(done)window.dispatchEvent(new KeyboardEvent('keyup',{code:'Key'+key.toUpperCase(),key,bubbles:true}));return done;},{code:predicate.toString(),arg,key},{timeout:180000,polling:'raf'});}finally{await page.keyboard.up(key);}console.log('WALK',JSON.stringify((await snap()).position));};
  await page.getByRole('button',{name:'跳过引导',exact:true}).click();
  await look(0,.22);
  await walk(()=>window.__miningValidation.snapshot().position[2]<36.5);
  report.bridge=(await snap()).position;assert.ok(report.bridge[1]>.3);await shot('02-on-bridge');
  await walk(()=>window.__miningValidation.snapshot().position[2]<12);
  check('Real W movement crosses the bridge from spawn to the plaza, including raised bridge support');
  await look(0,.65);await shot('03-real-mine');
  await walk(()=>window.__miningValidation.snapshot().position[2]<5);
  const cell=await page.evaluate(()=>{for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)if(window.__miningValidation.canMine([x,-1,z]))return [x,-1,z];});
  assert.ok(cell);const before=await snap();
  for(let i=0;i<30&&await page.evaluate(c=>window.__miningValidation.cell(c)!==0,cell);i++){
   await page.evaluate(c=>window.__miningValidation.hit(c),cell);await page.waitForTimeout(700);
  }
  await page.waitForFunction(c=>window.__miningValidation.cell(c)===0,cell,{timeout:120000});
  const after=await snap();assert.ok(after.economy.minedVolume>before.economy.minedVolume);assert.ok(after.economy.inventory.totalCount>before.economy.inventory.totalCount);
  report.mining={cell,before:before.economy.minedVolume,after:after.economy.minedVolume};
  check('Actual square mine is walkable; a real hit breaks a voxel and settles inventory/mined volume');
  await page.getByRole('button',{name:'返回地表',exact:true}).click();await ready();
  assert.ok((await snap()).position[2]>40);
  await travel([-17,.1,22]);await look(0,.2);
  await walk(()=>window.__miningValidation.snapshot().economy.inventory.totalCount===0);
  const sold=await snap();assert.ok(sold.economy.coins>after.economy.coins);await shot('04-sale');
  check('Return button and walking into relocated SELL automatically sell the mined item');
  await travel([-20,.1,-2.5]);await look(0,.15);await walk(()=>window.__miningValidation.snapshot().position[2]<-6);
  await page.keyboard.press('e');await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(),/升级/);await shot('05-shop');await page.getByRole('button',{name:'关闭升级界面'}).click();
  check('Relocated SHOP can be approached on foot and opened with E');
  await travel([23,.1,20]);await look(-Math.PI/2,.18);await shot('06-eggs-from-aisle');
  assert.equal(await page.locator('.egg-world-prompt').count(),0);
  assert.equal((await snap()).eggLabels.labelCount,16);
  await travel([23,.1,15.5]);await look(-Math.PI/2,.2);
  await walk(()=>window.__miningValidation.snapshot().position[0]>26);
  assert.ok((await snap()).position[1]>.15);
  await look(Math.PI,.2);await walk(()=>window.__miningValidation.snapshot().position[2]>19.5);
  await page.locator('.egg-world-prompt').waitFor();await page.keyboard.press('e');await page.getByRole('dialog').waitFor();
  assert.ok(await page.locator('.egg-probability').count()>1);await shot('07-egg-probabilities');
  await page.getByRole('dialog').getByRole('button',{name:/关闭/}).click();
  check('Sixteen egg labels persist away from interaction; first terrace stairs walk correctly; nearby E opens visible probabilities');
  await travel([23,.1,44.5]);await look(-Math.PI/2,.2);
  await walk(()=>window.__miningValidation.snapshot().position[0]>42.6);
  report.topTerrace=(await snap()).position;assert.ok(report.topTerrace[1]>3.95);await look(1.0,.3);await shot('08-pet-terraces');
  check('Real walking climbs all three terrace levels to the top egg row');
  await travel([-23,.1,48]);await look(Math.PI/2,.2);await walk(()=>window.__miningValidation.snapshot().position[0]<-26.4);
  const portal=await snap();assert.ok(portal.economy.destinations.every(p=>!p.unlocked));assert.match(portal.economy.notice,/400/);await shot('09-portal');
  check('Portal entrance remains approachable and enforces the original depth lock');
  const room=portal.content.rooms.find(r=>r.id==='old_mine');await travel(room.spawn);
  await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.destinations.find(p=>p.id==='old_mine').unlocked);
  await travel([-23,.1,48]);await look(Math.PI/2,.2);await walk(()=>window.__miningValidation.snapshot().position[1]<-100);
  await ready();assert.ok((await snap()).position[1]<-390);await shot('09b-unlocked-portal');
  check('Visiting the actual old mine unlocks its station; entering that station automatically travels to the right underground room');

  const secondWorldGate=worldGateZ(2);
  await travel([0,.1,secondWorldGate-8]);await look(Math.PI,.2);
  await walk(z=>window.__miningValidation.snapshot().position[2]>z-2.5,secondWorldGate);
  const gateStep=(await snap()).physicsSteps;await walk(n=>window.__miningValidation.snapshot().physicsSteps>n+30,gateStep);
  const gate=await snap();assert.ok(gate.position[2]<secondWorldGate);assert.equal(gate.economy.worlds[1].areaOpen,false);await shot('09c-world-gate');
  check('The rear route remains walkable and the second-world gate still blocks below its mining threshold');
  await travel([0,.1,46]);await look(0,.22);
  await page.evaluate(()=>window.__miningValidation.advanceDayNight(450));
  await page.waitForFunction(()=>window.__miningValidation.snapshot().dayNight.daylight===0,null,{timeout:120000});await shot('10-night');
  assert.equal((await snap()).facilities.surfaceShading.distanceUnloading,false);
  check('Existing automatic day/night cycle works with the new resident surface');
  await page.evaluate(()=>window.__miningSave.flush());await page.reload({waitUntil:'domcontentloaded'});await ready();
  const saved=await snap();assert.equal(saved.economy.minedVolume,sold.economy.minedVolume);assert.equal(saved.economy.coins,sold.economy.coins);
  check('Mined volume and sale currency survive reload in an isolated IndexedDB save');
  const launcher=await page.request.get('https://w-sunjun-public.dev.clock-p.com/');assert.ok(launcher.ok());
  const main=(await launcher.text()).match(/src="([^"]+\.js)"/)[1];const js=await(await page.request.get(new URL(main,'https://w-sunjun-public.dev.clock-p.com/').href)).text();
  for(const route of ['mining','mining-test','mining-surface','mining-surface-play'])assert.ok(js.includes('/games/'+route+'/index.html'));
  check('Public launcher retains Mining, mining-test and reference and lists the new playable route');
  report.loadedParts=[...loadedParts];assert.ok(report.loadedParts.length>=2);assert.ok(report.loadedParts.every(n=>n.startsWith('pinewind-')));
  check('Only the two new compressed surface assets were requested; retired surface models were not loaded');
  assert.deepEqual(report.errors,[]);

 }catch(error){report.failure=String(error);report.snapshot=await snap().catch(()=>null);await shot('failure').catch(()=>{});throw error;}
 finally{await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
