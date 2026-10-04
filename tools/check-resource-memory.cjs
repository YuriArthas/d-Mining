const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const assetPlan=require('../docs/art/quarry-v2/assets.json');
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1';
(async()=>{
 const report={method:'Dedicated Chromium, SwiftShader, sum of process PSS sampled every 750ms; unmodified RAF',samples:[],events:[],runs:[]};
 const save=()=>fs.writeFileSync('artifacts/memory-after.json',JSON.stringify(report,null,2));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const cdp=await browser.newBrowserCDPSession();let pending=null;
 const sample=()=>{
  if(pending)return pending;
  pending=(async()=>{
   const {processInfo}=await cdp.send('SystemInfo.getProcessInfo');
   const processes=processInfo.map(p=>{
    try{const text=fs.readFileSync(`/proc/${p.id}/smaps_rollup`,'utf8');return {type:p.type,pid:p.id,pssKB:Number(text.match(/^Pss:\s+(\d+)/m)?.[1]??0)}}
    catch{return {type:p.type,pid:p.id,pssKB:0}}
   });
   report.samples.push({time:Date.now(),pssMB:processes.reduce((n,p)=>n+p.pssKB,0)/1024,processes});save();
  })().finally(()=>pending=null);
  return pending;
 };
 const timer=setInterval(()=>sample().catch(e=>report.events.push(e.message)),750);
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.setDefaultTimeout(30000);
  page.on('crash',()=>report.events.push('PAGE CRASH'));
  page.on('pageerror',e=>report.events.push(e.message));
  page.on('console',m=>{if(m.type()==='error'){report.events.push(m.text()+' '+m.location().url);save()}});
  let cancellingLoad=false;
  page.on('requestfailed',request=>{
   if(cancellingLoad&&request.failure()?.errorText==='net::ERR_ABORTED'){
    (report.cancelledRequests??=[]).push(request.url());save();return;
   }
   report.events.push(`${request.url()}: ${request.failure()?.errorText}`);save();
  });
  await page.addInitScript(()=>{window.__contextLost=false;document.addEventListener('webglcontextlost',()=>window.__contextLost=true,true)});
  for(let run=0;run<2;run++){
   console.log('Enter',run+1);await page.goto(url);
   await page.waitForFunction(()=>{
    const status=document.querySelector('.stage-label')?.textContent;
    if(status?.startsWith('初始化失败')||status?.startsWith('渲染失败'))throw new Error(status);
    const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&s.renderer.submission.submitted>3;
   },{},{timeout:240000});
   const before=await page.evaluate(()=>window.__miningValidation.snapshot());
   const shading=before.facilities.surfaceShading,memory=shading.textureMemory;
   assert.equal(shading.instances,assetPlan.instances);assert.equal(shading.assets.length,assetPlan.uniqueModels);
   assert.equal(memory.uniqueSources,assetPlan.components.reduce((sum,c)=>sum+(c.materialProfile==='solid-color'?0:c.materialProfile==='authored-color'?1:3),0));assert.equal(memory.allCompressed,true);
   assert.ok(memory.encodedMipBytes<30*1024*1024);
   const textured=assetPlan.components.filter(c=>!['solid-color','authored-color'].includes(c.materialProfile)),count=textured.length;
   const authored=assetPlan.components.filter(c=>c.materialProfile==='authored-color').length;
   const small=textured.filter(c=>/^(portal-|egg-|bank-|grid-mine-|mine-pendant)/.test(c.name)).length;
   for(const [size,count] of [[512,count-small],[256,count],[128,count+authored],[64,small]])assert.equal(memory.maps.filter(m=>m.width===size&&m.height===size&&m.levels===Math.log2(size)+1).length,count);
   assert.equal(before.startup.terrainPendingAtAttach,0);
   await page.locator('.scene').focus();await page.keyboard.down('w');
   try{await page.waitForFunction(p=>{const s=window.__miningValidation.snapshot();return Math.hypot(s.position[0]-p[0],s.position[2]-p[2])>.2},before.position)}finally{await page.keyboard.up('w')}
   await page.waitForTimeout(10000);
   const after=await page.evaluate(()=>({lost:window.__contextLost,state:window.__miningValidation.snapshot()}));
   assert.equal(after.lost,false);
   if(run===0)await page.screenshot({path:'artifacts/memory-after.png',timeout:60000});
   report.runs.push({before,after:after.state});save();
   await page.getByRole('button',{name:/^退出游戏/}).click();
   await page.waitForURL('https://w-sunjun-public.dev.clock-p.com/');
   await page.waitForTimeout(5000);await sample();
   report.runs[run].exitPssMB=report.samples.at(-1).pssMB;save();
   console.log('Passed enter/move/exit',run+1);
  }
  // Cancel a fresh load, including pending network/decode work, through the
  // same public exit control. Never wait for readiness to make Exit usable.
  await page.goto(url);
  cancellingLoad=true;
  await page.getByRole('button',{name:/^退出游戏/}).click();
  await page.waitForURL('https://w-sunjun-public.dev.clock-p.com/');
  await page.waitForTimeout(5000);await sample();report.cancelledLoadExited=true;
  assert.deepEqual(report.events,[]);
  report.peakPssMB=Math.max(...report.samples.map(s=>s.pssMB));
  const baseline=JSON.parse(fs.readFileSync('artifacts/memory-before.json','utf8'));
  report.baselinePeakPssMB=baseline.peakPssMB;
  assert.ok(report.peakPssMB<baseline.peakPssMB*.7,'Peak process memory has not fallen enough');
  report.passed=true;
 }finally{clearInterval(timer);if(pending)await pending;save();await browser.close();console.log(JSON.stringify({passed:report.passed,peakPssMB:report.peakPssMB,events:report.events}))}
})().catch(e=>{console.error(e);process.exitCode=1});
