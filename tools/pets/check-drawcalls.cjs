const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
 page.setDefaultTimeout(60000);
 const report={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1',samples:[],errors:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console', message => { if(message.type()==='error') report.errors.push(message.text()); });
 try {
  await page.goto(report.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000});
  await page.evaluate(()=>{
   window.__miningValidation.performance({submission:'fenced',framesInFlight:1});
   const gl=document.querySelector('canvas').getContext('webgl2');
   window.__measureFlush=setInterval(()=>gl.flush(),80);
  });
  for(const pose of [
   {name:'spawn'},
   {name:'eggs',feet:[26,.45,20],yaw:-Math.PI/2,pitch:.2},
   {name:'pit',feet:[0,.1,10],yaw:0,pitch:.28},
   {name:'plaza',feet:[0,.1,10],yaw:Math.PI,pitch:.2}
  ]){
   if(pose.feet){
    await page.evaluate(p=>{window.__miningValidation.teleport(p.feet);window.__miningValidation.look(p.yaw,p.pitch)},pose);
    await page.waitForFunction(()=>window.__miningValidation.snapshot().ready&&window.__miningValidation.snapshot().grounded);
   }
   const before=await page.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);
   await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>n+2,before);
   const row=await page.evaluate(()=>{const s=window.__miningValidation.snapshot();return {position:s.position,renderer:s.renderer,eggLabels:s.eggLabels,followers:s.petFollowers,scenery:s.scenery};});
   assert.equal(row.eggLabels.draws,1); assert.equal(row.eggLabels.labelCount,18);
   row.name=pose.name;report.samples.push(row);console.log(JSON.stringify({name:pose.name,calls:row.renderer.profile.mainCalls,reflection:row.renderer.profile.reflectionCalls,triangles:row.renderer.profile.mainTriangles,total:row.renderer.calls,grade:row.renderer.cameraGrade.extraDrawCalls}));
   if(pose.name==='eggs') await page.screenshot({path:'artifacts/pets/egg-labels-batched.png'});
  }
  assert.deepEqual(report.errors,[]);
  report.passed=true;
 } finally {fs.writeFileSync('artifacts/pets/draw-counts-after-batch.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
