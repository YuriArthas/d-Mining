const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
const out='output/progression-batch-mobile',input=JSON.parse(fs.readFileSync(out+'/fixtures.json'));
const root='https://w-sunjun-public.dev.clock-p.com/',base=root+'games/mining-test/index.html';
const report={url:base,tier:'Public Chromium phone landscape emulation, touch, SwiftShader; not physical iPhone/Safari',checks:[],screenshots:[],errors:[]};
const save=()=>fs.writeFileSync(out+'/'+(process.env.REPORT||'report.json'),JSON.stringify(report,null,2));
const pass=text=>{report.checks.push(text);save();console.log('PASS',text)};
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function run(name,fixture,lang,width,height,safe,action){
 if(process.env.CASE&&!name.startsWith(process.env.CASE))return;
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const p=await context.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>{report.errors.push(name+': '+e.message);save()});
 const id='batch-'+Date.now()+'-'+name;
 try{
 await p.goto(root,{waitUntil:'domcontentloaded'});
 await p.evaluate(async({id,data,g})=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('mining:acceptance:'+id,1);q.onupgradeneeded=()=>{for(const n of ['head','progress','regions'])q.result.createObjectStore(n)};q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});await new Promise((r,j)=>{const tx=db.transaction(['head','progress'],'readwrite');tx.objectStore('head').put({formatVersion:1,revision:1,savedAt:Date.now(),regionCount:0,world:{generationVersion:g.version,seed:g.seed,regionEncoding:1}},'main');tx.objectStore('progress').put({revision:1,data},'main');tx.oncomplete=r;tx.onabort=()=>j(tx.error)});db.close()},{id,data:input.fixtures[fixture],g:input.generation});
 await p.goto(base+'?debug=1&submission=fenced&framesInFlight=1&lang='+lang+'&saveTest='+id,{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000});
 await p.evaluate(async safe=>{for(const [k,v]of Object.entries(safe))document.documentElement.style.setProperty('--safe-'+k,v+'px');await document.fonts.ready},safe);
 const state=()=>p.evaluate(()=>window.__miningValidation.snapshot().economy);
 const tap=async selector=>{const loc=p.locator(selector);await loc.waitFor({state:'visible'});const b=await loc.boundingBox();assert.ok(b);await p.touchscreen.tap(b.x+b.width/2,b.y+b.height/2)};
 const shot=async suffix=>{const frames=await p.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);await p.waitForFunction(f=>window.__miningValidation.snapshot().renderer.submission.submitted>=f+3,frames,{timeout:120000});await p.screenshot({path:out+'/'+name+'-'+suffix+'.png',timeout:120000});report.screenshots.push(name+'-'+suffix+'.png');save()};
 const layout=async()=>{const boxes=await p.evaluate(()=>{const selectors=['.hud-left','.hud-where','.hud-system','.hud-rail','.ui-tip','.hud-sell-guide','.joystick','.jump-button'];return selectors.flatMap(s=>{const e=document.querySelector(s);if(!e)return[];const r=e.getBoundingClientRect();if(!r.width||!r.height)return[];return[{s,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}]})});for(const b of boxes)assert.ok(b.x>=safe.left-1&&b.right<=width-safe.right+1&&b.y>=-1&&b.bottom<=height-safe.bottom+1,JSON.stringify(b));const intersects=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;const central=boxes.filter(b=>['.hud-where','.ui-tip','.hud-sell-guide'].includes(b.s));for(const a of central)for(const b of boxes.filter(b=>['.hud-system','.hud-rail','.joystick','.jump-button'].includes(b.s)))assert.ok(!intersects(a,b),a.s+' overlaps '+b.s);pass(name+' layout fits safe area and touch controls');};
 await action({p,state,tap,shot,layout});
 }catch(e){report.lastState=await p.evaluate(()=>{const s=window.__miningValidation?.snapshot();return s&&{position:s.position,ready:s.ready,grounded:s.grounded,depth:s.economy.depth,world:s.economy.currentWorld,location:s.economy.location,error:s.error,renderer:s.renderer.submission}}).catch(()=>null);save();throw e;}finally{await context.close()}
}
try{
 for(const [lang,w,h,safe]of [['zh',852,393,{left:59,right:59,top:0,bottom:21}],['en',568,320,{left:0,right:0,top:0,bottom:0}],['vi',667,375,{left:0,right:0,top:0,bottom:0}],['id',852,393,{left:59,right:59,top:0,bottom:21}]]){
 await run(lang+'-'+w,'full',lang,w,h,safe,async({p,state,tap,shot,layout})=>{
 assert.equal((await state()).inventory.used,25);assert.equal((await state()).inventory.totalCount,5);await layout();await shot('full');
 if(lang==='zh'){await p.waitForTimeout(13000);assert.equal(await p.locator('.hud-sell-guide').count(),1);await p.emulateMedia({reducedMotion:'reduce'});assert.deepEqual(await p.evaluate(()=>['.hud-sell','.hud-sell-arrow'].map(s=>getComputedStyle(document.querySelector(s)).animationName)),['none','none']);}
 const before=await state();await tap(lang==='zh'?'.hud-sell-guide':'.hud-sell');await p.waitForFunction(()=>window.__miningValidation.snapshot().economy.inventory.used===0,null,{timeout:120000});assert.equal((await state()).coins,before.coins+before.sale.payouts.find(p=>p.currency==='gold')?.coins);assert.equal(await p.locator('.hud-sell-guide').count(),0);pass(lang+' full bag weighted + touch sale exactly once');
 });}
 for(const [key,tip]of [['egg','pets'],['station','station'],['portal','portal'],['world2','world2'],['world3','world3']])await run(key,key,'zh',852,393,{left:59,right:59,top:0,bottom:21},async({p,state,tap,shot,layout})=>{
 await p.waitForSelector('.ui-tip[data-tip="'+tip+'"]');await layout();await shot('hint');const before=await state();await tap('.ui-tip-go');
 await p.waitForFunction(key=>{const s=window.__miningValidation.snapshot().economy;return key==='egg'?!!s.eggId:key==='station'?s.atStation:s.atPortal},key,{timeout:120000});
 assert.deepEqual((await state()).balances,before.balances);assert.deepEqual((await state()).worlds.map(w=>w.open),before.worlds.map(w=>w.open));pass(key+' hint touch reaches its service without spending');await shot('arrived');
 });
 await run('shop','shop','zh',852,393,{left:59,right:59,top:0,bottom:21},async({p,state,tap,shot})=>{
 await tap('[data-tip-target="shop"]');await p.waitForSelector('.shop-next');
 await tap('.shop-next');await p.waitForSelector('.shop-showroom[data-item=tool-2]');await tap('.shop-next');await p.waitForSelector('.shop-showroom[data-item=tool-3]');await p.waitForFunction(()=>!document.querySelector('[data-testid="shop-buy"]').disabled);
 const before=await state();await tap('[data-testid="shop-buy"]');await p.waitForFunction(()=>window.__miningValidation.snapshot().economy.pickaxe.level===3);assert.deepEqual((await state()).equipment.tools,[1,3]);assert.ok((await state()).coins<before.coins);pass('shop touch skips tool 2 and buys tool 3');await shot('skipped');
 await tap('.shop-switch');await p.waitForSelector('.shop-showroom[data-category=backpacks]');await tap('.shop-next');await p.waitForSelector('.shop-showroom[data-item=journey-bag-2]');await tap('.shop-next');await p.waitForSelector('.shop-showroom[data-item=journey-bag-3]');await tap('[data-testid="shop-buy"]');await p.waitForFunction(()=>window.__miningValidation.snapshot().economy.inventory.capacity===35);assert.deepEqual((await state()).equipment.backpacks,[25,35]);pass('shop touch skips backpack 2 and buys backpack 3');await shot('backpack');
 });
 await run(process.env.ROUTE_NAME||'route','route','en',852,393,{left:59,right:59,top:0,bottom:21},async({p,state,tap,shot,layout})=>{
 for(const w of (process.env.WORLDS?process.env.WORLDS.split(',').map(Number):[1,2,3])){
  const room=input.destinations.filter(d=>d.worldId===w)[w===1?2:0];
  await p.evaluate(at=>window.__miningValidation.teleport(at),room.spawn);
  await p.waitForFunction(({id,depth})=>{const s=window.__miningValidation.snapshot();return s.ready&&s.economy.depth>=depth&&s.economy.destinations.find(d=>d.id===id)?.unlocked},room,{timeout:180000});
  const before=await state();assert.equal(await p.locator('[data-testid=depth]').innerText(),room.depth+'m');assert.equal(await p.locator('[role=progressbar][data-testid=journey-goals]').getAttribute('aria-valuemax'),w===1?'860':'2400');await layout();await shot('world'+w+'-deep');
  await tap('.hud-return');await p.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.economy.location==='surface'},null,{timeout:120000});
  assert.equal(await p.locator('[data-testid=depth]').innerText(),'0m');assert.deepEqual((await state()).destinations.map(d=>d.unlocked),before.destinations.map(d=>d.unlocked));await shot('world'+w+'-returned');pass('world '+w+' current-depth pointer resets and discovered route stays unlocked');
 }
 });
 assert.deepEqual(report.errors,[]);report.passed=true;save();
}catch(e){report.failure=e.stack;save();throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
