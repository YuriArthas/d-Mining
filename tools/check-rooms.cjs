const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const {digCells}=require('./combat-browser.cjs');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'rooms-public':'rooms-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),checks=[],errors=[];
 const layouts=[['desktop',{width:1120,height:630},false],['landscape',{width:844,height:390},true],['portrait',{width:390,height:844},true],['compact',{width:640,height:320},true]];
 try{for(const [layout,viewport,touch] of layouts.filter(([name])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(name))){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&!s.travelling&&!s.queue&&!s.inFlight&&!s.pendingEdit&&s.grounded});
  const press=async name=>{const b=page.getByRole('button',{name,exact:true});await(touch?b.tap():b.click())};
  const teleport=async p=>{await page.evaluate(p=>window.__miningValidation.teleport(p),p);await ready()};
  const cdp=await page.context().newCDPSession(page);
  const move=async(sign,until)=>{
   if(touch){const r=await page.locator('.joystick').boundingBox(),p={id:1,x:r.x+r.width/2,y:r.y+r.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
    if(viewport.height>viewport.width)p.y+=sign*40;else p.x+=sign*40;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});
    try{await until()}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
   }else{await page.locator('.scene').focus();await page.keyboard.down(sign>0?'d':'a');try{await until()}finally{await page.keyboard.up(sign>0?'d':'a')}}
  };
  const travel=async index=>{await press('传送');const b=page.locator('.travel-list button').nth(index);await(touch?b.tap():b.click());await ready()};
  try{
   await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1&samples=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   await press('传送');assert.equal(await page.locator('.travel-list button:disabled').count(),2);await press('关闭传送界面');
   // Carve a real two-cell pocket far outside the first room, using combat and rewards.
   await digCells(page,[[25,-200,30],[25,-199,30],...Array.from({length:6},(_,i)=>[-16+i,-2,-25])]);await ready();
   await teleport([51,-399.9,61]);let s=await snap();
   assert.ok(s.economy.destinations[0].unlocked);assert.equal(s.economy.destinations[1].unlocked,false);assert.deepEqual(s.facilities.visuals,[]);
   assert.equal(s.editBytes>0,true);
   await press('返回地表');await ready();await travel(0);s=await snap();
   assert.ok(Math.abs(s.position[1]+400)<.05);assert.deepEqual(s.facilities.visuals,['old_mine']);assert.equal(s.economy.shopId,null);
   await page.screenshot({path:`artifacts/${label}-${layout}-room.png`});
   const before=s.economy.coins,quote=s.economy.sale.coins;
   await teleport([-14.5,-399.9,12]);await move(1,()=>page.waitForFunction(()=>window.__miningValidation.snapshot().economy.inventory.used===0));
   assert.equal((await snap()).economy.coins,before+quote);
   // The aligned entrance remains mineable, and edits survive room unload/reload.
   await teleport([0,-399.9,3]);await digCells(page,[[3,-201,3]]);await ready();
   await teleport('deep');assert.equal((await snap()).economy.destinations.every(r=>r.unlocked),true);
   assert.deepEqual((await snap()).facilities.visuals,['core']);
   await press('返回地表');await ready();await travel(1);s=await snap();
   assert.ok(Math.abs(s.position[1]+800)<.05);assert.deepEqual(s.facilities.visuals,['fungal']);
   await teleport([9.5,-799.9,12]);await move(1,()=>page.waitForFunction(()=>window.__miningValidation.snapshot().economy.shopId==='fungal'));
   await page.getByRole('heading',{name:'升级商店',exact:true}).waitFor();
   await press('花费 5 金币升级');assert.equal((await snap()).economy.pickaxe.level,2);
   await page.screenshot({path:`artifacts/${label}-${layout}-shop.png`});
   await move(-1,()=>page.waitForFunction(()=>window.__miningValidation.snapshot().economy.shopId===null));
   assert.equal(await page.getByRole('heading',{name:'升级商店',exact:true}).count(),0);
   await move(1,()=>page.waitForFunction(()=>window.__miningValidation.snapshot().economy.shopId==='fungal'));
   await page.getByRole('heading',{name:'升级商店',exact:true}).waitFor();await press('关闭升级界面');
   await press('返回地表');await ready();assert.deepEqual((await snap()).facilities.visuals,['surface']);
   await press('传送');await page.screenshot({path:`artifacts/${label}-${layout}-travel.png`});
   const panel=await page.locator('.travel-panel').boundingBox();assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=viewport.width+1&&panel.y+panel.height<=viewport.height+1);
   const b=page.locator('.travel-list button').first();await(touch?b.tap():b.click());await ready();
   assert.equal(await page.evaluate(()=>window.__miningValidation.cell([3,-201,3])),0);
   checks.push(`${layout}: locked travel; 400m reached outside room unlocks only first destination; home UI travel lands safely; physical entry sells once; floor excavation persists; depth jump unlocks second; shop entry/purchase/exit/reentry; fixtures unload; travel panel fits`);
  }catch(e){await page.screenshot({path:`artifacts/${label}-${layout}-failure.png`});console.error(JSON.stringify({layout,snapshot:await snap().catch(()=>null),errors}));throw e}finally{await page.close()}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
