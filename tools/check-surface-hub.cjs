const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[],checks:[],samples:[]};
 const save=()=>fs.writeFile('artifacts/surface-hub/public-report.json',JSON.stringify(report,null,2));
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
  await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);let next=0;const jobs=new Map();window.requestAnimationFrame=cb=>{const id=++next,j={timer:0,frame:0};jobs.set(id,j);j.timer=setTimeout(()=>{j.frame=raf(t=>{jobs.delete(id);cb(t)})},1500);return id;};window.cancelAnimationFrame=id=>{const j=jobs.get(id);if(j){clearTimeout(j.timer);cancel(j.frame);jobs.delete(id)}};});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit},null,{polling:400});
  const teleport=async(p,yaw=0,pitch=.15)=>{await page.evaluate(({p,yaw,pitch})=>{window.__miningValidation.teleport(p);window.__miningValidation.look(yaw,pitch)},{p,yaw,pitch});await ready();};
  const shot=async name=>{const frame=(await snap()).renderer.submission.submitted;await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+2,frame,{polling:400});await page.screenshot({path:`artifacts/surface-hub/${name}.png`});report.samples.push({name,state:await snap()});await save();console.log('captured',name);};
  const walkOntoFirst=async()=>{
   await teleport([28.5,.1,-17.4],0,.35);await page.locator('.scene').focus();await page.keyboard.down('w');
   try{await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.travelling||s.economy.notice.includes('400')||s.economy.depth>390},null,{polling:400});}finally{await page.keyboard.up('w');}
  };
  await page.goto('https://w-sunjun-public.dev.clock-p.com/');assert.equal(await page.locator('a[href$="games/mining-test/index.html"]').count(),1);assert.equal(await page.locator('a[href$="games/mining/index.html"]').count(),1);
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const first=await snap();report.initial=first;assert.equal(first.facilities.surfaceHub.portals.length,9);assert.ok(first.facilities.surfaceHub.portals.every(p=>!p.unlocked));assert.equal(first.facilities.surfaceHub.petDisplayOnly,true);await save();
  await teleport([0,.1,37],.35,.22);await shot('plaza-pets');
  if(!process.env.VISUAL_ONLY){
  await walkOntoFirst();assert.equal((await snap()).economy.depth,0);assert.ok(!(await snap()).economy.destinations[0].unlocked);report.checks.push('locked pad: physical keyboard entry gives depth requirement, no transfer');await save();
  await teleport([0,-399.9,11]);assert.equal((await snap()).economy.destinations[0].unlocked,true);
  await page.getByRole('button',{name:'返回地表',exact:true}).click();await ready();
  assert.equal((await snap()).facilities.surfaceHub.portals[0].unlocked,true);
  await walkOntoFirst();await ready();assert.ok((await snap()).economy.depth>=399);report.checks.push('reaching 400m unlocks first pad; walking onto it at surface transfers to that room');await save();
  }
  await teleport('deep');assert.ok((await snap()).economy.destinations.every(p=>p.unlocked));
  await page.getByRole('button',{name:'返回地表',exact:true}).click();await ready();
  assert.ok((await snap()).facilities.surfaceHub.portals.every(p=>p.unlocked));
  await teleport([18,.1,28],-1.15,.16);await shot('portal-walk');
  if(!process.env.VISUAL_ONLY){await teleport([28.5,.1,36]);await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.depth>=3599,null,{polling:400});await ready();
  report.checks.push('all reached layers activate their own pads; last pad arrives at 3600m');}
  await page.getByRole('button',{name:'返回地表',exact:true}).click();await ready();assert.equal((await snap()).startup.sky.version,'camp-moonlit-v2');
  assert.deepEqual((await snap()).facilities.visuals,first.facilities.visuals);
  await page.getByRole('button',{name:/^退出游戏/}).click();await page.waitForURL('https://w-sunjun-public.dev.clock-p.com/');
  report.checks.push('night scene restored, ordinary scenery resident, exit to public list');assert.deepEqual(report.errors,[]);await save();
 }finally{await save();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
