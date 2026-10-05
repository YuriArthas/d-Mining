const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/wall-torches-v28';await fs.mkdir(out,{recursive:true});const report={errors:[]};
 const save=()=>fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(()=>{const run=()=>window.__pauseRender?setTimeout(run,30):cb(performance.now());setTimeout(run,500);});});
 await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
 await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready);
 await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
 await page.evaluate(()=>{window.__miningValidation.teleport([38,.1,9]);window.__miningValidation.look(-Math.PI/2,-.18);});
 await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&Math.abs(s.position[0]-38)<.1;});
 const cdp=await page.context().newCDPSession(page);
 const shot=async name=>{await page.evaluate(()=>{window.__pauseRender=true;});const {data}=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(`${out}/${name}.png`,Buffer.from(data,'base64'));await page.evaluate(()=>{window.__pauseRender=false;});};
 const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 const frames=async()=>{const f=(await snap()).frames;await page.waitForFunction(f=>window.__miningValidation.snapshot().frames>f+1,f);};
 await frames();report.night=await snap();
 const n=report.night;assert.equal(n.facilities.surfaceDetails.wallTorches.count,22);assert.equal(n.facilities.surfaceDetails.wallTorches.flamesVisible,true);
 assert.ok(n.lighting.surfaceArea.wallLights.every(l=>l.type==='PointLight'&&l.intensity===14&&l.distance===6&&!l.castsShadow));assert.equal(n.lighting.shadowEnabled,false);assert.deepEqual(n.facilities.surfaceDetails.wallTorches.perWall,{front:5,back:5,left:6,right:6});assert.equal(n.lighting.surfaceArea.streetLights.length,6);assert.ok(n.lighting.surfaceArea.wallLights.every(l=>Math.abs(l.position[1]-9.45)<.001));await save();
 if(!process.env.SKIP_WALL_SHOT)await shot('east-night');
 await page.evaluate(()=>{window.__miningValidation.teleport('surface');window.__miningValidation.look(0,.22);});await page.waitForFunction(()=>window.__miningValidation.snapshot().ready);await frames();
 report.courtyard=await snap();await save();await shot('courtyard-night');
 await page.getByRole('button',{name:'切换到白天',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='day');await frames();report.day=await snap();
 assert.equal(report.day.facilities.surfaceDetails.wallTorches.flamesVisible,false);assert.ok(report.day.lighting.surfaceArea.wallLights.every(l=>!l.visible&&l.intensity===0));await save();
 
 await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='night');
 assert.equal((await snap()).startup.sceneAttachMs,n.startup.sceneAttachMs);assert.deepEqual(report.errors,[]);report.passed=true;await save();console.log('22 third-tier wall torches, 6 street lights, day/night without reload: passed');
 }catch(e){report.failure=String(e);throw e;}finally{await save();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
