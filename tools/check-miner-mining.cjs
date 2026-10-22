const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
(async()=>{
 const dir=path.resolve(__dirname,'../artifacts/miner-a-mining/public');await fs.mkdir(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(90000);
 const report={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html',checks:[],errors:[]};
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 const frames=async(count=2)=>{const n=(await snap()).renderer.submission.submitted;await page.waitForFunction(({n,count})=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+count,{n,count},{polling:100});};
 const check=name=>{report.checks.push(name);console.log(name);};
 try{
  const responses=['miner-a','basic-pickaxe'].map(name=>page.waitForResponse(r=>new RegExp(name+'-[^/]+\\.glb').test(r.url())));
  await page.goto(report.url+'?debug=1&submission=fenced&saveTest=mining-animation-'+Date.now(),{waitUntil:'domcontentloaded'});
  report.assets=[];
  for(const [i,response]of (await Promise.all(responses)).entries()){
   const name=['character/miner-a','tools/basic-pickaxe'][i];
   const manifest=JSON.parse(await fs.readFile(path.resolve(__dirname,'../src/game/assets/'+name+'.manifest.json'),'utf8'));
   const hash=createHash('sha256').update(await response.body()).digest('hex');assert.equal(hash,manifest.sha256);report.assets.push({name,hash,url:response.url()});
  }
  check('Public character and pickaxe match the current asset hashes');
  await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000,polling:500});
  await page.evaluate(()=>{
   window.__miningValidation.performance({submission:'fenced',framesInFlight:1});
   const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2');setInterval(()=>gl.flush(),100);
   window.__miningValidation.teleport([0,0,10]);window.__miningValidation.look(.25,.42);
   window.__miningSamples=[];setInterval(()=>{const s=window.__miningValidation.snapshot();window.__miningSamples.push({time:performance.now(),position:s.position,target:s.target,hit:s.economy.hitSerial,avatar:s.avatar});},60);
  });
  await page.waitForFunction(()=>window.__miningValidation.snapshot().ready&&window.__miningValidation.snapshot().guideMining.visible,null,{polling:250});
  if(await page.getByRole('button',{name:'切换到白天',exact:true}).count())await page.getByRole('button',{name:'切换到白天',exact:true}).click();
  await frames();
  const box=await page.locator('.guide-dig-ring').boundingBox();assert.ok(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.waitForFunction(()=>!!window.__miningValidation.snapshot().target,null,{polling:100});
  const initial=await snap();report.initial=initial.avatar;
  assert.equal(initial.avatar.pickaxe.attachedTo,'RightHand');assert.equal(initial.avatar.textures,2);
  await page.screenshot({path:dir+'/01-held-pickaxe.png'});
  await page.evaluate(()=>{
   const stream=document.querySelector('canvas').captureStream(20),chunks=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:2400000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};window.__miningRecording={stream,chunks,recorder};recorder.start();
  });
  await page.mouse.down({button:'left'});
  await page.waitForFunction(n=>window.__miningValidation.snapshot().avatar.mining.strikes>=n+3,initial.avatar.mining.strikes,{timeout:30000,polling:100});
  report.holding=await snap();
  await page.screenshot({path:dir+'/02-mining-swing.png'});
  await page.mouse.up({button:'left'});
  await page.waitForFunction(()=>!window.__miningValidation.snapshot().avatar.mining.active,null,{polling:100});
  await frames();report.released=await snap();
  assert.ok(report.released.economy.inventory.used>0);
  assert.equal(report.released.avatar.mining.strikes-initial.avatar.mining.strikes,report.released.economy.hitSerial-initial.economy.hitSerial);
  check('Actual pointer hold mines ore; each damaging hit starts one swing and release returns to Idle');
  await page.screenshot({path:dir+'/03-released.png'});
  // Move alongside the near edge while still aiming into the mine.
  await page.mouse.down({button:'left'});await page.keyboard.down('a');
  try{await page.waitForFunction(()=>{const a=window.__miningValidation.snapshot().avatar;return a.speed>1&&a.mining.active;},null,{timeout:15000,polling:50});report.moving=await snap();await page.screenshot({path:dir+'/04-moving-mining.png'});}
  finally{await page.keyboard.up('a');await page.mouse.up({button:'left'});}
  assert.ok(report.moving.avatar.clips.some(c=>c.name!=='Idle'&&c.weight>.1));check('Keyboard movement and upper-body mining play together');
  await page.waitForFunction(()=>!window.__miningValidation.snapshot().avatar.mining.active,null,{polling:100});
  await page.evaluate(()=>window.__miningValidation.look(0,-.45));
  await page.mouse.move(800,220);await page.waitForFunction(()=>window.__miningValidation.snapshot().target===null,null,{polling:100});
  const empty=await snap();await page.mouse.down({button:'left'});await frames(5);await page.mouse.up({button:'left'});
  assert.equal((await snap()).avatar.mining.strikes,empty.avatar.mining.strikes);check('Holding the mouse over empty sky does not produce fake strikes');
  const recorded=await page.evaluate(()=>new Promise(resolve=>{const {recorder,stream,chunks}=window.__miningRecording;recorder.onstop=async()=>{const data=await new Blob(chunks,{type:'video/webm'}).arrayBuffer();stream.getTracks().forEach(t=>t.stop());resolve(Array.from(new Uint8Array(data)));};recorder.stop();}));
  await fs.writeFile(dir+'/mining.webm',Buffer.from(recorded));
  const samples=await page.evaluate(()=>window.__miningSamples);await fs.writeFile(dir+'/samples.json',JSON.stringify(samples));
  assert.ok(new Set(samples.filter(s=>s.avatar.mining.active).map(s=>s.avatar.pickaxe.tip.map(n=>n.toFixed(2)).join(','))).size>=5);
  assert.deepEqual(report.errors,[]);report.ok=true;
 }catch(e){report.failure=String(e);report.snapshot=await snap().catch(()=>null);await page.screenshot({path:dir+'/failure.png',timeout:30000}).catch(()=>{});throw e;}
 finally{await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
