const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {PerspectiveCamera,Vector3}=require('../node_modules/three');
const {digCells}=require('./combat-browser.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'cracks-public':'cracks-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),errors=[],checks=[];
 try{for(const [layout,viewport,touch] of [['desktop',{width:1120,height:630},false],['landscape',{width:844,height:390},true],['portrait',{width:390,height:844},true]]){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch});page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&!s.queue&&!s.inFlight&&!s.pendingEdit&&s.grounded});
  const hit=async cell=>{await page.waitForFunction(()=>{const t=window.__miningValidation.snapshot().combat;return t.now>=t.nextAttackAt});const r=await page.evaluate(c=>window.__miningValidation.hit(c),cell);assert.ok(['hit','breaking'].includes(r.status));await page.waitForTimeout(60);return r;};
  try{
   await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   await page.evaluate(()=>window.__miningValidation.teleport([27,.1,-47]));await ready();await page.waitForTimeout(200);
   const before=await snap(),cell=[14,-1,-25];
   const camera=new PerspectiveCamera(55,Math.max(viewport.width,viewport.height)/Math.min(viewport.width,viewport.height),.08,1000);
   camera.position.fromArray(before.camera.position);camera.lookAt(camera.position.clone().sub(new Vector3(...before.camera.direction)));camera.updateMatrixWorld();
   const projected=new Vector3(29,0,-49).project(camera),rotated=viewport.height>viewport.width,w=Math.max(viewport.width,viewport.height),h=Math.min(viewport.width,viewport.height),gx=(projected.x+1)*w/2,gy=(1-projected.y)*h/2;
   const point={x:rotated?viewport.width-gy:gx,y:rotated?gx:gy,id:1};
   const cdp=await page.context().newCDPSession(page);
   if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});else{await page.mouse.move(point.x,point.y);await page.mouse.down();}
   await page.waitForFunction(()=>window.__miningValidation.health([14,-1,-25])===340);
   if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
   assert.equal((await snap()).cracks.instances,1);for(let i=1;i<4;i++)await hit(cell);await page.screenshot({path:`artifacts/${label}-${layout}-10.png`});
   for(let i=0;i<14;i++)await hit(cell);await page.screenshot({path:`artifacts/${label}-${layout}-50.png`});
   for(let i=0;i<14;i++)await hit(cell);await page.screenshot({path:`artifacts/${label}-${layout}-90.png`});
   let s=await snap();assert.equal(await page.evaluate(c=>window.__miningValidation.health(c),cell),30);assert.equal(s.committedEdits,before.committedEdits);
   assert.equal(s.triangles,before.triangles);assert.equal(s.collisionTriangles,before.collisionTriangles);assert.equal(s.terrainVisuals.regionMeshes,before.terrainVisuals.regionMeshes);
   const updates=s.cracks.updates;await page.waitForTimeout(300);assert.equal((await snap()).cracks.updates,updates);
   // A different target has its own damage percentage; both coexist in one overlay draw.
   await hit([14,-1,-26]);s=await snap();assert.equal(s.cracks.instances,2);assert.equal(s.cracks.regions,1);await page.screenshot({path:`artifacts/${label}-${layout}-two.png`});
   await page.evaluate(()=>window.__miningValidation.teleport('deep'));await ready();assert.equal((await snap()).cracks.instances,0);
   assert.equal(await page.evaluate(c=>window.__miningValidation.health(c),cell),30);
   await page.evaluate(()=>window.__miningValidation.teleport([27,.1,-47]));await ready();await page.waitForTimeout(100);assert.equal((await snap()).cracks.instances,2);
   await digCells(page,[cell]);await ready();assert.equal((await snap()).cracks.instances,1);assert.equal((await snap()).economy.inventory.used,15);assert.equal(await page.evaluate(c=>window.__miningValidation.cell(c),cell),0);
   await page.screenshot({path:`artifacts/${label}-${layout}-removed.png`});
   checks.push(`${layout}: 10/50/90% cracks, target-independent stages, batched instances, no terrain/collision rebuild on damage, idle no uploads, unload/reload, removed cell clears`);
   await page.getByRole('button',{name:/退出游戏/}).click();await page.waitForFunction(()=>!window.__miningValidation);
  }catch(e){await page.screenshot({path:`artifacts/${label}-${layout}-failure.png`});console.error(JSON.stringify({layout,snapshot:await snap().catch(()=>null),errors}));throw e}finally{await page.close()}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
