const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {digCells}=require('./combat-browser.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'ores-public':'ores-local';
 const b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1120,height:630}}),errors=[],samples=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 const snap=()=>p.evaluate(()=>window.__miningValidation.snapshot());
 const ready=()=>p.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&!s.queue&&!s.inFlight&&!s.pendingEdit&&s.grounded},null,{timeout:30000});
 try{
  await p.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1&samples=1');await ready();
  await p.locator('.ore-samples summary').click();
  const kinds=['uniform','bands','checker'],names=['整片','条带','交错'],expected=[2,12,512];
  for(let i=0;i<3;i++){
   await p.getByRole('button',{name:new RegExp('^'+names[i]+' R')}).click();await ready();
   await p.waitForFunction(({i,n})=>{const s=window.__miningValidation.snapshot();return s.samples[i].renderTriangles===n&&s.samples[i].collisionTriangles===8},{i,n:expected[i]});
   const s=await snap();assert.equal(s.cellBytes,0);assert.equal(s.error,null);assert.equal(s.terrainVisuals.atlases,1);assert.equal(s.terrainVisuals.materials,1);assert.equal(s.terrainVisuals.atlasBytes,28672);
   samples.push({phase:kinds[i],...s});
   await p.locator('.ore-samples summary').click();await p.screenshot({path:`artifacts/${label}-${kinds[i]}.png`});
   await p.locator('.ore-samples summary').click();await p.getByRole('button',{name:'网格线关',exact:true}).click();
   await p.waitForTimeout(100);await p.locator('.ore-samples summary').click();await p.screenshot({path:`artifacts/${label}-${kinds[i]}-wire.png`});
   await p.locator('.ore-samples summary').click();await p.getByRole('button',{name:'网格线开',exact:true}).click();
  }
  // Cross both independent meshing grids while excavating unlike neighbors.
  await p.evaluate(()=>window.__miningValidation.teleport('bands'));await ready();
  const cells=[[7,-1,-25],[8,-1,-25],[15,-1,-25],[16,-1,-25],[7,-2,-25]];
  const before=await p.evaluate(cells=>cells.map(c=>window.__miningValidation.cell(c)),cells);assert.ok(new Set(before).size>=3);
  await digCells(p,cells);await ready();
  for(const c of cells)assert.equal(await p.evaluate(c=>window.__miningValidation.cell(c),c),0);
  samples.push({phase:'dug-seams',...await snap()});await p.locator('.ore-samples summary').click();await p.screenshot({path:`artifacts/${label}-dug.png`});
  await p.evaluate(()=>window.__miningValidation.teleport('deep'));await ready();samples.push({phase:'deep',...await snap()});
  await p.evaluate(()=>window.__miningValidation.teleport('bands'));await ready();
  assert.deepEqual(await p.evaluate(cells=>cells.map(c=>window.__miningValidation.cell(c)),cells),cells.map(()=>0));
  assert.equal((await snap()).terrainVisuals.atlases,1);assert.deepEqual(errors,[]);
  await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({samples,errors,notes:'Identical occupancy; render size 16 and collision size 8. Software WebGL, not phone performance acceptance.'},null,2));
  console.log(JSON.stringify({samples:samples.map(s=>({phase:s.phase,samples:s.samples,triangles:s.triangles,collisionTriangles:s.collisionTriangles,render:s.renderer,terrainVisuals:s.terrainVisuals,textures:s.renderer.textures,timings:s.timings})),errors}));
 }catch(e){console.error(JSON.stringify({snapshot:await snap().catch(()=>null),errors}));await p.screenshot({path:`artifacts/${label}-failure.png`});throw e;}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
