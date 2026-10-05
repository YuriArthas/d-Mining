const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/shadow-filter-v22';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[],views:[],environment:'public desktop software GPU; not mobile FPS evidence'};
 try{
  for(const wide of [false,true]){
   const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
   page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   await page.addInitScript(()=>{
    const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));
    window.__shadowSources=[];const original=WebGL2RenderingContext.prototype.shaderSource;
    WebGL2RenderingContext.prototype.shaderSource=function(shader,source){
     if(source.includes('float getShadow( sampler2DShadow')){
      const start=source.indexOf('float getShadow( sampler2DShadow'),end=source.indexOf('return mix( 1.0, shadow, shadowIntensity )',start);
      window.__shadowSources.push((source.slice(start,end).match(/texture\(shadowMap,/g)||[]).length);
     }
     return original.call(this,shader,source);
    };
   });
   await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1'+(wide?'&shadowFilter=wide':''));
   await page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded;});
   await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   await page.evaluate(()=>{window.__miningValidation.teleport([0,.1,34]);window.__miningValidation.look(0,.32);});
   await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&!s.queue&&!s.inFlight;});
   const before=await page.evaluate(()=>window.__miningValidation.snapshot().frames);
   await page.waitForFunction(n=>window.__miningValidation.snapshot().frames>n+1,before);
   const state=await page.evaluate(()=>window.__miningValidation.snapshot()),sources=await page.evaluate(()=>window.__shadowSources);
   assert.equal(state.lighting.shadowFilter,wide?'stable-pcf5-v1':'hardware-pcf1-v2');
   assert.equal(state.lighting.shadowEnabled,true);assert.equal(state.lighting.surfaceArea.activeShadowLights,1);
   assert.ok(sources.includes(wide?5:1));assert.ok(sources.every(n=>n===(wide?5:1)));
   if(wide){assert.deepEqual(state.renderer.bufferSize,report.views[0].state.renderer.bufferSize);assert.equal(state.renderer.triangles,report.views[0].state.renderer.triangles);}
   report.views.push({wide,state,sources});
   await page.screenshot({path:`${out}/${wide?'wide':'compact'}.png`});console.log(wide?'wide passed':'compact passed');
   await fs.writeFile(`${out}/public-report.json`,JSON.stringify(report,null,2));await page.close();
  }
  assert.deepEqual(report.errors,[]);
 }finally{await fs.writeFile(`${out}/public-report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
