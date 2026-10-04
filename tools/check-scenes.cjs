const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const {ROOMS}=require('../src/game/world/rooms.ts');
(async()=>{
 const url=process.argv[2]||'http://127.0.0.1:4175/',label=process.argv[3]||'scenes-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),report={checks:[],samples:[],errors:[]};
 try{for(const [layout,viewport,touch] of [['desktop',{width:1280,height:720},false],['compact',{width:640,height:320},true],['portrait',{width:390,height:844},true]].filter(([l])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(l))){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const teleport=async feet=>{await page.evaluate(p=>window.__miningValidation.teleport(p),feet);await ready();await page.waitForTimeout(250)};
  await page.goto(url+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const surface=await snap();
  const lighting=surface.lighting;
  if(lighting){assert.equal(lighting.shadowAutoUpdate,false);await page.waitForFunction(n=>window.__miningValidation.snapshot().frames>=n,surface.frames+20);assert.equal((await snap()).lighting.staticShadowUpdates,lighting.staticShadowUpdates);}

  const destinations=[{id:'surface',depth:0,spawn:'surface'},...ROOMS];
  for(const r of destinations.filter((r,i)=>layout==='desktop'||[0,1,2,3,9].includes(i))){
   if(r.depth)await teleport(r.spawn);
   const s=await snap();assert.ok(Math.abs(s.position[1]+r.depth-(r.depth?0:2))<.05);assert.ok(s.camera.position.every(Number.isFinite));assert.equal(s.camera.obstructed,false);
   assert.equal(s.lighting.surfaceReflections,r.id==='surface');
   assert.deepEqual(s.facilities.visuals,[r.id]);assert.ok(s.facilities.colliders>0);assert.equal(s.error,null);
   const y=-r.depth/2-1;assert.equal(await page.evaluate(y=>{let n=0;for(let x=-10;x<10;x++)for(let z=-10;z<10;z++)if(window.__miningValidation.canMine([x,y,z]))n++;return n},y),64);
   await page.screenshot({path:`artifacts/${label}-${layout}-${r.id}.png`});
   const hud=await page.locator('.inventory-hud').boundingBox();assert.ok(hud.x>=0&&hud.y>=0&&hud.x+hud.width<=viewport.width+1&&hud.y+hud.height<=viewport.height+1);
   report.samples.push({layout,layer:r.id,render:s.renderer,facilities:s.facilities,frameTimings:s.timings});
  }
  // Max depth unlocks all camps. Real UI travel back to the first room must use its new configured landing.
  await teleport('deep');assert.ok((await snap()).economy.destinations.every(d=>d.unlocked));
  const press=async name=>{const b=page.getByRole('button',{name,exact:true});await(touch?b.tap():b.click())};
  await press('返回地表');await ready();await press('传送');
  const list=page.locator('.travel-list button');assert.equal(await list.count(),9);
  const last=list.last();await last.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/${label}-${layout}-travel.png`});await(touch?last.tap():last.click());await ready();assert.ok(Math.abs((await snap()).position[1]+3600)<.05);
  await press('返回地表');await ready();await press('传送');const first=page.locator('.travel-list button').first();await(touch?first.tap():first.click());await ready();assert.ok(Math.abs((await snap()).position[2]-11)<.01);
  // Repeat unload/reload; renderer resources must return to the warmed surface baseline.
  for(let i=0;i<2;i++){await teleport(ROOMS[3].spawn);await teleport('surface')}
  const after=await snap();assert.deepEqual(after.facilities.visuals,['surface']);assert.equal(after.facilities.colliders,surface.facilities.colliders);assert.equal(after.renderer.textures,surface.renderer.textures);assert.ok(after.renderer.geometries<=surface.renderer.geometries+2);
  report.checks.push(`${layout}: themes render, 64-cell entries, safe camera/landing, independent fixture residency, nine destinations, last/first real UI travel, unload/reload resource counts stable`);
  if(!url.includes('/games/mining/')){await press('退出游戏');await page.getByRole('heading',{name:'已退出游戏'}).waitFor();assert.equal(await page.locator('canvas').count(),0);}
  await page.close();console.log(layout+' passed');
 }
 assert.deepEqual(report.errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
