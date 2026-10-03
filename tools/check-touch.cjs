const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '../../d-Block-Blast/node_modules/playwright');
const {digCells}=require('./combat-browser.cjs');
const {PerspectiveCamera,Vector3}=require('../node_modules/three');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'touch-public':'touch-local';
 const b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const p=await ctx.newPage(),cdp=await ctx.newCDPSession(p),errors=[],checks=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 const snap=()=>p.evaluate(()=>window.__miningValidation.snapshot());
 const ready=()=>p.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&!s.queue&&!s.inFlight&&!s.pendingEdit&&s.grounded},null,{timeout:30000});
 const send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 const touch=(x,y,id=1)=>({x,y,id,radiusX:2,radiusY:2,force:1});
 const input=()=>p.evaluate(()=>window.__mining.getInput());
 const project=async(point,id=1)=>{
  const s=await snap(),size=p.viewportSize(),rotated=size.height>size.width;
  const w=rotated?size.height:size.width,h=rotated?size.width:size.height;
  const c=new PerspectiveCamera(55,w/h,.08,1000);c.position.fromArray(s.camera.position);c.lookAt(c.position.clone().sub(new Vector3(...s.camera.direction)));c.updateMatrixWorld();
  const v=new Vector3(...point).project(c),gx=(v.x+1)/2*w,gy=(1-v.y)/2*h;
  return touch(rotated?size.width-gy:gx,rotated?gx:gy,id);
 };
 const center=async(selector,id)=>{const r=await p.locator(selector).boundingBox();return touch(r.x+r.width/2,r.y+r.height/2,id)};
 const moveGame=(point,dx,dy)=>{if(p.viewportSize().height>p.viewportSize().width){point.x-=dy;point.y+=dx}else{point.x+=dx;point.y+=dy}};
 const teleport=async x=>{await p.evaluate(x=>window.__miningValidation.teleport([x,.1,-19]),x);await ready();await p.waitForTimeout(200)};
 const mineOn=()=>p.waitForFunction(()=>window.__mining.getInput().mining);
 const noInput=async()=>{await p.waitForFunction(()=>{const i=window.__mining.getInput();return !i.mining&&!i.jumpHeld&&i.moveX===0&&i.moveY===0&&!window.__miningValidation.snapshot().aim.active},null,{timeout:3000});const i=await input();assert.equal(i.mining,false);assert.equal(i.jumpHeld,false);assert.equal(i.moveX,0);assert.equal(i.moveY,0);assert.equal((await snap()).aim.active,false)};
 try{
  for(const portrait of [false,true]){
   const layout=portrait?'portrait':'landscape';await p.setViewportSize(portrait?{width:390,height:844}:{width:844,height:390});
   await p.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1&samples=1');await ready();await p.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});await teleport(41);
   assert.equal(await p.locator('.mine-button,.crosshair').count(),0);assert.equal(await p.locator('.touch-target').isVisible(),false);
   assert.ok(await p.evaluate(()=>document.querySelector('canvas').width>document.querySelector('canvas').height));
   const old=(await snap()).committedEdits,tap=await project([43,0,-19]);
   await send('touchStart',[tap]);await send('touchEnd');await p.waitForTimeout(300);await ready();
   assert.equal((await snap()).committedEdits,old);await noInput();checks.push(`${layout}: short tap never digs`);
   const hold=await project([43,0,-19]);await send('touchStart',[hold]);await mineOn();
   await p.waitForFunction(()=>window.__miningValidation.cell([21,-1,-10])===0);await send('touchEnd');await ready();
   assert.ok(await p.evaluate(()=>window.__miningValidation.cell([20,-1,-10])));await noInput();
   checks.push(`${layout}: off-center touch digs pointed cell, not center`);
   // Real drag before the hold deadline, followed by stationary holding.
   const drag=await project([39,0,-21]);const before=(await snap());await send('touchStart',[drag]);moveGame(drag,45,0);await send('touchMove',[drag]);
   await p.waitForFunction(y=>Math.abs(window.__miningValidation.snapshot().view.yaw-y)>.1,before.view.yaw);await p.waitForTimeout(250);
   assert.equal((await input()).mining,false);assert.equal((await snap()).committedEdits,before.committedEdits);await send('touchEnd');
   // Restore camera angle with another actual drag.
   await send('touchStart',[drag]);moveGame(drag,-45,0);await send('touchMove',[drag]);await send('touchEnd');
   await p.waitForFunction(()=>Math.abs(window.__miningValidation.snapshot().view.yaw)<.01);
   checks.push(`${layout}: early drag turns camera; stopping never starts mining`);
   await teleport(61);
   const a=await project([63,0,-19]),next=await project([59,0,-21]);const view=(await snap()).view;
   await send('touchStart',[a]);await mineOn();await send('touchMove',[next]);
   await p.waitForFunction(()=>window.__miningValidation.cell([29,-1,-11])===0);
   assert.deepEqual((await snap()).view,view);await p.screenshot({path:`artifacts/${label}-${layout}-hold.png`});
   await send('touchEnd');await ready();await noInput();const count=(await snap()).committedEdits;await p.waitForTimeout(350);assert.equal((await snap()).committedEdits,count);
   checks.push(`${layout}: hold then slide retargets without orbit; release stops new digs`);
   // Three independent roles plus a fourth touch that cannot steal world ownership.
   await teleport(81);const stick=await center('.joystick',2),jump=await center('.jump-button',3),miner=await project([83,0,-19],1);
   await send('touchStart',[miner]);await mineOn();const aim={...(await snap()).aim};
   await send('touchStart',[miner,stick,jump]);assert.equal((await input()).jumpHeld,true);assert.deepEqual((await snap()).aim,aim);
   const extra=await project([79,0,-21],4);await send('touchStart',[miner,stick,jump,extra]);moveGame(extra,30,0);await send('touchMove',[miner,stick,jump,extra]);assert.deepEqual((await snap()).aim,aim);
   const z=(await snap()).position[2];moveGame(stick,0,-35);await send('touchMove',[miner,stick,jump,extra]);
   await p.waitForFunction(z=>window.__miningValidation.snapshot().position[2]<z-.5,z);
   await send('touchEnd',[miner]);assert.equal((await input()).mining,false);assert.equal((await snap()).aim.active,false);
   await send('touchCancel');await noInput();checks.push(`${layout}: joystick+jump+mine coexist; extra world finger cannot steal or inherit`);
   // Cancel while waiting and cancel an active captured finger over UI.
   await teleport(41);const cancel=await project([39,0,-21]);await send('touchStart',[cancel]);await send('touchCancel');await p.waitForTimeout(250);await noInput();
   const captured=await project([39,0,-21]);await send('touchStart',[captured]);await mineOn();const overUI=await center('.jump-button',captured.id);await send('touchMove',[overUI]);await noInput();await send('touchEnd');
   checks.push(`${layout}: cancellation clears hold timer; captured mining cannot pass through UI`);
   // Reset while a timer is pending must not reactivate it later.
   const reset=await project([39,0,-21]);await send('touchStart',[reset]);await p.evaluate(()=>window.__miningValidation.teleport([41,.1,-19]));await send('touchEnd');await ready();await p.waitForTimeout(250);await noInput();
   checks.push(`${layout}: relocation cancels pending hold`);
  }
  // Weighted ore can fill 50 capacity before six layers. Earn/sell and buy 100
  // through gameplay so this input regression can exercise all six layers.
  for(let i=0;(await snap()).economy.sale.coins<20;i++)await digCells(p,[[-16+i,-1,-25]]);
  await p.evaluate(()=>window.__miningValidation.teleport([2,2.1,18]));await ready();
  await p.getByRole('button',{name:'升级',exact:true}).tap();await p.getByRole('button',{name:'背包',exact:true}).tap();
  await p.getByRole('button',{name:'花费 20 金币升级',exact:true}).tap();await p.getByRole('button',{name:'关闭升级界面',exact:true}).tap();
  // Portrait gesture maps vertical screen travel to downward camera pitch.
  await teleport(61);const look=touch(240,480);await send('touchStart',[look]);moveGame(look,0,175);await send('touchMove',[look]);await send('touchEnd');
  await p.waitForFunction(()=>window.__miningValidation.snapshot().view.pitch>1.4);
  const old=(await snap()).committedEdits,shaft=touch(195,422);await send('touchStart',[shaft]);
  await p.waitForFunction(n=>window.__miningValidation.snapshot().committedEdits>=n+6,old,{timeout:120000});await send('touchEnd');await ready();assert.ok((await snap()).position[1]<-8);
  checks.push('held touch continues through six exposed layers while falling');
  // Resizing during an active hold cancels capture and mining.
  await send('touchStart',[shaft]);await mineOn();await p.setViewportSize({width:844,height:390});await p.waitForTimeout(250);await noInput();await send('touchEnd');
  checks.push('orientation change releases active hold');
  // Exit while a world touch still owns capture, via a second finger on exit.
  const air=touch(420,190);await send('touchStart',[air]);const exit=await center('[aria-label^="退出游戏"]',9);
  await send('touchStart',[air,exit]);await send('touchEnd',[exit]);await send('touchEnd');
  await p.getByRole('heading',{name:hosted?'游戏列表':'已退出游戏',exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>!!window.__miningValidation),false);await p.waitForTimeout(300);assert.deepEqual(errors,[]);checks.push('exit during captured gesture leaves no delayed callback errors');
  await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }catch(e){console.error(JSON.stringify({checks,stats:await snap().catch(()=>null),input:await input().catch(()=>null),errors}));await p.screenshot({path:`artifacts/${label}-failure.png`});throw e;}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
