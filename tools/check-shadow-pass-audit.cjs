const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises');
(async()=>{
 const out='artifacts/shadow-pass-audit';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[],environment:'public desktop software GPU; API work counts only, not phone timings'};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{
   const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));
   let target=null;window.__audit=null;
   const p=WebGL2RenderingContext.prototype,bind=p.bindFramebuffer;
   p.bindFramebuffer=function(type,fbo){if(type===this.FRAMEBUFFER||type===this.DRAW_FRAMEBUFFER)target=fbo;return bind.call(this,type,fbo);};
   for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','texImage2D','texSubImage2D','compressedTexImage2D','texStorage2D','compileShader','linkProgram','getError','getParameter','readPixels','finish','flush','clientWaitSync']){
    const original=p[key];p[key]=function(...args){if(window.__audit){const name=key.startsWith('draw')?(target?'offscreenDraws':'mainDraws'):key;window.__audit[name]=(window.__audit[name]??0)+1;}return original.apply(this,args);};
   }
  });
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  await page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight;});
  let n=await page.evaluate(()=>window.__miningValidation.snapshot().frames);
  await page.waitForFunction(n=>window.__miningValidation.snapshot().frames>=n+4,n);
  report.before=await page.evaluate(()=>{window.__audit={};return window.__miningValidation.snapshot();});
  await page.waitForFunction(n=>window.__miningValidation.snapshot().frames>=n+12,report.before.frames);
  report.after=await page.evaluate(()=>window.__miningValidation.snapshot());report.calls=await page.evaluate(()=>{const r=window.__audit;window.__audit=null;return r;});
  console.log(JSON.stringify({frames:report.after.frames-report.before.frames,calls:report.calls,shadowUpdates:[report.before.lighting.staticShadowUpdates,report.after.lighting.staticShadowUpdates]},null,2));
 }finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
