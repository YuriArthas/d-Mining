const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const { PerspectiveCamera, Vector3 } = require('../node_modules/three');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const url = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/pinewind-mobile-public');
(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation, Android UA, touch enabled, landscape only, DPR 1 / SwiftShader. Not a physical phone or performance measurement.', checks: [], layouts: [], errors: [], screenshots: [] };
  const browser = await chromium.launch({ args: ['--remote-debugging-port=9340', '--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const snap = () => page.evaluate(() => window.__miningValidation.snapshot());
  const input = () => page.evaluate(() => window.__mining.getInput());
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const ready = () => page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 240000 });
  const draw = async () => {
    const n = (await snap()).renderer.submission.submitted;
    await page.waitForFunction(n => { document.querySelector('canvas').getContext('webgl2').finish(); return window.__miningValidation.snapshot().renderer.submission.submitted >= n + 2; }, n, { timeout: 120000, polling: 300 });
  };
  const shot = async name => { await draw(); await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 60000 }); report.screenshots.push(name); console.log('SHOT', name); await save(); };
  const intersects = (a, b) => Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1 && Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1;
  const fits = (r, label) => { const v=page.viewportSize(); assert.ok(r && r.x>=-1 && r.y>=-1 && r.x+r.width<=v.width+1 && r.y+r.height<=v.height+1, label+' fits '+JSON.stringify(r)); };
  const layout = async name => {
    const rows = await page.evaluate(() => ['.hud-status','.hud-navigation','.hud-equipment','.guide-card','.joystick','.jump-button','.hud-settings>summary','.hud-help','.hud-exit'].map(selector => {
      const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,x:r.x,y:r.y,width:r.width,height:r.height};
    }));
    for (const r of rows) fits(r, r.selector);
    const [status,nav,equipment,guide,stick,jump]=rows;
    assert.ok(!intersects(status,nav),'resources separate from menu');
    for(const r of [nav,equipment,guide])for(const control of [stick,jump])assert.ok(!intersects(r,control),r.selector+' clear of '+control.selector);
    for(const b of await page.locator('.hud-navigation button:visible,.hud-return,.hud-help,.hud-exit,.hud-settings>summary,.jump-button').all()){
      const r=await b.boundingBox();fits(r,await b.getAttribute('class'));assert.ok(r.width>=44&&r.height>=44,'44px touch target');
    }
    assert.equal(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches),true);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.game-shell')).transform),'none');
    assert.equal(await page.evaluate(()=>document.elementFromPoint(innerWidth*.53,innerHeight*.45)?.tagName),'CANVAS');
    assert.ok(!(await page.locator('.guide-card').innerText()).match(/WASD|鼠标|右键|左键/));
    report.layouts.push({name,viewport:page.viewportSize(),rows});
  };
  const open = async (name, secondary=false) => {
    if(secondary)await page.getByRole('button',{name:'更多功能',exact:true}).tap();
    await page.getByRole('button',{name,exact:typeof name==='string'}).tap();
    await page.getByRole('dialog').waitFor();fits(await page.getByRole('dialog').boundingBox(),'dialog');
    assert.equal(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'no dialog horizontal overflow');
    const close=page.getByRole('dialog').getByRole('button',{name:/关闭/}).first();const r=await close.boundingBox();fits(r,'dialog close');assert.ok(r.width>=44&&r.height>=44);
  };
  const close = async () => { await page.getByRole('dialog').getByRole('button',{name:/关闭/}).first().tap();await page.waitForFunction(()=>document.querySelector('.session-ui').dataset.panel==='none'); assert.equal(await page.locator('.hud-settings').evaluate(e=>e.open),false,'no settings click-through'); assert.equal(await page.locator('.hud-debug-tools').evaluate(e=>e.open),false,'no debug click-through'); };
  const swipe = async (selector) => {
    const target=page.locator(selector),r=await target.boundingBox();
    const start=await target.evaluate(e=>e.scrollTop);
    const x=r.x+r.width*.58,y=Math.min(page.viewportSize().height-35,r.y+r.height-30);
    await send('touchStart',[{x,y,id:7}]);
    for(let i=1;i<=8;i++)await send('touchMove',[{x,y:y-i*16,id:7}]);
    await send('touchEnd');
    await page.waitForFunction(({selector,start})=>document.querySelector(selector).scrollTop>start+20,{selector,start});
  };
  try {
    await page.goto(url+'?debug=1&submission=fenced&framesInFlight=1&saveTest=phone-'+Date.now(),{waitUntil:'domcontentloaded'});await ready();
    report.loadedScripts=await page.evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean));
    for(const [width,height] of [[844,390],[667,375],[640,320],[932,430]]){
      await page.setViewportSize({width,height});await layout(`${width}x${height}`);await shot(`01-landscape-${width}x${height}`);
    }
    await check('Four phone landscape sizes fit: 844x390, 667x375, 640x320, 932x430. HUD clears both thumbs; >=44px actions, touch instructions, unobstructed camera region.');
    await page.setViewportSize({width:844,height:390});
    await page.locator('.game-shell').evaluate(e=>{e.style.setProperty('--safe-left','44px');e.style.setProperty('--safe-right','44px');e.style.setProperty('--safe-bottom','21px');});
    await layout('844x390 with injected notch/home safe margins');await shot('02-safe-margins');
    await page.locator('.game-shell').evaluate(e=>{for(const p of ['--safe-left','--safe-right','--safe-bottom'])e.style.removeProperty(p);});
    await check('Landscape layout also fits injected 44px side safe margins and 21px bottom margin; simulated safe-area geometry, not an iPhone hardware test.');
    // Multi-touch must use the player's controls, not direct movement APIs.
    let r=await page.locator('.joystick').boundingBox();const stick={x:r.x+r.width/2,y:r.y+r.height/2,id:1};
    const before=await snap();await send('touchStart',[stick]);stick.x+=30;await send('touchMove',[stick]);
    assert.ok((await input()).moveX>.2);
    const camera={x:450,y:200,id:2};await send('touchStart',[stick,camera]);camera.x+=65;await send('touchMove',[stick,camera]);
    await page.waitForFunction(y=>Math.abs(window.__miningValidation.snapshot().view.yaw-y)>.1,before.view.yaw);
    assert.ok((await input()).moveX>.2);
    await page.waitForFunction(p=>Math.hypot(window.__miningValidation.snapshot().position[0]-p[0],window.__miningValidation.snapshot().position[2]-p[2])>.1,before.position);
    await send('touchEnd');assert.equal((await input()).moveX,0);assert.equal((await input()).mining,false);
    r=await page.locator('.jump-button').boundingBox();const jumps=(await input()).jumpCount;
    await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);assert.equal((await input()).jumpCount,jumps+1);assert.equal((await input()).jumpHeld,false);
    await check('Actual CDP two-finger joystick + camera changes player position and yaw concurrently; release clears movement. Touch jump fires once and releases.');
    r=await page.locator('.joystick').boundingBox();const held={x:r.x+r.width/2+28,y:r.y+r.height/2,id:1};
    await send('touchStart',[held]);assert.ok((await input()).moveX>.2);
    const upgrade=await page.getByRole('button',{name:'升级',exact:true}).boundingBox();
    const second={x:upgrade.x+upgrade.width/2,y:upgrade.y+upgrade.height/2,id:2};
    await send('touchStart',[held,second]);await send('touchEnd');await page.getByRole('dialog').waitFor();
    assert.equal((await input()).moveX,0);assert.equal((await input()).mining,false);await close();
    await check('A non-primary menu finger opens exactly one dialog while a joystick touch is active; releasing both clears movement.');
    // Check expanded actions before opening their original panels.
    await page.getByRole('button',{name:'更多功能',exact:true}).tap();
    for(const b of await page.locator('.hud-secondary button').all())fits(await b.boundingBox(),'expanded action');
    await shot('03-expanded-functions');await page.getByRole('button',{name:'收起功能',exact:true}).tap();
    for(const [name,secondary] of [['升级',false],['打开我的宠物',false],['世界',true],['矿物背包',true],[/^奖励/,true],['传送',true],['操作帮助',false]]){await open(name,secondary);await close();}
    await check('All six game features plus help open and close with finger taps. Secondary menu closes after selection.');
    await page.setViewportSize({width:640,height:320});
    await open('打开我的宠物');await page.getByRole('button',{name:'获取宠物 · 寻找蛋台',exact:true}).tap();
    await page.getByRole('button',{name:/^前往.*蛋台$/}).first().tap();
    await page.waitForFunction(()=>document.querySelector('.session-ui').dataset.panel==='none');
    assert.ok(!(await page.locator('.guide-card').innerText()).match(/按 E|WASD|鼠标/));
    fits(await page.getByRole('button',{name:'取消指引',exact:true}).boundingBox(),'cancel egg guidance');
    await shot('04-small-phone-egg-guidance');await page.getByRole('button',{name:'取消指引',exact:true}).tap();
    await check('640x320 phone: Find Egg provides touch instructions and an accessible Cancel action.');
    await open('升级');await swipe('.upgrade-panel');await shot('04-small-phone-upgrade-scrolled');await close();
    await open(/^奖励/,true);assert.equal(await page.locator('textarea').evaluate(e=>getComputedStyle(e).userSelect),'text');await page.locator('textarea').fill('手机输入测试');assert.equal(await page.locator('textarea').inputValue(),'手机输入测试');await swipe('.rewards-content');await shot('05-small-phone-rewards-scrolled');await close();
    await open('操作帮助');assert.ok((await page.getByRole('dialog').innerText()).includes('左侧摇杆'));
    const helpText=page.locator('.guide-help p').first();assert.equal(await helpText.evaluate(e=>getComputedStyle(e).userSelect),'none');
    const textRect=await helpText.boundingBox();await page.evaluate(()=>getSelection().removeAllRanges());
    await send('touchStart',[{x:textRect.x+30,y:textRect.y+10,id:9}]);await page.waitForTimeout(850);await send('touchEnd');
    assert.equal(await page.evaluate(()=>getSelection().toString()),'');
    await shot('06-phone-long-press-no-selection');await check('Phone long-press on help text creates no text selection; game HUD uses user-select:none; reward text entry remains editable.');
    await swipe('.pet-panel');await shot('06-small-phone-help-scrolled');await close();
    await check('640x320 phone: upgrade, reward and help content scroll via real touch swipes, with the close button available after scrolling.');
    await page.locator('.hud-settings>summary').tap();await page.getByRole('button',{name:'关闭烘焙阴影',exact:true}).tap();await page.waitForFunction(()=>!window.__miningValidation.snapshot().facilities.surfaceDetails.shadowEnabled);
    await page.getByRole('button',{name:'开启烘焙阴影',exact:true}).tap();await page.locator('.hud-settings>summary').tap();
    await check('Phone settings open, toggle shadows and close by touch.');
    await page.setViewportSize({width:844,height:390});
    await page.evaluate(()=>{window.__miningValidation.teleport([0,.1,4]);window.__miningValidation.look(0,.65);});await ready();await draw();
    assert.equal(await page.locator('.guide-dig-caption').innerText(),'长按这里挖矿');
    await shot('07-touch-mining-guide');
    const findTarget=async()=>{
      const s=await snap(),v=page.viewportSize();const c=new PerspectiveCamera(55,v.width/v.height,.08,10000);c.position.fromArray(s.camera.position);c.lookAt(c.position.clone().sub(new Vector3(...s.camera.direction)));c.updateMatrixWorld();
      const candidates=[];for(let z=-1;z<=2;z++)for(let x=-2;x<=1;x++){const coord=[x,-1,z],p=new Vector3((x+.5)*2,0,(z+.5)*2).project(c);candidates.push({coord,x:(p.x+1)*v.width/2,y:(1-p.y)*v.height/2,id:4});}
      return page.evaluate(list=>list.find(p=>p.x>200&&p.x<innerWidth-240&&p.y>100&&p.y<innerHeight-90&&window.__miningValidation.cell(p.coord)>0&&window.__miningValidation.canMine(p.coord)&&document.querySelector('.scene').contains(document.elementFromPoint(p.x,p.y))),candidates);
    };
    let point=await findTarget();assert.ok(point,'touch mining point is visible');report.miningPoint=point;
    const health=await page.evaluate(c=>window.__miningValidation.health(c),point.coord),volume=(await snap()).economy.minedVolume;
    await send('touchStart',[{x:point.x,y:point.y,id:4}]);await send('touchCancel');
    assert.equal((await input()).mining,false);await draw();assert.equal(await page.evaluate(c=>window.__miningValidation.health(c),point.coord),health);
    // Opening UI at a mine may never hit the block behind the tap.
    await open('升级');await close();assert.equal((await snap()).economy.minedVolume,volume);assert.equal(await page.evaluate(c=>window.__miningValidation.health(c),point.coord),health);
    await send('touchStart',[{x:point.x,y:point.y,id:4}]);
    await page.waitForFunction(c=>window.__miningValidation.cell(c)===0,point.coord,{timeout:90000});await send('touchEnd');
    assert.equal((await input()).mining,false);assert.ok((await snap()).economy.inventory.used>0);
    assert.ok((await page.getByTestId('bag-count').innerText()).includes(String((await snap()).economy.inventory.used)));
    await shot('08-mined-by-touch');
    await page.getByRole('button',{name:'返回地表',exact:true}).tap();await ready();assert.ok((await snap()).position[2]>40);
    await check('At the real mine, cancelled touch and UI taps cause no mining. Holding a visible block collects ore and updates capacity; release stops mining; touch Return travels to surface.');
    // Visit the real egg with debug positioning; open the panel only by touch.
    await page.evaluate(()=>{window.__miningValidation.teleport([26.2,.5,20]);window.__miningValidation.look(0,.22);});await ready();await draw();
    const egg=page.getByRole('button',{name:'查看宠物蛋',exact:true});await egg.waitFor({state:'visible'});fits(await egg.boundingBox(),'egg prompt');await egg.tap();
    await page.getByRole('dialog').waitFor();assert.equal(await page.locator('.egg-probability').count(),5);await shot('09-egg-probabilities');await close();
    assert.equal((await snap()).eggLabels.labelCount,16);
    await check('Nearby egg opens by touch and shows all five pet probabilities directly. Sixteen persistent egg labels remain in the scene.');
    assert.deepEqual(report.errors,[]);
    // Final ordinary phone route, without debug mode or test-specific render submission.
    await page.goto(url+'?saveTest=phone-normal-'+Date.now(),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('.hud-navigation')&&!document.querySelector('.loading-screen'),null,{timeout:240000});
    assert.equal(await page.locator('.hud-debug-tools,.performance-hud,.validation-panel').count(),0);
    for(let i=0;i<3;i++)await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{document.querySelector('canvas').getContext('webgl2').finish();resolve();})));
    await page.getByRole('button',{name:'更多功能',exact:true}).tap();await page.getByRole('button',{name:'矿物背包',exact:true}).tap();await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByRole('button',{name:/关闭/}).first().tap();
    assert.equal(await page.locator('.hud-settings').evaluate(e=>e.open),false);
    await page.screenshot({path:path.join(dir,'10-normal-phone.png'),timeout:60000});report.screenshots.push('10-normal-phone');
    await check('Normal public phone entry has no debug panels and its feature menu works by touch.');assert.deepEqual(report.errors,[]);
  } catch(e) { report.failure=String(e);report.snapshot=await snap().catch(()=>null);await page.screenshot({path:path.join(dir,'failure.png'),timeout:30000}).catch(()=>{});throw e; }
  finally { await save();await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
