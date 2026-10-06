const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/camera-grade';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const quick=process.env.QUICK==='1';
 const report={errors:[],stages:{}};
 try{
  const page=await browser.newPage({viewport:quick?{width:800,height:450}:{width:960,height:540}});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('.loading-screen')&&window.__miningValidation?.snapshot().renderer.cameraGrade.frames>2,undefined,{polling:100});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  async function capture(name){
   report.stages[name]=await snap();if(!quick)await page.screenshot({path:out+'/'+name+'.png'});console.log(name);
  }
  async function toggle(styled){
   const before=(await snap()).frames;
   await page.getByRole('button',{name:styled?'切换为风格化画面':'切换为原始画面',exact:true}).click();
   await page.waitForFunction(({styled,before})=>{const s=window.__miningValidation.snapshot();return s.frames>before+2&&s.renderer.cameraGrade.enabled===styled;},{styled,before},{polling:100});
  }
  await capture('night-stylized');
  assert.equal(report.stages['night-stylized'].renderer.cameraGrade.extraSceneRenders,0);
  await toggle(false);await capture('night-original');
  assert.equal(report.stages['night-original'].renderer.cameraGrade.extraDrawCalls,0);
  await toggle(true);
  const toggled=await snap();assert.equal(toggled.renderer.programs,report.stages['night-original'].renderer.programs);
  assert.equal(toggled.renderer.cameraGrade.allocations,1);
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='day',undefined,{polling:100});
  await capture('day-stylized');await toggle(false);await capture('day-original');
  await toggle(true);
  await page.setViewportSize({width:900,height:500});
  await page.waitForFunction(()=>{const g=window.__miningValidation.snapshot().renderer.cameraGrade;return g.width===900&&g.height===500;},undefined,{polling:100});
  report.resized=await snap();assert.equal(report.resized.renderer.cameraGrade.estimatedColorBytes,900*500*4);
  await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();
  await page.evaluate(()=>window.__miningValidation.teleport('deep'));
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.position[1]<-3500;},undefined,{polling:100});
  await capture('deep-stylized');
  assert.deepEqual(report.errors,[]);
  await page.getByRole('button',{name:'退出游戏，返回游戏列表',exact:true}).click();await page.waitForURL('https://w-sunjun-public.dev.clock-p.com/');
  report.passed=true;console.log('public camera grading, comparison, resize, travel and exit passed');
 }finally{await fs.writeFile(out+(quick?'/report-quick.json':'/report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
