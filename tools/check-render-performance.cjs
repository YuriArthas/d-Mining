// Public desktop A/B only. SwiftShader timings are diagnostic, not device FPS.
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const final=process.env.PASS==='final',out=final?'artifacts/render-performance-v17/final':'artifacts/render-performance-v17';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={environment:'software GPU / RAF throttled 400ms; timings are not hardware acceptance',errors:[],variants:[]};
 try{
  for(const [name,query] of (final?[['final','']]:[['unbatched','&batching=0&framesInFlight=1&reflectionScissor=0&textGroups=0'],['batched','']])){
   console.log('loading',name);
   const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
   page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));});
   await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1'+query);
   await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready);console.log('ready',name);
   await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   const variant={name,views:[]};report.variants.push(variant);
   for(const [view,position,yaw,pitch] of [['spawn',[0,.1,46],0,.25],['ponds',[0,.1,34],0,.32],['pond-close',[-3.5,.1,22],Math.PI/2,.55]]){
    await page.evaluate(({position,yaw,pitch})=>{window.__miningValidation.teleport(position);window.__miningValidation.look(yaw,pitch);},{position,yaw,pitch});
    await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&!s.queue&&!s.inFlight;});
    const count=await page.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);
    await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+5,count);
    await page.screenshot({path:`${out}/${name}-${view}.png`});
    const state=await page.evaluate(()=>window.__miningValidation.snapshot());variant.views.push({view,state});
    assert.equal(state.renderer.calls,state.renderer.profile.mainCalls+state.renderer.profile.reflectionCalls);
    assert.equal(state.renderer.triangles,state.renderer.profile.mainTriangles+state.renderer.profile.reflectionTriangles);
    assert.ok(state.renderer.submission.queued<=state.renderer.submission.maxInFlight);
    console.log(name,view,JSON.stringify(state.renderer));
   }
   if(name!=='unbatched'){
    const launcher=await browser.newPage();await launcher.goto('https://w-sunjun-public.dev.clock-p.com/');
    assert.equal(await launcher.locator('a[href$="games/mining-test/index.html"]').count(),1);
    assert.equal(await launcher.locator('a[href$="games/mining/index.html"]').count(),1);
    await launcher.close();
    await page.evaluate(()=>window.__miningValidation.performance({reflection:'frozen'}));
    const before=await page.evaluate(()=>window.__miningValidation.snapshot());
    await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+4,before.renderer.submission.submitted);
    const frozen=await page.evaluate(()=>window.__miningValidation.snapshot());variant.frozen=frozen;
    assert.equal(frozen.facilities.ponds.reflectionTarget.captures,before.facilities.ponds.reflectionTarget.captures);
    assert.equal(frozen.renderer.profile.reflectionCalls,0);assert.ok(frozen.renderer.calls>0);
    await page.evaluate(()=>window.__miningValidation.performance({reflection:'live',framesInFlight:1}));
    await page.waitForFunction(n=>window.__miningValidation.snapshot().facilities.ponds.reflectionTarget.captures>n,frozen.facilities.ponds.reflectionTarget.captures);
    variant.restored=await page.evaluate(()=>window.__miningValidation.snapshot());
    assert.equal(variant.restored.renderer.submission.maxInFlight,1);
   }
   await page.close();
  }
  const baseline=final?JSON.parse(await fs.readFile('artifacts/render-performance-v17/public-report.json','utf8')).variants[0]:report.variants[0];
  const optimized=report.variants.at(-1);
  for(let i=0;i<baseline.views.length;i++){
   const before=baseline.views[i].state,after=optimized.views[i].state;
   assert.equal(before.facilities.surfaceShading.instances,after.facilities.surfaceShading.instances);
   assert.ok(after.renderer.calls<before.renderer.calls*.8,'draw calls should fall materially');
  }
  assert.deepEqual(report.errors,[]);
 }finally{await fs.writeFile(`${out}/public-report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
