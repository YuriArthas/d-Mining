const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
const out='output/economy-carry',input=JSON.parse(fs.readFileSync('output/economy-carry/fixtures.json'));
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
 const layout=async()=>{const boxes=await p.evaluate(()=>{const selectors=['.hud-left','.hud-wallet','.hud-where','.hud-system','.hud-rail','.ui-tip','.hud-sell-guide','.joystick','.jump-button'];return selectors.flatMap(s=>{const e=document.querySelector(s);if(!e)return[];const r=e.getBoundingClientRect();if(!r.width||!r.height)return[];return[{s,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}]})});for(const b of boxes)assert.ok(b.x>=safe.left-1&&b.right<=width-safe.right+1&&b.y>=-1&&b.bottom<=height-safe.bottom+1,JSON.stringify(b));const intersects=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;const central=boxes.filter(b=>['.hud-where','.ui-tip','.hud-sell-guide'].includes(b.s));for(const a of central)for(const b of boxes.filter(b=>['.hud-system','.hud-rail','.joystick','.jump-button'].includes(b.s)))assert.ok(!intersects(a,b),a.s+' overlaps '+b.s);const wallet=boxes.find(b=>b.s==='.hud-wallet'),route=boxes.find(b=>b.s==='.hud-where');if(wallet&&route)assert.ok(!intersects(wallet,route),'capacity must not cover depth pointer');pass(name+' layout fits safe area and touch controls');};
 await action({p,state,tap,shot,layout});
 }catch(e){report.lastState=await p.evaluate(()=>{const s=window.__miningValidation?.snapshot();return s&&{position:s.position,ready:s.ready,grounded:s.grounded,depth:s.economy.depth,world:s.economy.currentWorld,location:s.economy.location,error:s.error,renderer:s.renderer.submission}}).catch(()=>null);save();throw e;}finally{await context.close()}
}
try {
 await run('legacy-852','legacy','zh',852,393,{left:59,right:59,top:0,bottom:21},async({p,state,tap,shot,layout})=>{
 const s=await state();assert.equal(s.inventory.capacity,input.economy.bags[2].capacity);assert.equal(s.inventory.used,260);assert.deepEqual(s.equipment.backpacks,[25,190]);assert.equal(s.sale.payouts.find(p=>p.currency==='gold')?.coins,20);
 await layout();await shot('full');await tap('.hud-bag .ui-pill-hit');await p.waitForSelector('.bag-ore-volume');assert.match(await p.locator('.bag-ore-volume').innerText(),/13/);await shot('contents');await tap('.ui-sheet-close');
 await tap('.hud-sell');await p.waitForFunction(()=>window.__miningValidation.snapshot().economy.inventory.used===0,null,{timeout:120000});assert.equal((await state()).coins,s.coins+20);pass('old skipped bag migrates to tier 3; 20 rocks occupy 260, sell for 20 exactly once');
 await p.evaluate(()=>window.__miningSave.flush());await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000});assert.equal((await state()).inventory.capacity,190);assert.equal((await state()).inventory.used,0);assert.equal((await state()).coins,s.coins+20);pass('tier identity and sale survive public IndexedDB reload');
 });
 for(const [lang,w,h] of [['en',568,320],['vi',667,375]]) await run(lang+'-large','large',lang,w,h,{left:0,right:0,top:0,bottom:0},async({p,state,tap,shot,layout})=>{
 assert.equal((await state()).inventory.capacity,14000000);await layout();await shot('capacity');await tap('.hud-bag .ui-pill-hit');await p.waitForSelector('.bag-ore-volume');assert.equal(await p.locator('.bag-ore-volume').count(),2);
 const touch=await p.context().newCDPSession(p);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:w/2,y:h-55}]});for(let step=1;step<=8;step++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:w/2,y:h-55-step*20}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
 await p.waitForFunction(()=>{const e=document.querySelector('.bag-ore-volume'),r=e.getBoundingClientRect();return r.y>50&&r.bottom<innerHeight-20});await shot('contents');
 const boxes=await p.locator('.bag-ore-volume').evaluateAll(es=>es.map(e=>({width:e.clientWidth,scroll:e.scrollWidth})));for(const b of boxes)assert.ok(b.scroll<=b.width+1,JSON.stringify(b));pass(lang+' million-unit capacity and per-block occupancy fit phone layout');
 });
 await run('shop','shop','zh',852,393,{left:59,right:59,top:0,bottom:21},async({p,state,tap,shot})=>{
 await tap('[data-tip-target="shop"]');await p.waitForSelector('.shop-next');await tap('.shop-switch');await p.waitForSelector('.shop-showroom[data-category=backpacks]');await tap('.shop-next');await p.waitForSelector('.shop-showroom[data-item=journey-bag-2]');await tap('.shop-next');await p.waitForSelector('.shop-showroom[data-item=journey-bag-3]');const before=await state();await tap('[data-testid="shop-buy"]');await p.waitForFunction(()=>window.__miningValidation.snapshot().economy.inventory.capacity===190);assert.deepEqual((await state()).equipment.backpacks,[25,190]);assert.equal((await state()).coins,before.coins-input.economy.bags[2].price);await shot('skipped');pass('touch buys tier 3 directly for its new price');
 });
 await run('mine','mine','zh',852,393,{left:59,right:59,top:0,bottom:21},async({p,state,tap,shot})=>{
 await p.evaluate(()=>{window.__miningValidation.teleport([1,.1,1]);window.__miningValidation.look(0,1.1);window.__miningValidation.overlayTimeScale(40)});
 await p.waitForFunction(()=>window.__miningValidation.snapshot().ready&&!window.__miningValidation.snapshot().travelling,null,{timeout:120000});
 await shot('pit');
 let found=false;
 for(const [x,y] of [[426,260],[400,245],[450,245],[426,290],[370,275],[480,275],[426,220]]) {
  await p.touchscreen.tap(x,y);
  try{await p.waitForSelector('.mine-plate-on:not([data-state=broken]) .mine-plate-volume',{timeout:6000});found=true;break}catch{}
 }
 assert.ok(found,'a touch on reachable rock produces its mining plate');assert.match(await p.locator('.mine-plate-volume').innerText(),/每块占 1 容量/);await shot('occupancy');pass('actual touch mining plate displays one-slot surface rock');
 });
 assert.deepEqual(report.errors,[]);report.passed=true;save();
} catch(e){report.failure=e.stack;save();throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
