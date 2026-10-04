const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const {digCells}=require('./combat-browser.cjs');
(async()=>{
 const base=process.argv[2]||'http://127.0.0.1:4175/',label=process.argv[3]||'valley-final';
 const report={checks:[],samples:[],errors:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const [layout,viewport,touch] of [['desktop',{width:1280,height:720},false],['mobile',{width:844,height:390},true]].filter(([l])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(l))){
   const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch});page.setDefaultTimeout(120000);
   page.on('pageerror',e=>{report.errors.push(e.message);console.log('ERROR',e.message)});
   page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('GL',m.text().slice(0,2000))}});
   page.on('response',r=>{if(r.status()>=400)report.errors.push(r.url())});
   const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
   const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
   const teleport=async p=>{await page.evaluate(p=>window.__miningValidation.teleport(p),p);await ready()};
   const shot=async name=>{if(process.env.SHOTS!=='0')await page.screenshot({path:`artifacts/${label}-${layout}-${name}.png`,timeout:150000});const s=await snap();report.samples.push({layout,name,position:s.position,camera:s.camera,render:s.renderer,lighting:s.lighting});console.log(layout,name,JSON.stringify(s.renderer))};
   await page.goto(base+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});console.log(layout,'ready');
   const start=await snap();assert.equal(start.camera.obstructed,false);
   assert.equal(await page.evaluate(()=>{let n=0;for(let x=-10;x<10;x++)for(let z=-10;z<10;z++)if(window.__miningValidation.canMine([x,-1,z]))n++;return n}),64);
   await shot('arrival');
   if(!touch){
    for(const [name,p] of [['sale',[-12,.1,17]],['workyard',[13,.1,8]],['spring',[16,.1,-12]]]){await teleport(p);await shot(name)}
    await teleport([0,.1,6.8]);
    await page.mouse.move(150,500);await page.mouse.down({button:'right'});await page.mouse.move(150+Math.PI/.004,500,{steps:3});await page.mouse.up({button:'right'});
    await page.waitForFunction(()=>Math.abs(Math.abs(window.__miningValidation.snapshot().view.yaw)-Math.PI)<.03);await shot('reverse');
    await page.locator('.scene').focus();await page.keyboard.down('w');await page.waitForFunction(()=>window.__miningValidation.snapshot().position[2]>14);await page.keyboard.up('w');await ready();assert.ok(Math.abs((await snap()).position[1]-2)<.05);
    await page.keyboard.down('s');await page.waitForFunction(()=>window.__miningValidation.snapshot().position[2]<7);await page.keyboard.up('s');await ready();assert.ok((await snap()).position[1]<.05);
    await teleport('surface');const cells=[[-1,-1,2],[0,-1,2],[-1,-1,3],[0,-1,3]];await digCells(page,cells);await ready();assert.ok(await page.evaluate(c=>c.every(p=>window.__miningValidation.cell(p)===0),cells));
    await page.mouse.move(150,500);await page.mouse.down({button:'right'});await page.mouse.move(150+Math.PI/.004,500,{steps:3});await page.mouse.up({button:'right'});await shot('open-pit');
    await teleport([-12,.1,12]);assert.equal((await snap()).economy.inventory.used,0);
    report.checks.push('desktop: 64-cell entrance, clear landing camera, facilities and spring views, camera drag, walking up/down ramp, four real mined cells, automatic sale');
   }else report.checks.push('mobile: landscape arrival, 64-cell entrance, clear landing camera');
   await teleport('deep');await teleport('surface');const back=await snap();assert.equal(back.renderer.textures,start.renderer.textures);assert.ok(back.renderer.geometries<=start.renderer.geometries+2);
   report.checks.push(layout+': surface/underground resource round trip');
   await page.close();await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2));
  }
  assert.deepEqual(report.errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
