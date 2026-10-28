const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir=path.resolve(process.env.ARTIFACT_DIR||'artifacts/shop-mobile');
(async()=>{
 await fs.mkdir(dir,{recursive:true});
 const report={url,startedAt:new Date().toISOString(),tier:'Mobile Chromium emulation, Android UA, touch, landscape 844x390 and 640x320 with safe areas. SwiftShader; not physical-phone/Safari/GPU acceptance.',checks:[],errors:[]};
 const browser=await chromium.launch({args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});
 p.setDefaultTimeout(90000);p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const c=await p.context().newCDPSession(p),send=(type,touchPoints=[])=>c.send('Input.dispatchTouchEvent',{type,touchPoints});
 const snapshot=()=>p.evaluate(()=>window.__miningValidation.snapshot()),gear=()=>p.evaluate(()=>window.__miningSave.progress()),shop=()=>p.evaluate(()=>window.__mining.getShop());
 const write=()=>fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));
 const check=async s=>{report.checks.push(s);console.log('PASS',s);await write();};
 const ready=()=>p.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&window.__miningSave&&!document.querySelector('.loading-screen'),null,{timeout:240000});
 const draw=async()=>{const n=(await snapshot()).renderer.submission.submitted;await p.waitForFunction(n=>{document.querySelector('canvas').getContext('webgl2').finish();return window.__miningValidation.snapshot().renderer.submission.submitted>=n+2;},n,{timeout:120000,polling:250});};
 const shot=async name=>{await draw();await p.screenshot({path:path.join(dir,name+'.png'),timeout:60000});console.log('SHOT',name);};
 const enter=async()=>{
  await p.evaluate(()=>{window.__miningValidation.teleport([-20,.1,-2.5]);window.__miningValidation.look(0,.38);});await ready();
  await p.waitForFunction(()=>window.__miningValidation.snapshot().position[2]>-4);
  const r=await p.locator('.joystick').boundingBox();await send('touchStart',[{x:r.x+r.width/2,y:r.y+r.height/2-35,id:1}]);
  await p.getByRole('dialog',{name:'商店分类',exact:true}).waitFor();await send('touchEnd');
 };
 const open=async kind=>{await p.locator(`.shop-category[data-category=${kind}]`).tap();await p.waitForFunction(()=>{const s=window.__mining.getShop();return s.ready&&s.frames>0;});await draw();};
 try{
  const testUrl=url+'?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=shop-'+Date.now();
  await p.goto(testUrl,{waitUntil:'domcontentloaded'});await ready();
  await p.locator('.hud-action[data-kind=upgrade]').tap();assert.equal(await p.getByRole('dialog').count(),0);assert.equal((await snapshot()).economy.requestedShop,true);await shot('01-phone-shop-guide');
  await enter();assert.equal(await p.locator('.shop-category').count(),3);assert.equal(await p.locator('[data-category=rebirth]').isDisabled(),true);
  const entered=await snapshot();await shot('02-phone-shop-categories');const parked=await snapshot();assert.deepEqual(parked.position,entered.position);assert.equal(await p.locator('.joystick').count(),0);assert.equal(parked.avatar.mining.active,false);
  await check('HUD guides to the physical Shop; a real finger joystick crosses its boundary, opens 3 categories, disables rebirth and stops movement/mining.');
  await open('tools');assert.equal((await shop()).current,'tool-1');assert.equal((await shop()).next,'tool-2');assert.equal(await p.getByRole('button',{name:'上一件商品',exact:true}).isDisabled(),true);await shot('03-phone-tool-first');
  await p.getByRole('button',{name:'下一件商品',exact:true}).tap();await draw();assert.equal((await shop()).current,'tool-2');assert.equal((await shop()).next,'tool-3');assert.equal(await p.getByTestId('shop-buy').isDisabled(),true);await shot('04-phone-tool-next');
  await p.getByRole('button',{name:'切换到背包商店',exact:true}).tap();await draw();assert.equal((await shop()).current,'starter-bag');assert.equal((await shop()).next,'journey-bag-2');await shot('05-phone-backpack');
  await check('Full-screen shop renders current and actual next tool/bag, first previous is disabled, next browsing changes models, and insufficient coins cannot purchase.');
  for(const [width,height]of [[844,390],[640,320]]){
   await p.setViewportSize({width,height});await p.locator('.game-shell').evaluate(e=>{e.style.setProperty('--safe-left','24px');e.style.setProperty('--safe-right','18px');e.style.setProperty('--safe-top','4px');e.style.setProperty('--safe-bottom','8px');});
   await draw();for(const selector of ['.shop-item-heading','.shop-top-actions','.shop-prev','.shop-next','.shop-wallet','.shop-item-actions']){
    const r=await p.locator(selector).boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,selector+' fits '+width);
   }
   for(const selector of ['.shop-next','.shop-prev','.shop-close','.shop-switch','.shop-buy']){const r=await p.locator(selector).boundingBox();assert.ok(r.width>=44&&r.height>=44,selector+' touch size');}
   await shot('06-phone-safe-'+width+'x'+height);
  }
  const r=await p.locator('.shop-item-heading h1').boundingBox();await send('touchStart',[{x:r.x+r.width/2,y:r.y+r.height/2,id:2}]);await p.waitForTimeout(900);await send('touchEnd');assert.equal(await p.evaluate(()=>getSelection().toString()),'');
  await check('Both landscape phone sizes and injected safe-area insets keep text/actions in bounds with 44px+ main targets; long press selects no text.');
  await p.getByRole('button',{name:'关闭商店',exact:true}).tap();await draw();assert.equal(await p.getByRole('dialog').count(),0);assert.equal((await shop()).mode,'closed');assert.equal((await snapshot()).avatar.mining.strikes,entered.avatar.mining.strikes);assert.equal(await p.locator('.hud-settings').evaluate(e=>e.open),false);assert.equal(await p.evaluate(()=>window.__mining.getInput().mining),false);await draw();assert.equal(await p.getByRole('dialog').count(),0);
  await p.setViewportSize({width:844,height:390});await enter();await p.getByRole('button',{name:'关闭商店',exact:true}).tap();
  await check('Close has no click-through or ghost mining, remains dismissed while standing inside, and leaving/re-entering reopens the shop.');
  // Seed only this unique acceptance database while its game tab is unloaded.
  await p.evaluate(()=>window.__miningSave.flush());const namespace=await p.evaluate(()=>window.__miningSave.namespace);assert.match(namespace,/acceptance/);
  await p.goto('https://w-sunjun-public.dev.clock-p.com/',{waitUntil:'domcontentloaded'});
  await p.evaluate(async name=>{const db=await new Promise((r,j)=>{const q=indexedDB.open(name);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});await new Promise((r,j)=>{const t=db.transaction('progress','readwrite'),s=t.objectStore('progress'),q=s.get('main');q.onsuccess=()=>{const v=q.result;v.data.wallet.coins=1000;v.data.onboarding.status='skipped';s.put(v,'main');};t.oncomplete=r;t.onabort=()=>j(t.error);});db.close();},namespace);
  await p.goto(testUrl,{waitUntil:'domcontentloaded'});await ready();await enter();await open('tools');await p.getByRole('button',{name:'下一件商品',exact:true}).tap();await p.getByTestId('shop-buy').tap();
  assert.equal((await gear()).wallet.coins,950);assert.equal((await gear()).pickaxe.level,2);await p.getByTestId('shop-buy').tap({force:true});assert.equal((await gear()).wallet.coins,950);
  await p.getByRole('button',{name:'上一件商品',exact:true}).tap();await p.getByTestId('shop-buy').tap();assert.equal((await gear()).pickaxe.level,1);assert.equal((await gear()).equipment.toolLevel,2);assert.equal((await gear()).wallet.coins,950);
  await p.getByRole('button',{name:'切换到背包商店',exact:true}).tap();await p.getByRole('button',{name:'下一件商品',exact:true}).tap();await p.getByTestId('shop-buy').tap();assert.equal((await gear()).wallet.coins,900);assert.equal((await gear()).inventory.capacity,150);
  await draw();assert.equal((await snapshot()).avatar.backpack.model,'Bag02');await shot('07-phone-purchased-bag');await p.getByRole('button',{name:'上一件商品',exact:true}).tap();await p.getByTestId('shop-buy').tap();assert.equal((await gear()).inventory.capacity,50);
  await check('Funded isolated save: touch purchases tool and bag once at 50 coins each; repeated purchase cannot debit again; old owned gear equips free and updates avatar models.');
  await p.getByRole('button',{name:'关闭商店',exact:true}).tap();await p.evaluate(()=>window.__miningSave.flush());await p.reload({waitUntil:'domcontentloaded'});await ready();
  const restored=await gear();assert.equal(restored.wallet.coins,900);assert.equal(restored.pickaxe.level,1);assert.equal(restored.inventory.capacity,50);assert.equal(restored.equipment.toolLevel,2);assert.equal(restored.equipment.backpackCapacity,150);
  await enter();await open('tools');await p.getByRole('button',{name:'下一件商品',exact:true}).tap();assert.equal(await p.getByTestId('shop-buy').innerText(),'装备');await p.getByTestId('shop-buy').tap();assert.equal((await gear()).wallet.coins,900);await draw();assert.equal((await snapshot()).avatar.pickaxe.model,'Tool02');await shot('08-phone-restored-owned-tool');
  await check('Reload retains active old gear AND highest purchased collection; re-equipping purchased tool remains free and uses Tool02 on the actual avatar.');
  report.shop=await shop();report.gear=await gear();
  // Reopen an actual purchased bag with mineral contents exceeding the starter bag.
  await p.getByRole('button',{name:'关闭商店',exact:true}).tap();await p.evaluate(()=>window.__miningSave.flush());
  await p.goto('https://w-sunjun-public.dev.clock-p.com/',{waitUntil:'domcontentloaded'});
  await p.evaluate(async name=>{const db=await new Promise((r,j)=>{const q=indexedDB.open(name);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});await new Promise((r,j)=>{const t=db.transaction('progress','readwrite'),s=t.objectStore('progress'),q=s.get('main');q.onsuccess=()=>{const v=q.result;v.data.inventory.capacity=150;v.data.inventory.items={'journey.rock.0':51};s.put(v,'main');};t.oncomplete=r;t.onabort=()=>j(t.error);});db.close();},namespace);
  await p.goto(testUrl,{waitUntil:'domcontentloaded'});await ready();await enter();await open('backpacks');await p.getByRole('button',{name:'上一件商品',exact:true}).tap();
  assert.match(await p.getByTestId('shop-buy').innerText(),/请先出售矿石/);assert.equal(await p.getByTestId('shop-buy').isDisabled(),true);assert.equal((await gear()).inventory.items['journey.rock.0'],51);await shot('09-phone-small-bag-protection');
  await p.getByRole('button',{name:'关闭商店',exact:true}).tap();await draw();
  assert.equal((await snapshot()).avatar.pickaxe.model,'Tool02');assert.equal((await snapshot()).avatar.backpack.model,'Bag02');
  await p.evaluate(()=>{window.__miningValidation.teleport([0,.1,46]);window.__miningValidation.look(0,.12);});await ready();await shot('10-phone-equipped-avatar');
  const beforeMove=await snapshot(),j=await p.locator('.joystick').boundingBox();await send('touchStart',[{x:j.x+j.width/2+30,y:j.y+j.height/2,id:3}]);
  await p.waitForFunction(x=>Math.abs(window.__miningValidation.snapshot().position[0]-x)>.5,beforeMove.position[0]);await send('touchEnd');
  assert.equal((await gear()).inventory.items['journey.rock.0'],51);
  await check('A smaller owned bag is disabled while carrying 51 ore; closing restores actual world movement with Tool02 and Bag02 attached and all minerals preserved.');
  assert.deepEqual(report.errors,[]);report.ok=true;
 }catch(error){report.failure=String(error);report.snapshot=await snapshot().catch(()=>null);await p.screenshot({path:path.join(dir,'failure.png'),timeout:30000}).catch(()=>{});throw error;}
 finally{await write();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
