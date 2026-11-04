const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
const out='output/currency-sale',input=JSON.parse(fs.readFileSync('output/currency-sale/fixtures.json'));
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
 for(const [name,fixture,lang,w,h,safe] of [['obsidian-852','obsidian','zh',852,393,{left:59,right:59,top:0,bottom:21}],['mixed-568','mixed','en',568,320,{left:0,right:0,top:0,bottom:0}]]) {
 await run(name,fixture,lang,w,h,safe,async({p,state,tap,shot})=>{
  await p.evaluate(z=>window.__miningValidation.teleport([z.x,z.y,z.z]),input.portal);
  await p.waitForSelector('.portal-world:nth-child(2) .portal-go');
  await tap('.portal-world:nth-child(2) .portal-go');
  await p.waitForFunction(()=>window.__miningValidation.snapshot().economy.currentWorld===2&&!window.__miningValidation.snapshot().travelling,null,{timeout:180000});
  const expected=fixture==='obsidian'?[{currency:'gold',coins:17000}]:[{currency:'gold',coins:17000},{currency:'tech',coins:6},{currency:'star',coins:9}];
  assert.deepEqual((await state()).sale.payouts,expected);
  await tap('.hud-bag .ui-pill-hit');await p.waitForSelector('.bag-sell-value');
  assert.deepEqual(await p.locator('.bag-sell-value').evaluateAll(es=>es.map(e=>({currency:e.dataset.currency,amount:e.querySelector('b').textContent}))),expected.map(p=>({currency:p.currency,amount:p.coins===17000?(lang==='zh'?'1.7万':'17K'):String(p.coins)})));
  const cells=await p.locator('.bag-ore-price').evaluateAll(es=>es.map(e=>e.dataset.currency));
  assert.deepEqual([...new Set(cells)].sort(),expected.map(p=>p.currency).sort());
  const boxes=await p.locator('.bag-sell-value').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:e.clientWidth,scroll:e.scrollWidth}}));
  for(const b of boxes)assert.ok(b.x>=safe.left&&b.right<=w-safe.right&&b.y>=0&&b.bottom<=h-safe.bottom&&b.scroll<=b.width+1,JSON.stringify(b));
  await shot('quote');pass(name+' real touch portal to W2; quote and per-ore icons retain origin currencies and fit landscape');
  await tap('.ui-sheet-close');await p.evaluate(()=>window.__miningValidation.overlayTimeScale(12));await tap('.hud-sell');
  await p.waitForFunction(()=>window.__miningValidation.snapshot().economy.inventory.totalCount<=2&&window.__miningValidation.snapshot().economy.balances.gold===17000,null,{timeout:120000});
  const balances=fixture==='obsidian'?{gold:17000,tech:0,star:0}:{gold:17000,tech:6,star:9};
  assert.deepEqual((await state()).balances,balances);assert.deepEqual((await state()).inventory.items,fixture==='obsidian'?{}:{'journey.rock.0':2});
  await p.waitForFunction(()=>document.querySelector('.sale-gain [data-currency="gold"]'));
  assert.deepEqual(await p.locator('.sale-gain > span').evaluateAll(es=>es.map(e=>e.dataset.currency)),expected.map(p=>p.currency));
  if(fixture==='obsidian')assert.equal(await p.locator('.sale-coin').count(),0,'gold must not fly into W2 tech counter');
  await shot('sold');pass(name+' touch Sell credits origin balances once, preserves locks, and uses correct payout icons');
  await p.evaluate(()=>window.__miningSave.flush());await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000});
  assert.deepEqual((await state()).balances,balances);assert.deepEqual((await state()).inventory.items,fixture==='obsidian'?{}:{'journey.rock.0':2});pass(name+' actual IndexedDB reload preserves exactly one sale');
 });}
 assert.deepEqual(report.errors,[]);report.passed=true;save();
} catch(e){report.failure=e.stack;save();throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
