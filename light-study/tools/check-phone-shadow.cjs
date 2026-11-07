const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const label=process.argv[2]||'before';
const dir=path.resolve(__dirname,'../artifacts/phone-shadow',label);fs.mkdirSync(dir,{recursive:true});
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?motion=paused',errors:[],states:[]};
const save=()=>fs.writeFileSync(path.join(dir,'check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
 const p=await browser.newPage({viewport:{width:390,height:655},deviceScaleFactor:1.5});p.setDefaultTimeout(180000);
 p.on('pageerror',e=>{result.errors.push(String(e));save();});p.on('console',m=>{if(['error','warning'].includes(m.type())){result.errors.push(m.text());save();}});
 await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);
 assert.equal(await p.locator('.loading.error').count(),0);console.log('Loaded',label);
 await p.evaluate(async()=>{await window.__lightStudy.orbit([4.928826833922442,11.715207829203857,9.791615523762086],[-1,1.6,-8]);});
 for(const mode of (process.argv[4]||'screen,pcss').split(','))for(const t of (process.argv[3]||'8,12,16').split(',').map(Number)){
  await p.evaluate(async({t,mode})=>{await window.__lightStudy.motionTime(t);await window.__lightStudy.dynamicShadow(mode);await window.__lightStudy.draw();},{t,mode});
  const s=await p.evaluate(()=>window.__lightStudy.snapshot());result.states.push({mode,t,snapshot:s});
  await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,`${mode}-${t}.png`)});await p.evaluate(()=>window.__lightStudy.capture(false));save();console.log(mode,t);
 }
 assert.deepEqual(result.errors,[]);result.passed=true;save();
 }finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
