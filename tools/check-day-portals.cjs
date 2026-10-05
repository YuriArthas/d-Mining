const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const {SURFACE_PORTALS}=await import('../src/game/world/SurfaceHub.ts');
 const out='artifacts/day-portals',report={checks:[],errors:[],shots:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const save=()=>fs.writeFile(`${out}/public-report.json`,JSON.stringify(report,null,2));
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
  await page.addInitScript(()=>{
   const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window);let serial=0;const jobs=new Map();
   window.requestAnimationFrame=cb=>{const id=++serial,job={timer:0,frame:0};jobs.set(id,job);job.timer=setTimeout(()=>{job.frame=raf(t=>{jobs.delete(id);cb(t)})},500);return id;};
   window.cancelAnimationFrame=id=>{const j=jobs.get(id);if(j){clearTimeout(j.timer);cancel(j.frame);jobs.delete(id)}};
   window.__shaderAudit=[];const proto=WebGL2RenderingContext.prototype,link=proto.linkProgram;
   proto.linkProgram=function(program){link.call(this,program);const ok=this.getProgramParameter(program,this.LINK_STATUS);let samplers=0;
    if(ok)for(let i=0;i<this.getProgramParameter(program,this.ACTIVE_UNIFORMS);i++){const u=this.getActiveUniform(program,i);if([0x8b5e,0x8b60,0x8b62,0x8dc1,0x8dc4].includes(u.type))samplers+=u.size;}
    window.__shaderAudit.push({ok,samplers,log:this.getProgramInfoLog(program)});
   };
  });
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
  const drawn=async()=>{const f=(await snap()).renderer.submission.submitted;await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+2,f);};
  const move=async(position,yaw=0,pitch=.15)=>{await page.evaluate(({position,yaw,pitch})=>{window.__miningValidation.teleport(position);window.__miningValidation.look(yaw,pitch)},{position,yaw,pitch});await ready();};
  const shot=async name=>{await drawn();await page.screenshot({path:`${out}/${name}.png`});report.shots.push({name,state:await snap()});await save();console.log('captured',name)};
  const toggle=async time=>{await page.getByRole('button',{name:time==='day'?'切换到白天':'切换到夜晚',exact:true}).click();await page.waitForFunction(t=>window.__miningValidation.snapshot().startup.sky.time===t,time);await drawn();};
  await page.goto('https://w-sunjun-public.dev.clock-p.com/');assert.equal(await page.locator('a[href$="games/mining-test/index.html"]').count(),1);assert.equal(await page.locator('a[href$="games/mining/index.html"]').count(),1);
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  report.initial=await snap();assert.equal(report.initial.startup.sky.time,'night');assert.equal(report.initial.lighting.surfaceArea.time,'night');await toggle('day');
  await move([4,.1,35],-.45,.06);await shot('day-camp');
  await move([-19,.1,32],Math.PI/2,.12);await shot('day-portals');
  const position=(await snap()).position,attach=report.initial.startup.sceneAttachMs;
  await toggle('night');assert.equal((await snap()).lighting.surfaceArea.time,'night');assert.equal((await snap()).startup.sky.nightVersion,'camp-moonlit-v2');await shot('night-portals');
  await toggle('day');const baseline=await snap();
  for(let i=0;i<2;i++){await toggle('night');await toggle('day');}
  const after=await snap();assert.equal(after.startup.sceneAttachMs,attach);assert.ok(after.position.every((v,i)=>Math.abs(v-position[i])<.001));assert.equal(after.renderer.textures,baseline.renderer.textures);assert.equal(after.renderer.geometries,baseline.renderer.geometries);
  report.checks.push('defaults to night; UI restores night and day; repeated toggles preserve session/position and stable GPU texture/geometry counts');
  await move([0,-399.9,11]);assert.ok((await snap()).economy.destinations[0].unlocked);await page.getByRole('button',{name:'返回地表',exact:true}).click();await ready();
  const p=SURFACE_PORTALS[0];await move([p.x+Math.sin(p.yaw)*(p.zone.radius+1),.1,p.z+Math.cos(p.yaw)*(p.zone.radius+1)],p.yaw,.2);await page.locator('.scene').focus();await page.keyboard.down('w');
  try{await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.depth>=399);}finally{await page.keyboard.up('w');}await ready();
  report.checks.push('real keyboard approach to the redesigned first station still teleports after unlocking');
  await move('deep');await toggle('night');assert.equal((await snap()).lighting.surfaceReflections,false);await page.getByRole('button',{name:'返回地表',exact:true}).click();await ready();assert.equal((await snap()).startup.sky.time,'night');assert.equal((await snap()).lighting.surfaceReflections,true);await toggle('day');
  report.checks.push('underground sky remains separate; returning to surface restores selected night, then day');
  report.programs=await page.evaluate(()=>window.__shaderAudit);assert.ok(report.programs.every(p=>p.ok));report.maxSamplers=Math.max(...report.programs.map(p=>p.samplers));assert.ok(report.maxSamplers<=14);assert.deepEqual(report.errors,[]);await save();
  await page.getByRole('button',{name:/^退出游戏/}).click();await page.waitForURL('https://w-sunjun-public.dev.clock-p.com/');report.checks.push('exit returns to public list');console.log('passed',report.checks,'maxSamplers',report.maxSamplers);
 }finally{await save();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
