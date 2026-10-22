// Public desktop rendering check using an isolated, pre-excavated staircase save.
// This tests depth lighting and real physics; it does not measure mining progression.
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const {SparseWorld}=require('../src/game/terrain/SparseWorld.ts');
const {surfaceLightStrengthAtFeet}=require('../src/game/world/SurfaceLightFade.ts');
(async()=>{
 const dir=require('node:path').resolve(__dirname,'../artifacts/surface-light-fade');await fs.mkdir(dir,{recursive:true});
 const url='https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html',id='light-fade-'+Date.now();
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(90000);
 const report={url,fixture:'isolated excavated staircase and 100m shaft, manual debug day/night; teleported real grounded samples, no player saves modified',checks:[],samples:[],errors:[]};
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 const ready=async()=>{await page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return document.querySelector('.loading-error:not([hidden])')||s?.ready&&!s.travelling&&s.grounded&&!document.querySelector('.loading-screen');},null,{timeout:180000,polling:500});if(await page.locator('.loading-error:visible').count())throw Error('Public page failed to load: '+report.errors.join('; '));};
 const frames=async()=>{const n=(await snap()).renderer.submission.submitted;await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+2,n,{polling:500});};
 const go=async address=>{console.log('Opening',address);await page.goto(address,{waitUntil:'domcontentloaded'});await page.bringToFront();await page.evaluate(()=>{setInterval(()=>{if(window.__miningValidation)document.querySelector('canvas')?.getContext('webgl2')?.flush();},100);});await ready();await page.evaluate(()=>window.__miningValidation.performance({submission:'fenced',framesInFlight:1}));console.log('Ready');};
 const check=t=>{report.checks.push(t);console.log(t);};
 // From the entrance (positive z) toward the back, carve steps to 16 blocks.
 const steps=[16,15,14,11,8,5,3,2];
 try{
  await go(url+'?debug=1&submission=fenced&saveTest='+id);
  await page.getByRole('button',{name:'跳过引导',exact:true}).click();
  const world=new SparseWorld(),cells=[];
  for(let z=-4;z<4;z++)for(let x=-4;x<4;x++)for(let y=-1;y>=-steps[z+4];y--)if(world.cell([x,y,z]))cells.push([x,y,z]);
  for(let x=-3;x<=-1;x++)for(let z=-2;z<=0;z++)for(let y=-1;y>=-50;y--)if(world.cell([x,y,z]))cells.push([x,y,z]);
  const uniqueCells=[...new Map(cells.map(cell=>[cell.join(','),cell])).values()];
  assert.equal(world.remove(uniqueCells).length,uniqueCells.length);
  const regions=world.captureChanges().regions.map(r=>({...r,removed:r.removed===null?null:Array.from(r.removed)}));
  await page.evaluate(async({id,regions})=>{
   const progress=structuredClone(window.__miningSave.progress());const store=await window.__miningSave.openTestStore(id);
   const data=regions.map(r=>({...r,removed:r.removed===null?null:new Uint16Array(r.removed)}));
   await store.commit({expectedRevision:null,head:{formatVersion:1,revision:1,savedAt:Date.now(),regionCount:data.length,world:{generationVersion:9,seed:0,regionEncoding:1}},progress,regions:data});store.close();
  },{id,regions});
  await go(url+'?debug=1&submission=fenced&saveTest=store-'+id);
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();
  await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();await frames();
  const resident=(await snap()).facilities.visuals;
  function fixedUnderground(s) {
   assert.equal(s.lighting.keyLight.intensity,2.5);
   assert.equal(s.lighting.cameraDaylightBlend,0);
   assert.equal(s.lighting.surfaceReflections,false);
   assert.equal(s.startup.sky.environmentLightingStrength,0);
   assert.equal(s.startup.sky.environmentLightingActive,false);
   assert.equal(s.startup.sky.environmentLightingIntensity,0);
   return {key:s.lighting.keyLight,ambient:s.lighting.ambient,camera:s.lighting.cameraDaylightBlend};
  }
  async function sample(blocks,label,screenshot=true){
   const z=steps.indexOf(blocks)-4;
   await page.evaluate(({y,z})=>{window.__miningValidation.teleport([1,y+.1,z*2+1]);window.__miningValidation.look(Math.PI/2,.18);},{y:-blocks*2,z});
   await ready();await frames();const s=await snap(),r=s.lighting.surfaceArea,expected=surfaceLightStrengthAtFeet(s.position[1]);
   assert.ok(Math.abs(s.position[1]+blocks*2)<.08,JSON.stringify(s.position));
   assert.ok(Math.abs(r.strength-expected)<.0001,JSON.stringify({strength:r.strength,expected}));
   assert.equal(s.lighting.shadowEnabled,false);assert.equal(s.lighting.sunCastsShadow,false);assert.equal(r.activeShadowLights,0);
   assert.deepEqual(s.facilities.visuals,resident);
   if(blocks>=15){assert.equal(r.activeLights,0);fixedUnderground(s);}
   const night=r.time==='night';assert.ok(Math.abs(r.intensity-850*(night?expected:0))<.01);
   assert.ok(Math.abs(r.localPointGrid.strength-(night?expected:0))<.0001);
   assert.equal(r.activeLights,night&&expected>0?12:0);
   report.samples.push({label,blocks,position:s.position,lighting:s.lighting,baked:s.facilities.surfaceDetails.bakedShadows});
   if(screenshot)await page.screenshot({path:dir+'/'+label+'.png',timeout:90000});
   console.log(label,JSON.stringify({feet:s.position,strength:r.strength,activeLights:r.activeLights}));
  }
  for(const blocks of [2,3,8,14,15,16])await sample(blocks,'night-'+blocks);
  check('Public night render: continuous depth coefficient at 2, 3, 8, 14, 15 and 16 blocks; supplemental lights removed below 30m');
  await sample(3,'ascent-3',false);await sample(2,'ascent-2',false);
  check('Ascent restores lighting; all ordinary scenery remains resident');
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();await sample(8,'day-8');
  await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();await sample(8,'night-restored-8',false);
  await sample(16,'off-16',false);
  const fixedNight=fixedUnderground(await snap());
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();await frames();
  assert.deepEqual(fixedUnderground(await snap()),fixedNight);await sample(15,'day-fixed-15');
  await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();await frames();
  assert.equal((await snap()).lighting.surfaceArea.activeLights,0);
  check('Day/night changes preserve fractional strength and never reactivate the rig below the fade endpoint; real-time shadows stay off');
  await page.evaluate(()=>{window.__miningValidation.teleport([-3,-99.9,-1]);window.__miningValidation.look(0,.18);});
  await ready();await frames();const deepNight=await snap();
  assert.ok(Math.abs(deepNight.position[1]+100)<.08);
  const deepShape=fixedUnderground(deepNight);assert.deepEqual(deepShape,fixedNight);assert.deepEqual(deepNight.facilities.visuals,resident);
  report.samples.push({label:'night-100m',position:deepNight.position,lighting:deepNight.lighting});
  await page.screenshot({path:dir+'/night-100m.png',timeout:90000});
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();await frames();const deepDay=await snap();
  assert.deepEqual(fixedUnderground(deepDay),deepShape);assert.deepEqual(deepDay.facilities.visuals,resident);
  report.samples.push({label:'day-100m',position:deepDay.position,lighting:deepDay.lighting});
  await page.screenshot({path:dir+'/day-100m.png',timeout:90000});
  check('Real 30/32/100m grounded samples retain fixed underground key/ambient/grade across day and night, with no surface image-based light contribution');
  assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=String(e);report.snapshot=await snap().catch(()=>null);await page.screenshot({path:dir+'/failure.png',timeout:30000}).catch(()=>{});throw e;}
 finally{await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
