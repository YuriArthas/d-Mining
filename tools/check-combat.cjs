const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const {PerspectiveCamera,Vector3}=require('../node_modules/three');
const {digCells}=require('./combat-browser.cjs');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'combat-public':'combat-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),checks=[],errors=[];
 try{for(const [layout,viewport,touch] of [['desktop',{width:1120,height:630},false],['landscape',{width:844,height:390},true],['portrait',{width:390,height:844},true],['compact',{width:640,height:320},true]]){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&!s.queue&&!s.inFlight&&!s.pendingEdit&&s.grounded},null,{timeout:30000});
  const press=async name=>{const b=page.getByRole('button',{name,exact:true});await(touch?b.tap():b.click())};
  const project=async(point)=>{const s=await snap(),rotated=viewport.height>viewport.width,w=rotated?viewport.height:viewport.width,h=rotated?viewport.width:viewport.height;
   const c=new PerspectiveCamera(55,w/h,.08,1000);c.position.fromArray(s.camera.position);c.lookAt(c.position.clone().sub(new Vector3(...s.camera.direction)));c.updateMatrixWorld();const v=new Vector3(...point).project(c),x=(v.x+1)*w/2,y=(1-v.y)*h/2;return {x:rotated?viewport.width-y:x,y:rotated?x:y,id:1};};
  const teleport=async target=>{await page.evaluate(t=>window.__miningValidation.teleport(t),target);await ready();await page.waitForTimeout(250)};
  const hp=c=>page.evaluate(c=>window.__miningValidation.health(c),c);
  try{
   await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1&samples=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   await press('升级');assert.ok(await page.getByRole('button',{name:'还差 5 金币',exact:true}).isDisabled());
   const rect=await page.getByRole('dialog').boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width+1&&rect.y+rect.height<=viewport.height+1);
   assert.ok(await page.locator('.upgrade-panel').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'all purchase controls fit without scrolling');
   await page.screenshot({path:`artifacts/${label}-${layout}-upgrade.png`});await press('背包');assert.ok(await page.getByRole('button',{name:'还差 20 金币',exact:true}).isDisabled());await press('关闭升级界面');
   await teleport('bands');const cell=[8,-1,-25],point=await project([17,0,-49]);
   const cdp=await page.context().newCDPSession(page),send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   if(touch){await send('touchStart',[point]);await send('touchEnd');await page.waitForFunction(()=>window.__miningValidation.health([8,-1,-25])===80);await page.waitForTimeout(600);await send('touchStart',[point]);}
   else {await page.mouse.move(point.x,point.y);await page.mouse.down();}
   const expectedHp=touch?70:80;
   await page.waitForFunction(hp=>window.__miningValidation.health([8,-1,-25])===hp,expectedHp);
   await page.getByTestId('target-hp').filter({hasText:`${expectedHp} / 90`}).waitFor();
   if(touch)await send('touchEnd');else await page.mouse.up();
   assert.equal((await snap()).economy.inventory.used,0);assert.equal(await hp(cell),expectedHp);
   // Retap and change target in the existing cooldown; both must preserve HP.
   if(!touch)await page.mouse.click(point.x,point.y);
   assert.equal((await page.evaluate(()=>window.__miningValidation.hit([9,-1,-25]))).status,'cooldown');assert.equal(await hp(cell),expectedHp);assert.equal(await hp([9,-1,-25]),90);
   if(!touch)await page.getByTestId('target-hp').filter({hasText:'80 / 90'}).waitFor();
   if(!touch)await page.screenshot({path:`artifacts/${label}-${layout}-hp.png`});
   await teleport('deep');assert.equal(await hp(cell),expectedHp);await teleport('bands');assert.equal(await hp(cell),expectedHp);
   const again=await project([17,0,-49]);if(touch)await send('touchStart',[again]);else {await page.mouse.move(again.x,again.y);await page.mouse.down();}
   await page.waitForFunction(()=>window.__miningValidation.cell([8,-1,-25])===0);if(touch)await send('touchEnd');else await page.mouse.up();await ready();
   assert.equal((await snap()).economy.inventory.used,5);assert.equal((await snap()).combat.damagedCells,0);
   checks.push(`${layout}: real ${touch?'touch hold':'mouse'} damages one cell; cooldown, partial HP and travel persistence; destruction awards once`);
   // Real single-cell mining and sale earn enough to test the first speed step on desktop.
   const needed=touch?0:29;await digCells(page,Array.from({length:needed},(_,i)=>[-16+i%16,-2-Math.floor(i/16),-25]));await ready();
   await teleport([2,2.1,18]);await page.waitForFunction(n=>window.__miningValidation.snapshot().economy.coins===n,needed+16);await teleport('bands');
   if(touch){
    const stick=await page.locator('.joystick').boundingBox(),button=await page.getByRole('button',{name:'升级',exact:true}).boundingBox();
    const a={x:stick.x+stick.width/2,y:stick.y+stick.height/2,id:1},b={x:button.x+button.width/2,y:button.y+button.height/2,id:2};
    await send('touchStart',[a]);await send('touchStart',[a,b]);await send('touchEnd',[b]);await page.getByRole('dialog').waitFor();await send('touchEnd');
   }else await press('升级');
   await page.keyboard.down('w');await page.waitForTimeout(100);await page.keyboard.up('w');assert.equal(await page.evaluate(()=>window.__mining.getInput().moveY),0);
   for(const price of touch?[5]:[5,7,9,11,13])await press(`花费 ${price} 金币升级`);
   const state=(await snap()).economy;assert.equal(state.pickaxe.level,touch?2:6);assert.equal(state.pickaxe.power,touch?15:35);assert.equal(state.pickaxe.speed,touch?2:4);assert.equal(state.coins,touch?11:0);
   await page.screenshot({path:`artifacts/${label}-${layout}-bought.png`});await press('关闭升级界面');
   await page.keyboard.down('w');await page.waitForFunction(()=>window.__mining.getInput().moveY!==0);await page.keyboard.up('w');
   await teleport('bands');const result=await page.evaluate(()=>window.__miningValidation.hit([14,-1,-25]));assert.equal(result.remaining,touch?335:315);
   const timing=(await snap()).combat;assert.ok(timing.nextAttackAt-timing.now<=1/state.pickaxe.speed+.01);assert.ok(timing.nextAttackAt-timing.now>1/state.pickaxe.speed-.2);
   if(touch){await teleport([29,.1,-47]);const crystal=await project([29,0,-49]);await send('touchStart',[crystal]);await page.waitForFunction(()=>window.__miningValidation.health([14,-1,-25])<335);await page.screenshot({path:`artifacts/${label}-${layout}-hp.png`});await send('touchEnd');}
   checks.push(`${layout}: upgrade tabs fit, funds and input isolation, one purchase per touch, Lv.${state.pickaxe.level} power/speed active`);
   if(!touch){await digCells(page,Array.from({length:20},(_,i)=>[-16+i%16,-8-Math.floor(i/16),-25]));await ready();await teleport([2,2.1,18]);assert.equal((await snap()).economy.coins,20);await teleport('bands');await digCells(page,[[6,-2,-25]]);await press('升级');await press('背包');await press('花费 20 金币升级');const bag=(await snap()).economy;assert.equal(bag.inventory.capacity,100);assert.equal(bag.inventory.used,3);assert.equal(bag.coins,0);await press('关闭升级界面');checks.push('desktop: backpack upgrade still spends correctly and retains collected items');}
  }catch(e){await page.screenshot({path:`artifacts/${label}-${layout}-failure.png`});console.error(JSON.stringify({layout,snapshot:await snap().catch(()=>null),errors}));throw e}
  finally{await page.close()}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
