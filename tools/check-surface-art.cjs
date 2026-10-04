const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
(async()=>{
 const base=process.argv[2]||'http://127.0.0.1:4175/',label=process.argv[3]||'surface-camp';
 const report={checks:[],samples:[],errors:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{for(const [layout,viewport,touch] of [['desktop',{width:1280,height:720},false],['mobile',{width:844,height:390},true]].filter(([name])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(name))){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)report.errors.push(r.url())});
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  await page.goto(base+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const initial=await snap();assert.equal(initial.camera.obstructed,false);assert.deepEqual(initial.facilities.visuals,['surface']);
  assert.equal(await page.evaluate(()=>{let n=0;for(let x=-10;x<10;x++)for(let z=-10;z<10;z++)if(window.__miningValidation.canMine([x,-1,z]))n++;return n}),64);
  await page.screenshot({path:`artifacts/${label}-${layout}-arrival.png`});report.samples.push({layout,view:'arrival',render:initial.renderer,timings:initial.timings});
  for(const [view,feet] of [['sale',[-12,.1,17]],['workyard',[13,.1,8]],['west-trees',[-16,.1,0]],['east-trees',[16,.1,-12]]]){
   if(touch)break;
   await page.evaluate(p=>window.__miningValidation.teleport(p),feet);await ready();await page.waitForTimeout(300);
   const s=await snap();assert.ok(s.camera.position.every(Number.isFinite));assert.ok(Math.abs(s.position[1])<.05);
   await page.screenshot({path:`artifacts/${label}-${layout}-${view}.png`});report.samples.push({layout,view,render:s.renderer,timings:s.timings});
  }
  await page.evaluate(()=>window.__miningValidation.teleport('deep'));await ready();await page.evaluate(()=>window.__miningValidation.teleport('surface'));await ready();
  const back=await snap();assert.equal(back.renderer.textures,initial.renderer.textures);assert.ok(back.renderer.geometries<=initial.renderer.geometries+2);
  await page.waitForFunction(n=>window.__miningValidation.snapshot().frames>=n,back.frames+20);assert.equal((await snap()).lighting.staticShadowUpdates,back.lighting.staticShadowUpdates);
  report.checks.push(`${layout}: 64-cell entrance, clear arrival camera, camp views, scene resource release, cached shadows`);await page.close();
 }
 assert.deepEqual(report.errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2));console.log(report.checks);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
