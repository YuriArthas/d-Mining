const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {digCells}=require('./combat-browser.cjs');
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
(async()=>{
 const base=process.argv[2]||'http://127.0.0.1:4175/',label=process.argv[3]||'lighting',report={checks:[],samples:[],errors:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)report.errors.push(r.url())});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
  const shot=async name=>{await page.screenshot({path:`artifacts/${label}-${name}.png`});const s=await snap();report.samples.push({name,renderer:s.renderer,shading:s.facilities.surfaceShading,lighting:s.lighting,terrain:s.terrainVisuals})};
  await page.goto(base+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const start=await snap();assert.equal(start.facilities.surfaceShading.version,'surface-look-v2');assert.ok(start.facilities.surfaceShading.probes>0);
  assert.equal(start.terrainVisuals.responseAtlasBytes,655360);assert.equal(start.terrainVisuals.materials,1);await shot('arrival');
  for(const [name,feet] of [['sale',[-12,.1,17]],['ore-close',[3,.1,6]],['rocks',[16,.1,-12]]]){
   await page.evaluate(p=>window.__miningValidation.teleport(p),feet);await ready();await shot(name);
  }
  await page.evaluate(()=>window.__miningValidation.teleport('surface'));await ready();
  // Exercise a real render edit through the logical terrain API. A contact decal must leave the entrance open.
  const cells=[[-1,-1,2],[0,-1,2],[-1,-1,3],[0,-1,3]];
  await digCells(page,cells);await ready();
  assert.ok(await page.evaluate(c=>c.every(p=>window.__miningValidation.cell(p)===0),cells));await shot('open-pit');
  const still=await snap();assert.equal(still.lighting.staticShadowUpdates,start.lighting.staticShadowUpdates);
  await page.waitForFunction(n=>window.__miningValidation.snapshot().frames>n,still.frames+15);
  assert.equal((await snap()).lighting.staticShadowUpdates,still.lighting.staticShadowUpdates);
  report.checks.push('surface shader compiles, material variants and atlas response render, four-cell mined opening stays open under contact shading, static shadows cached');
  assert.deepEqual(report.errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2));console.log(report.checks);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
