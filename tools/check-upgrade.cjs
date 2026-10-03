const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {digCells}=require('./combat-browser.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'upgrade-public':'upgrade-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),checks=[],errors=[];
 try {for(const [layout,viewport,touch] of [['desktop',{width:1120,height:630},false],['landscape',{width:844,height:390},true],['portrait',{width:390,height:844},true],['compact',{width:640,height:320},true]]){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&!s.queue&&!s.inFlight&&!s.pendingEdit&&s.grounded},null,{timeout:30000});
  const press=async(name)=>{const button=page.getByRole('button',{name,exact:true});if(touch)await button.tap();else await button.click();};
  try{
   await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1');await ready();
   await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   await press('升级');await press('背包');await page.getByRole('dialog',{name:'升级'}).waitFor();
   assert.equal(await page.getByRole('button',{name:'还差 20 金币',exact:true}).isDisabled(),true);
   const panel=await page.getByRole('dialog').boundingBox();assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=viewport.width+1&&panel.y+panel.height<=viewport.height+1);
   const before=await snap();await page.keyboard.down('w');await page.waitForTimeout(180);await page.keyboard.up('w');
   assert.equal(await page.evaluate(()=>window.__mining.getInput().moveY),0);assert.equal((await snap()).committedEdits,before.committedEdits);
   if(!touch){await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await press('升级');await press('背包');}
   await page.screenshot({path:`artifacts/${label}-${layout}-empty.png`});await press('关闭升级界面');
   // Earn the temporary tier prices through real terrain deletion and the sale trigger.
   for(let cycle=0;cycle<4;cycle++){
    await page.evaluate(()=>window.__miningValidation.teleport('bands'));await ready();
    const count=cycle===3?20:50;
    for(let start=0;start<count;start+=25){const cells=Array.from({length:Math.min(25,count-start)},(_,j)=>[-16+(start+j)%16,-2-cycle*4-Math.floor((start+j)/16),-25]);
     await digCells(page,cells);await ready();}
    await page.evaluate(()=>window.__miningValidation.teleport([2,2.1,18]));await ready();
    await page.waitForFunction(n=>window.__miningValidation.snapshot().economy.coins===n,cycle===3?170:50*(cycle+1));
   }
   await page.evaluate(()=>window.__miningValidation.teleport('bands'));await ready();
   await digCells(page,[[-15,-1,-26],[-14,-1,-26],[-13,-1,-26]]);await ready();
   assert.equal((await snap()).economy.inventory.used,3);
   if(touch){
    // Open with a second finger while joystick is held; opening must cancel the old gesture.
    const cdp=await page.context().newCDPSession(page),stick=await page.locator('.joystick').boundingBox(),button=await page.getByRole('button',{name:'升级',exact:true}).boundingBox();
    const a={x:stick.x+stick.width/2,y:stick.y+stick.height/2,id:1},b={x:button.x+button.width/2,y:button.y+button.height/2,id:2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[b]});
    await page.getByRole('dialog').waitFor();assert.equal(await page.evaluate(()=>window.__mining.getInput().moveY),0);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else await press('升级');
   await press('背包');
   await press('花费 20 金币升级');await page.waitForTimeout(160);
   let s=(await snap()).economy;assert.equal(s.inventory.capacity,100);assert.equal(s.coins,150);assert.equal(s.inventory.used,3);
   await page.getByText('升级成功！容量增加到 100',{exact:true}).waitFor();
   await page.screenshot({path:`artifacts/${label}-${layout}-bought.png`});
   await press('花费 50 金币升级');s=(await snap()).economy;assert.equal(s.inventory.capacity,200);assert.equal(s.coins,100);
   await press('花费 100 金币升级');s=(await snap()).economy;assert.equal(s.inventory.capacity,400);assert.equal(s.coins,0);
   assert.equal(await page.getByRole('button',{name:'已升至最高容量',exact:true}).isDisabled(),true);
   if(!touch){await page.keyboard.press('Escape');}else await press('关闭升级界面');
   await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.getByTestId('bag-count').textContent(),'容量 3/400');
   await page.keyboard.down('w');await page.waitForFunction(()=>window.__mining.getInput().moveY!==0);await page.keyboard.up('w');
   await press('升级');await press('背包');assert.equal(await page.getByRole('button',{name:'已升至最高容量',exact:true}).isDisabled(),true);await press('关闭升级界面');
   await digCells(page,[[-12,-1,-26]]);await ready();assert.equal((await snap()).economy.inventory.used,4);
   await page.getByRole('button',{name:/退出游戏/}).click();if(!hosted)await page.getByRole('heading',{name:'已退出游戏'}).waitFor();else await page.waitForURL(origin+'/');
   checks.push(`${layout}: panel fits, insufficient/three purchases/max, contents retained, no duplicate touch purchase, input isolated and restored`);
  }catch(e){await page.screenshot({path:`artifacts/${label}-${layout}-failure.png`});console.error(JSON.stringify({layout,snapshot:await snap().catch(()=>null),errors}));throw e}
  finally{await page.close()}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
