const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const {PerspectiveCamera,Vector3}=require('../node_modules/three');
const {digCells,totals}=require('./combat-browser.cjs');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'volume-public':'volume-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),checks=[],errors=[];
 const layouts=[['desktop',{width:1120,height:630},false],['landscape',{width:844,height:390},true],['portrait',{width:390,height:844},true],['compact',{width:640,height:320},true]];
 try{for(const [layout,viewport,touch] of layouts.filter(([name])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(name))){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});page.setDefaultTimeout(25000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  const cdp=await page.context().newCDPSession(page),send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&!s.queue&&!s.inFlight&&!s.pendingEdit&&s.grounded},null,{timeout:30000});
  const press=async name=>{const button=page.getByRole('button',{name,exact:true});await(touch?button.tap():button.click())};
  const teleport=async p=>{await page.evaluate(p=>window.__miningValidation.teleport(p),p);await ready();await page.waitForTimeout(200)};
  const project=async point=>{const s=await snap(),rotated=viewport.height>viewport.width,w=rotated?viewport.height:viewport.width,h=rotated?viewport.width:viewport.height;
   const c=new PerspectiveCamera(55,w/h,.08,1000);c.position.fromArray(s.camera.position);c.lookAt(c.position.clone().sub(new Vector3(...s.camera.direction)));c.updateMatrixWorld();const v=new Vector3(...point).project(c),x=(v.x+1)*w/2,y=(1-v.y)*h/2;return {x:rotated?viewport.width-y:x,y:rotated?x:y,id:1};};
  const layoutCheck=async()=>{
   const box=await page.locator('.inventory-hud').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'HUD fits');
   if(touch){const j=await page.locator('.jump-button').boundingBox();assert.ok(Math.min(box.x+box.width,j.x+j.width)<=Math.max(box.x,j.x)||Math.min(box.y+box.height,j.y+j.height)<=Math.max(box.y,j.y),'HUD leaves jump clear')}
  };
  const buy=async prices=>{await press('升级');for(const price of prices)await press(`花费 ${price} 金币升级`);await press('关闭升级界面')};
  try{
   await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});await layoutCheck();
   await teleport('bands');const point=await project([17,0,-49]);
   if(touch)await send('touchStart',[point]);else{await page.mouse.move(point.x,point.y);await page.mouse.down()}
   await page.waitForFunction(()=>window.__miningValidation.health([8,-1,-25])===80);
   await page.getByTestId('target-value').filter({hasText:'体积 5 · 售价 16 金币'}).waitFor();
   if(touch)await send('touchEnd');else await page.mouse.up();
   assert.equal((await snap()).economy.inventory.used,0);assert.equal((await snap()).cracks.instances,1);
   await digCells(page,[[8,-1,-25]]);await ready();let state=(await snap()).economy;
   assert.equal(state.inventory.items['ore.copper'],1);assert.equal(state.inventory.totalCount,1);assert.equal(state.inventory.used,5);assert.equal(state.sale.coins,16);
   await page.getByTestId('bag-count').filter({hasText:'容量 5/50'}).waitFor();await page.getByTestId('sale-quote').filter({hasText:'共 1 件 · 预计 16 金币'}).waitFor();
   await page.screenshot({path:`artifacts/${label}-${layout}-one.png`});
   // All funds below are earned by real HP/cooldown, terrain deletion and surface sale.
   await digCells(page,[[6,-1,-25],...Array.from({length:8},(_,i)=>[-16+i,-2,-25])]);await ready();
   await teleport([2,2.1,18]);assert.equal((await snap()).economy.coins,32);await teleport('bands');await buy([5,7,9,11]);
   assert.equal((await snap()).economy.pickaxe.level,5);assert.equal((await snap()).economy.coins,0);
   await digCells(page,[[11,-1,-25]]);await ready();await teleport([2,2.1,18]);assert.equal((await snap()).economy.coins,40);await teleport('bands');await buy([13]);
   assert.equal((await snap()).economy.pickaxe.level,6);assert.equal((await snap()).economy.pickaxe.speed,4);
   await digCells(page,[[14,-1,-25],[12,-1,-25],[13,-1,-25],[11,-2,-25],[-8,-2,-25],[-7,-2,-25]]);await ready();
   state=(await snap()).economy;assert.equal(state.inventory.used,47);assert.equal(state.inventory.totalCount,6);assert.equal(state.inventory.isFull,false);
   await digCells(page,[[12,-2,-25]]);await ready();state=(await snap()).economy;
   assert.equal(state.inventory.used,57);assert.equal(state.inventory.totalCount,7);assert.equal(state.inventory.items['ore.gold'],4);assert.equal(state.sale.coins,242);
   assert.deepEqual(totals(state.inventory.items),{used:57,count:7,coins:242});
   assert.equal((await page.evaluate(()=>window.__miningValidation.hit([9,-1,-25]))).status,'full');assert.equal(await page.evaluate(()=>window.__miningValidation.health([9,-1,-25])),90);
   await page.getByTestId('bag-count').filter({hasText:'容量 57/50'}).waitFor();await layoutCheck();await page.screenshot({path:`artifacts/${label}-${layout}-full.png`});
   await press('升级');await press('背包');await press('花费 20 金币升级');await press('关闭升级界面');state=(await snap()).economy;
   assert.equal(state.inventory.capacity,100);assert.equal(state.inventory.used,57);assert.equal(state.inventory.totalCount,7);assert.equal(state.coins,7);
   await digCells(page,[[9,-1,-25]]);await ready();state=(await snap()).economy;assert.equal(state.inventory.used,62);assert.equal(state.inventory.totalCount,8);assert.equal(state.sale.coins,258);
   await press('返回地表');await ready();assert.equal((await snap()).economy.inventory.used,62);assert.equal((await snap()).economy.inSellZone,false);
   if(touch){const r=await page.locator('.joystick').boundingBox(),p={x:r.x+r.width/2,y:r.y+r.height/2,id:1};await send('touchStart',[p]);p.x+=layout==='portrait'?-32:32;p.y+=32;await send('touchMove',[p]);await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.coins===265);await send('touchEnd')}
   else{await page.keyboard.down('d');await page.waitForFunction(()=>window.__miningValidation.snapshot().position[0]>1.8);await page.keyboard.up('d');await page.keyboard.down('s');await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.coins===265);await page.keyboard.up('s')}
   await page.waitForTimeout(250);state=(await snap()).economy;assert.equal(state.inventory.used,0);assert.equal(state.inventory.totalCount,0);assert.equal(state.coins,265);assert.match(state.notice,/出售 8 件，获得 258 金币/);
   await layoutCheck();await page.screenshot({path:`artifacts/${label}-${layout}-sold.png`});
   checks.push(`${layout}: actual ${touch?'touch':'mouse'} HP/volume/price readout; 1 copper = 5 capacity/16 coins; 47→57 overflow and full blocks damage; weighted contents survive upgrades; actual movement into sale circle sells 8 items for 258, once; HUD fits`);
  }catch(e){await page.screenshot({path:`artifacts/${label}-${layout}-failure.png`});console.error(JSON.stringify({layout,snapshot:await snap().catch(()=>null),errors}));throw e}finally{await page.close()}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
