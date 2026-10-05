const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out=process.env.OUT_DIR||'artifacts/terrace-light-grid-v30';await fs.mkdir(out,{recursive:true});const report={errors:[]};const save=()=>fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{
   const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(()=>{const run=()=>window.__pauseRender?setTimeout(run,30):cb(performance.now());setTimeout(run,500);});
   window.__lightPrograms=[];
   const source=WebGL2RenderingContext.prototype.shaderSource;
   WebGL2RenderingContext.prototype.shaderSource=function(shader,text){
    if(text.includes('uniform sampler2D localPointIndex'))window.__lightPrograms.push({points:Number(text.match(/uniform PointLight pointLights\[\s*(\d+)\s*\]/)?.[1]??0),spots:Number(text.match(/uniform SpotLight spotLights\[\s*(\d+)\s*\]/)?.[1]??0),boundedLoop:text.includes('slot<2'),instanced:text.includes('#define USE_INSTANCING')});
    return source.call(this,shader,text);
   };
  });
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded;});await ready();
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const cdp=await page.context().newCDPSession(page);
  const shot=async name=>{await page.evaluate(()=>{window.__pauseRender=true;});const {data}=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(`${out}/${name}.png`,Buffer.from(data,'base64'));await page.evaluate(()=>{window.__pauseRender=false;});};
  const pose=async(p,yaw,pitch)=>{await page.evaluate(({p,yaw,pitch})=>{window.__miningValidation.teleport(p);window.__miningValidation.look(yaw,pitch);},{p,yaw,pitch});await ready();const f=(await snap()).frames;await page.waitForFunction(f=>window.__miningValidation.snapshot().frames>f+1,f);};
  report.surface=await snap();assert.equal(report.surface.lighting.surfaceArea.activeLights,12);assert.equal(report.surface.lighting.surfaceArea.localPointGrid.sources,26);assert.equal(report.surface.lighting.surfaceArea.localPointGrid.maxLightsPerCell,2);assert.equal(report.surface.boundaryStitching,undefined);assert.equal(report.surface.facilities.boundaryStitching.woodFillers,0);await save();
  await pose([54.7,3.5,46],-.45,.25);report.terrace=await snap();assert.ok(Math.abs(report.terrace.position[1]-3.35)<.1);await save();if(!process.env.SKIP_SHOTS)await shot('terrace-walkway');
  await pose([38,.1,9],-Math.PI/2,-.12);report.wall=await snap();await save();if(!process.env.SKIP_SHOTS)await shot('wall-lighting');
  report.programs=await page.evaluate(()=>window.__lightPrograms);assert.ok(report.programs.length>0);assert.ok(report.programs.every(p=>p.points<=2&&p.boundedLoop));
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='day');report.day=await snap();assert.equal(report.day.lighting.surfaceArea.localPointGrid.enabled,false);
  await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='night');report.restored=await snap();assert.equal(report.restored.lighting.surfaceArea.localPointGrid.enabled,true);assert.equal(report.restored.startup.sceneAttachMs,report.surface.startup.sceneAttachMs);
  assert.deepEqual(report.errors,[]);report.passed=true;await save();console.log('continuous terrace, collision height, bounded local point shader, retained night lighting and day/night: passed');
 }catch(e){report.failure=String(e);throw e;}finally{await save();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
