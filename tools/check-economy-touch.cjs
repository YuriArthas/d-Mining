const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {digCells}=require('./combat-browser.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'economy-touch-public':'economy-touch-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const checks=[],errors=[];
 try{for(const [layout,viewport] of [['landscape',{width:844,height:390}],['portrait',{width:390,height:844}],['compact',{width:640,height:320}]]){
  const page=await browser.newPage({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1});page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));const cdp=await page.context().newCDPSession(page);
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&!s.pendingEdit&&!s.inFlight&&!s.queue&&s.grounded},null,{timeout:30000});
  try{
   await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1&samples=1');await ready();
   await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   const hud=await page.locator('.inventory-hud').boundingBox(),jump=await page.locator('.jump-button').boundingBox();
   assert.ok(hud.x>=0&&hud.y>=0&&hud.x+hud.width<=viewport.width+1&&hud.y+hud.height<=viewport.height+1,`${layout}: HUD fits`);
   const overlap=Math.min(hud.x+hud.width,jump.x+jump.width)>Math.max(hud.x,jump.x)&&Math.min(hud.y+hud.height,jump.y+jump.height)>Math.max(hud.y,jump.y);
   assert.equal(overlap,false,`${layout}: HUD must not overlap jump`);
   await page.evaluate(()=>window.__miningValidation.teleport('bands'));await ready();
   await digCells(page,Array.from({length:12},(_,i)=>[i,-2,-25]));await ready();
   assert.equal((await snap()).economy.inventory.used,40);
   await page.getByRole('button',{name:'返回地表',exact:true}).tap();await ready();
   const back=await snap();assert.equal(back.economy.inventory.used,40);assert.equal(back.economy.coins,0);assert.equal(back.economy.inSellZone,false);assert.ok(back.position[1]>2);
   const rect=await page.locator('.joystick').boundingBox(),p={x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:1};
   const send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   await send('touchStart',[p]);const rotated=layout==='portrait';p.x+=rotated?-32:32;p.y+=32;await send('touchMove',[p]);
   await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.coins===119);await send('touchEnd');
   await page.waitForTimeout(200);assert.equal((await snap()).economy.inventory.used,0);assert.equal((await snap()).economy.coins,119);
   await page.screenshot({path:`artifacts/${label}-${layout}.png`});checks.push(`${layout}: HUD fits, return touch preserves inventory, joystick into ring sells once`);
   await page.getByRole('button',{name:'退出游戏',exact:!hosted}).tap();
   if(hosted)await page.waitForURL(origin+'/');else await page.getByRole('heading',{name:'已退出游戏'}).waitFor();
  }catch(e){await page.screenshot({path:`artifacts/${label}-${layout}-failure.png`});console.error(JSON.stringify({layout,snapshot:await snap().catch(()=>null),errors}));throw e}
  finally{await page.close()}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
