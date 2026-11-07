const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../artifacts/dynamic-optimization');
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?motion=paused',errors:[],states:[]};
const save=()=>fs.writeFileSync(path.join(dir,'screen-check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
 const p=await browser.newPage({viewport:{width:960,height:640}});p.setDefaultTimeout(180000);
 p.on('pageerror',e=>{result.errors.push(String(e));save();});p.on('console',m=>{if(['error','warning'].includes(m.type())){result.errors.push(m.text());save();}});
 await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
 assert.equal(await p.locator('.loading.error').count(),0,await p.locator('#status').innerText());console.log('Screen visibility loaded');
 for(const t of [0,8,16])for(const mode of ['screen','pcss']){
  await p.evaluate(async({t,mode})=>{await window.__lightStudy.motionTime(t);await window.__lightStudy.dynamicShadow(mode);await window.__lightStudy.draw();},{t,mode});
  const s=await p.evaluate(()=>window.__lightStudy.snapshot());result.states.push({mode,t,light:s.movingLantern,warmup:s.warmup,sample:s.samples.at(-1),screen:s.lighting.dynamicShadow});
  await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,`${mode}-${t}.png`)});await p.evaluate(()=>window.__lightStudy.capture(false));save();console.log(mode,t);
 }
 assert.deepEqual(result.errors,[]);result.passed=true;save();
 }finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
