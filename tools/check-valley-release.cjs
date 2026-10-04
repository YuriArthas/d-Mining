const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
(async()=>{
 const base=process.argv[2]||'http://127.0.0.1:4175/',label=process.argv[3]||'valley-release',report={errors:[],samples:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{for(const [layout,viewport,touch] of [['mobile',{width:844,height:390},true],['desktop',{width:1280,height:720},false]].filter(([name])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(name))){
   const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch});page.setDefaultTimeout(120000);
   page.on('pageerror',e=>{report.errors.push(e.message);console.log('ERROR',e.message)});
   page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('GL',m.text().slice(0,1600))}});
   page.on('response',r=>{if(r.status()>=400)report.errors.push(r.url())});
   const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
   const shot=async name=>{await page.screenshot({path:`artifacts/${label}-${layout}-${name}.png`,timeout:150000});report.samples.push({layout,name,snapshot:await page.evaluate(()=>window.__miningValidation.snapshot())});console.log(layout,name)};
   await page.goto(base+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   const start=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(start.facilities.surfaceShading.version,'surface-look-v2');assert.equal(start.camera.obstructed,false);if(!process.env.SKIP_ARRIVAL)await shot('arrival');
   if(!touch){
    await page.evaluate(()=>window.__miningValidation.teleport([0,.1,6.8]));await ready();await page.mouse.move(150,500);await page.mouse.down({button:'right'});await page.mouse.move(150+Math.PI/.004,500,{steps:3});await page.mouse.up({button:'right'});await page.waitForTimeout(600);await shot('reverse');
    await page.mouse.move(150,500);await page.mouse.down({button:'right'});await page.mouse.move(150+Math.PI/.004,500,{steps:3});await page.mouse.up({button:'right'});
    await page.evaluate(()=>window.__miningValidation.teleport([12,.1,-20]));await ready();await page.mouse.move(150,500);await page.mouse.down({button:'right'});await page.mouse.move(150+Math.PI/(2*.004),437.5,{steps:3});await page.mouse.up({button:'right'});await page.waitForTimeout(600);await shot('spring');
   }
   await page.close();await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify(report,null,2));
 }assert.deepEqual(report.errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
