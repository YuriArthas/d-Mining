const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const label=process.argv[2]??'before';
(async()=>{
 const report={events:[],samples:[]};const save=()=>fs.writeFileSync(`artifacts/startup-${label}.json`,JSON.stringify(report,null,2));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('console',m=>{if(['error','warning'].includes(m.type())){report.events.push(m.text());save();console.log(m.text().slice(0,500))}});page.on('pageerror',e=>{report.events.push(e.message);save()});
  await page.addInitScript(()=>{window.__contextLost=false;document.addEventListener('webglcontextlost',()=>{window.__contextLost=true;console.error('WebGL context lost during startup')},true)});
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  for(let i=0;i<35;i++){
   const s=await page.evaluate(()=>({time:performance.now(),status:document.querySelector('.stage-label')?.textContent,lost:window.__contextLost,state:window.__miningValidation?.snapshot()}));report.samples.push(s);save();console.log(JSON.stringify({time:Math.round(s.time),status:s.status,lost:s.lost,frames:s.state?.frames,queue:s.state?.queue,physicsQueue:s.state?.physicsQueue,ready:s.state?.ready,grounded:s.state?.grounded}));
   if(s.state?.ready&&s.state?.grounded)break;
   await page.waitForTimeout(2000);
  }
  const last=report.samples.at(-1);assert.ok(last.state?.ready&&last.state?.grounded,'Startup did not become playable');assert.equal(last.lost,false);
  if(label==='after'){
   assert.equal(last.state.startup.terrainPendingAtAttach,0);
   assert.ok(last.state.renderer.submission.submitted>0);
   assert.ok(!report.events.some(e=>/context lost|GPU 绘制同步失败|无法创建 GPU/.test(e)));
   assert.ok(last.state.startup.terrainReadyMs<=last.state.startup.sceneAttachMs);
   assert.ok(!report.samples.some(s=>s.status==='正在准备附近地形'));
   const before=last.state.position;
   await page.locator('.scene').focus();await page.keyboard.down('w');
   try{await page.waitForFunction(p=>{const s=window.__miningValidation.snapshot();return Math.hypot(s.position[0]-p[0],s.position[2]-p[2])>.15},before,{timeout:20000})}finally{await page.keyboard.up('w')}
   await page.waitForTimeout(500);
   const after=await page.evaluate(()=>window.__miningValidation.snapshot());
   report.movement={before,after:after.position};assert.ok(Math.hypot(after.position[0]-before[0],after.position[2]-before[2])>.05,'Player is still blocked after startup');save();
   await page.getByRole('button',{name:/^退出游戏/}).click();await page.waitForURL('https://w-sunjun-public.dev.clock-p.com/');report.exited=true;save();
  }
 }finally{save();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
