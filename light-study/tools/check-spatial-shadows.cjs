const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/dynamic-optimization');
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?motion=paused',errors:[],states:[]};
const save=()=>fs.writeFileSync(path.join(dir,'spatial-check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
 const p=await browser.newPage({viewport:{width:960,height:640}});p.setDefaultTimeout(180000);
 p.on('pageerror',e=>result.errors.push(String(e)));p.on('console',m=>{if(['error','warning'].includes(m.type()))result.errors.push(m.text());});
 await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
 assert.equal(await p.locator('.loading.error').count(),0,await p.locator('#status').innerText());console.log('Spatial version loaded');
 for(const t of [0,8,16])for(const geometry of ['full','spatial']){
  await p.evaluate(async({t,geometry})=>{await window.__lightStudy.motionTime(t);await window.__lightStudy.shadowGeometry(geometry);},{t,geometry});
  const s=await p.evaluate(()=>window.__lightStudy.snapshot());result.states.push({geometry,t,light:s.movingLantern,warmup:s.warmup,screen:s.lighting.dynamicShadow,render:s.render,model:s.model});
  await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,`${geometry}-${t}.png`)});await p.evaluate(()=>window.__lightStudy.capture(false));save();console.log(geometry,t,s.lighting.dynamicShadow.lastShadowSubmission);
 }
 await p.evaluate(async()=>{await window.__lightStudy.motion('off');await window.__lightStudy.ao(false);});
 await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,'ao-off.png')});
 await p.evaluate(async()=>{await window.__lightStudy.ao(true);await window.__lightStudy.motionTime(0);await window.__lightStudy.light('day');});
 await p.screenshot({path:path.join(dir,'day.png')});
 await p.setViewportSize({width:1440,height:900});await p.evaluate(async()=>{await window.__lightStudy.light('night');await window.__lightStudy.motion('off');});
 await p.screenshot({path:path.join(dir,'off-baseline.png')});
 const full=result.states.filter(s=>s.geometry==='full'),spatial=result.states.filter(s=>s.geometry==='spatial');
 for(let i=0;i<full.length;i++)assert.ok(spatial[i].screen.lastShadowSubmission.triangles<full[i].screen.lastShadowSubmission.triangles);
 assert.deepEqual(result.errors,[]);result.passed=true;save();
 }finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
