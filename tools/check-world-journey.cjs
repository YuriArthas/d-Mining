// Public desktop gameplay checks with isolated constructed progress, never a player save.
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {WORLD_REQUIREMENTS,worldRequirement,worldSpawn,worldGateZ}=require('../src/game/content/worldJourney.ts');
const {JOURNEY_WORLDS}=require('../src/game/content/journeyCamp.ts');
const base='https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html';
const review=process.env.JOURNEY_REVIEW==='1';
const gatesOnly=process.env.JOURNEY_GATES==='1';
const dir=path.resolve(__dirname,gatesOnly?'../artifacts/world-journey-gates':review?'../artifacts/world-journey-review':'../artifacts/world-journey-spawn-gate');
const reportName=gatesOnly&&process.env.JOURNEY_GATE_WORLD?`report-world${Number(process.env.JOURNEY_GATE_WORLD)}.json`:'report.json';
(async()=>{
 await fs.mkdir(dir,{recursive:true});
 const viewport=process.env.JOURNEY_VIEWPORT?JSON.parse(process.env.JOURNEY_VIEWPORT):{width:1280,height:800};
 const report={url:base,startedAt:new Date().toISOString(),validation:'Desktop Chromium / SwiftShader, constructed save fixtures and real game actions',viewport,checks:[],errors:[]};
 const browser=await chromium.launch({headless:!process.env.DISPLAY,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader',...process.env.JOURNEY_CDP_PORT?[`--remote-debugging-port=${Number(process.env.JOURNEY_CDP_PORT)}`]:[]]});
 const context=await browser.newContext({viewport}),page=await context.newPage();
 page.setDefaultTimeout(30000);
 page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE ERROR',e.message)});
 page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('CONSOLE ERROR',m.text().slice(0,500));}});
 await page.addInitScript(()=>setInterval(()=>document.querySelector('canvas')?.getContext('webgl2')?.flush(),100));
 const id='worlds-'+Date.now();
 const snapshot=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 const ready=async()=>{
   await page.waitForFunction(()=>document.querySelector('.loading-error:not([hidden])')||window.__miningValidation?.snapshot().ready&&!window.__miningValidation.snapshot().travelling&&window.__miningValidation.snapshot().grounded&&!document.querySelector('.loading-screen'),null,{timeout:180000,polling:500});
   if(await page.locator('.loading-error:not([hidden])').count())throw Error(await page.locator('.loading-error').innerText());
 };
 const go=async(name)=>{
   console.log('OPEN',name);await page.goto(`${base}?debug=1&submission=fenced&framesInFlight=1&saveTest=${name}`,{waitUntil:'domcontentloaded'});await page.bringToFront();
    
   await ready();await page.locator('.game-shell').focus();console.log('READY',name);
 };
 const travel=async(position)=>{console.log('TRAVEL',position);await page.evaluate(p=>window.__miningValidation.teleport(p),position);await ready();console.log('ARRIVED',(await snapshot()).position);};
 const shot=async(name)=>{await page.screenshot({path:path.join(dir,name+'.png'),timeout:60000});};
 const look=async(yaw,pitch)=>{const frames=await page.evaluate(({yaw,pitch})=>{window.__miningValidation.look(yaw,pitch);return window.__miningValidation.snapshot().frames;},{yaw,pitch});await page.waitForFunction(n=>window.__miningValidation.snapshot().frames>n,frames,{timeout:120000,polling:300});};
 const check=(text)=>{report.checks.push(text);console.log('PASS',text)};
 const seed=async(name,world,volume,surplus=0)=>{
   const progress=await page.evaluate(()=>structuredClone(window.__miningSave.progress()));
   progress.worldProgress={version:1,minedVolume:volume,openMines:world===3?[1,2]:[1]};
   progress.worldExploration=Object.fromEntries([1,2,3].map(id=>[id,{version:1,maxDepth:0,unlockedDestinationIds:[]}]));
   progress.exploration=progress.worldExploration[1];progress.reservations={version:1,manual:[],goals:[],excluded:[]};
   progress.onboarding.status='skipped';progress.pickaxe.level=30;progress.inventory={version:1,capacity:world===3?1e9:1e6,items:{}};
   progress.wallet.coins=worldRequirement(world).coins+777;
   for(const m of worldRequirement(world).materials)progress.inventory.items[m.itemId]=m.count;
   progress.inventory.items[worldRequirement(world).materials.at(-1).itemId]+=surplus;
   progress.pets.inventory.pets=[{id:'fixture-pet',speciesId:'core-guardian',level:1}];progress.pets.equipment.slots=['fixture-pet',null,null];
   await page.evaluate(async({name,progress,world})=>{
     const store=await window.__miningSave.openTestStore(name);
     // This is the exact old v11 storage coordinate, before the scene moved +Z.
     const regions=[{region:[0,-1,-7*(world-1)],removed:new Uint16Array([96,96])}];
     await store.commit({expectedRevision:null,head:{formatVersion:1,revision:1,savedAt:Date.now(),regionCount:1,world:{generationVersion:11,seed:0,regionEncoding:1}},progress,regions});store.close();
   },{name,progress,world});
 };
 const mineBase=async(world)=>{
   const kind=64+(world-1)*28,offset=worldRequirement(world).z/2;
   const cell=await page.evaluate(({kind,offset})=>{
     for(let y=-5;y>-14;y--)for(let x=-3;x<4;x++)for(let z=-3;z<4;z++)if(window.__miningValidation.cell([x,y,z+offset])===kind)return [x,y,z+offset];
   },{kind,offset});assert.ok(cell);
   const before=(await snapshot()).economy.minedVolume;
   assert.equal((await page.evaluate(c=>window.__miningValidation.hit(c),cell)).status,'breaking');
   await page.waitForFunction(c=>window.__miningValidation.cell(c)===0,cell,{polling:300});
   return {cell,before,after:(await snapshot()).economy.minedVolume};
 };
 const walkUntil=async(predicate,arg)=>{await page.locator('.game-shell').focus();await page.keyboard.down('w');try{await page.waitForFunction(predicate,arg,{timeout:180000,polling:300});}finally{await page.keyboard.up('w');}};
 const approachClosedGate=async(world,photo)=>{
   const z=worldGateZ(world);await travel(worldSpawn(world-1));
   await look(Math.PI+.15,-.08);await shot(photo);await look(Math.PI,.05);
   await walkUntil(z=>window.__miningValidation.snapshot().position[2]>z-1.3,z);
   const steps=(await snapshot()).physicsSteps;await walkUntil(n=>window.__miningValidation.snapshot().physicsSteps-n>=30,steps);
   const s=await snapshot();assert.ok(s.position[2]<z&&s.position[2]>z-2);assert.equal(s.economy.currentWorld,world-1);assert.ok(s.position[1]>=0);
   report.checks.push(`World ${world}: turn around at spawn and walk directly to the closed gate without crossing the mine; physical doors block at ${s.position[2]}`);
 };
 try {
   if(gatesOnly){
     await go(id);
     if(!process.env.JOURNEY_GATE_WORLD){await shot('01-spawn-view');await look(Math.PI+.15,-.08);await shot('02-gate-behind-spawn');}
     for(const world of process.env.JOURNEY_GATE_WORLD?[Number(process.env.JOURNEY_GATE_WORLD)]:[2,3]){
       const name=id+'-gate'+world,z=worldGateZ(world);await seed(name,world,worldRequirement(world).mined-1);await go('store-'+name);
       await approachClosedGate(world,`03-world${world}-closed`);
       await travel([0,.1,13]);await mineBase(1);assert.equal((await snapshot()).economy.worlds[world-1].areaOpen,true);
       await travel(worldSpawn(world-1));await look(Math.PI+.15,-.08);await shot(`04-world${world}-open`);await look(Math.PI,.05);
       await walkUntil(id=>window.__miningValidation.snapshot().economy.currentWorld===id,world);
       assert.ok((await snapshot()).position[2]>z);assert.equal((await snapshot()).economy.worlds[world-1].mineOpen,false);
       await walkUntil(z=>window.__miningValidation.snapshot().position[2]>z+38,z);
       check(`World ${world}: visible solid double doors block before the exact threshold, open after actual mining, and walking through immediately enters the next surface world while its mine stays locked`);
     }
   }else if(review){
     await go(id);await travel([0,.1,worldGateZ(2)-8]);await look(Math.PI,.1);await shot('01-door-requirement');
     const name=id+'-reservation';await seed(name,3,100_000_000,10);await go('store-'+name);
     await page.getByRole('button',{name:'矿物背包',exact:true}).click();await page.getByLabel('能源晶石保留方式',{exact:true}).selectOption('needed');
     assert.equal((await snapshot()).economy.mineralReservations['journey.energy'].reserved,30);
     assert.equal((await snapshot()).economy.mineralReservations['journey.titanium'].reserved,0);
     await page.getByRole('button',{name:'关闭矿物背包'}).click();await travel([-16,.1,worldRequirement(2).z+44]);
     assert.equal((await snapshot()).economy.inventory.totalCount,30);assert.equal((await snapshot()).economy.inventory.items['journey.energy'],30);
     await page.getByRole('button',{name:'矿物背包',exact:true}).click();await shot('02-reserved-in-sell-zone');
     await page.getByLabel('能源晶石保留方式',{exact:true}).selectOption('none');
     const steps=(await snapshot()).physicsSteps;await page.waitForFunction(n=>window.__miningValidation.snapshot().physicsSteps>n+12,steps,{timeout:60000,polling:300});
     assert.equal((await snapshot()).economy.inventory.totalCount,30);
     await page.getByRole('button',{name:'出售可售矿产',exact:true}).click();assert.equal((await snapshot()).economy.inventory.totalCount,0);
     assert.equal((await snapshot()).economy.minedVolume,100_000_000);
     await page.getByRole('button',{name:'关闭矿物背包'}).click();
     check('Real inventory controls reserve only the chosen mineral, sell surplus on entry, and require an explicit sale after protection is removed inside the sell zone');
     await travel(JOURNEY_WORLDS[1].rooms[5].spawn);await shot('03-world2-layer-rock');
     check('Latest public atlas and boundary rock colors render in the second world sixth layer');
   }else{
   await go(id);await shot('01-first-world');
   assert.equal((await snapshot()).economy.worlds.length,3);assert.equal((await snapshot()).economy.destinations.length,6);
   await page.getByRole('button',{name:'跳过引导',exact:true}).click();
   await approachClosedGate(2,'02-world2-gate-behind-spawn');await shot('02-world2-closed');
   await page.getByRole('button',{name:'世界',exact:true}).click();assert.ok((await page.getByRole('dialog').innerText()).includes('1,000,000'));assert.ok((await page.getByRole('dialog').innerText()).includes('10,000,000'));await shot('03-world2-requirements');await page.getByRole('button',{name:'关闭世界与矿区'}).click();
   check('Fresh game: three worlds, six World 1 layers, closed 1m gate blocks walking and clearly separates mine payment');
   for(const world of [2,3]){
     const name=id+'-'+world;await seed(name,world,worldRequirement(world).mined-1);await go('store-'+name);
     assert.equal(await page.evaluate(c=>window.__miningValidation.cell(c),[0,-10,worldRequirement(world).z/2]),0);
     if(world===3)await approachClosedGate(world,'03-world3-gate-behind-spawn');
     await travel([0,.1,13]);const mined=await mineBase(1);assert.equal(mined.after-mined.before,1);assert.equal((await snapshot()).economy.worlds[world-1].areaOpen,true);assert.equal((await snapshot()).economy.worlds[world-1].mineOpen,false);
     await page.evaluate(()=>window.__miningSave.flush());await page.reload({waitUntil:'domcontentloaded'});await ready();assert.equal((await snapshot()).economy.worlds[world-1].areaOpen,true);
     const z=worldRequirement(world).z;await travel(worldSpawn(world-1));await look(Math.PI+.15,-.08);await shot(`0${world+2}-world${world}-open`);await look(Math.PI,.05);await walkUntil(id=>window.__miningValidation.snapshot().economy.currentWorld===id,world);assert.equal((await snapshot()).economy.currentWorld,world);
     await walkUntil(z=>window.__miningValidation.snapshot().position[2]>z+38,worldGateZ(world));
     check(`World ${world}: actual one-unit mining crosses the exact threshold, gate opens, survives reload and allows walking through`);
     await travel([0,.1,z-12]);assert.equal((await snapshot()).economy.atMineEntrance,world);
     await page.keyboard.press('e');await page.getByRole('dialog',{name:'世界与矿区'}).waitFor();
     await page.getByRole('button',{name:'保留这些材料',exact:true}).click();
     const before=await page.evaluate(()=>window.__miningSave.progress());await page.getByRole('button',{name:'缴纳并永久开放矿区',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();
     const cancelled=await page.evaluate(()=>window.__miningSave.progress());assert.deepEqual(cancelled.wallet,before.wallet);assert.deepEqual(cancelled.inventory,before.inventory);
     await page.getByRole('button',{name:'缴纳并永久开放矿区',exact:true}).click();await shot(`06-world${world}-confirm`);await page.getByRole('button',{name:'确认缴纳',exact:true}).click();
     assert.equal((await snapshot()).economy.coins,777);assert.equal((await snapshot()).economy.worlds[world-1].mineOpen,true);assert.equal((await snapshot()).economy.minedVolume,worldRequirement(world).mined);
     await page.getByRole('button',{name:'关闭世界与矿区'}).click();await page.evaluate(()=>window.__miningSave.flush());await page.reload({waitUntil:'domcontentloaded'});await ready();assert.equal((await snapshot()).economy.worlds[world-1].mineOpen,true);
     await travel([0,.1,z-12]);await look(Math.PI,.1);await walkUntil(()=>window.__miningValidation.snapshot().position[1]<-1);
     const gained=await mineBase(world);assert.equal(gained.after-gained.before,world===2?12000:8_000_000);
     await travel([-16,.1,z+44]);assert.equal((await snapshot()).economy.inventory.totalCount,0);assert.equal((await snapshot()).economy.minedVolume,gained.after);
     await page.evaluate(()=>window.__miningSave.flush());await page.reload({waitUntil:'domcontentloaded'});await ready();
     assert.equal(await page.evaluate(c=>window.__miningValidation.cell(c),gained.cell),0);
     assert.equal(await page.evaluate(c=>window.__miningValidation.cell(c),[0,-10,z/2]),0);
     check(`World ${world}: old v11 holes and newly mined blocks survive saving and reloading at the new scene position`);
     check(`World ${world}: cancellation spends nothing; confirmed materials/coins are paid once, mine stays open on reload; entering, mining weighted ore and selling work`);
     const room=JOURNEY_WORLDS[world-1].rooms[5];await travel(room.spawn);assert.equal((await snapshot()).economy.destinations.filter(d=>d.unlocked).length,6);await shot(`07-world${world}-underground`);
     await page.getByRole('button',{name:'返回地表',exact:true}).click();await ready();assert.equal((await snapshot()).economy.currentWorld,world);assert.ok(Math.abs((await snapshot()).position[2]-worldSpawn(world)[2])<1);
     check(`World ${world}: sixth underground layer renders, unlocks only this world's six destinations, return arrives on its own surface`);
   }
   const s=await snapshot();assert.ok(s.economy.worlds.every(w=>w.mineOpen));
   await page.getByRole('button',{name:'世界',exact:true}).click();await page.getByRole('button',{name:'第一世界',exact:true}).click();await page.getByRole('button',{name:'传送到第一世界地表',exact:true}).click();await ready();assert.equal((await snapshot()).economy.currentWorld,1);
   await page.getByRole('button',{name:'矿物背包',exact:true}).click();await shot('08-mineral-management');await page.getByRole('button',{name:'关闭矿物背包'}).click();
   check('World travel returns from World 3 to World 1 while retaining every paid mine');
   }
   report.loadedScripts=await page.locator('script[src]').evaluateAll(scripts=>scripts.map(s=>s.src));
   assert.deepEqual(report.errors,[]);report.result='passed';
 } catch(error){report.result='failed';report.failure=String(error.stack??error);report.state=await snapshot().catch(()=>null);console.error(error);console.log('FAILURE STATE',JSON.stringify(report.state));await shot('failure').catch(()=>{});process.exitCode=1;}
 finally {report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(dir,reportName),JSON.stringify(report,null,2));await browser.close();}
})();
