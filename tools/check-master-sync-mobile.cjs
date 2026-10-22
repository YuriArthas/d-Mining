const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {PerspectiveCamera,Vector3}=require('../node_modules/three');
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html',dir=path.resolve(process.env.ARTIFACT_DIR||'artifacts/pinewind-master-sync-mobile');
(async()=>{
 await fs.mkdir(dir,{recursive:true});
 const report={url,startedAt:new Date().toISOString(),tier:'Mobile Chromium emulation / Android UA / touch / landscape 844x390 and 640x320 / SwiftShader. Not physical phone or GPU performance proof.',checks:[],errors:[]};
 const b=await chromium.launch({args:['--remote-debugging-port=9342','--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});p.setDefaultTimeout(90000);
 p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const c=await p.context().newCDPSession(p),send=(type,touchPoints=[])=>c.send('Input.dispatchTouchEvent',{type,touchPoints});
 const snap=()=>p.evaluate(()=>window.__miningValidation.snapshot());
 const save=()=>fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));
 const check=async msg=>{report.checks.push(msg);console.log('PASS',msg);await save();};
 const ready=()=>p.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:240000});
 const draw=async()=>{const n=(await snap()).renderer.submission.submitted;await p.waitForFunction(n=>{document.querySelector('canvas').getContext('webgl2').finish();return window.__miningValidation.snapshot().renderer.submission.submitted>=n+2;},n,{timeout:120000,polling:300});};
 const shot=async name=>{await draw();await p.screenshot({path:path.join(dir,name+'.png'),timeout:60000});console.log('SHOT',name);};
 const target=async()=>{
  const s=await snap(),v=p.viewportSize(),cam=new PerspectiveCamera(55,v.width/v.height,.08,10000);cam.position.fromArray(s.camera.position);cam.lookAt(cam.position.clone().sub(new Vector3(...s.camera.direction)));cam.updateMatrixWorld();
  // The previous hold can remove the floor, so aim at the current depth rather than
  // assuming the original surface still exists after real mining.
  const list=[],cx=Math.floor(s.position[0]/2),cz=Math.floor(s.position[2]/2),cy=Math.floor((s.position[1]-.1)/2);
  for(let y=cy;y>=cy-2;y--)for(let z=cz-3;z<=cz;z++)for(let x=cx-2;x<=cx+1;x++){const coord=[x,y,z],pt=new Vector3((x+.5)*2,(y+1)*2,(z+.5)*2).project(cam);list.push({coord,x:(pt.x+1)*v.width/2,y:(1-pt.y)*v.height/2,id:2});}
  const found=await p.evaluate(list=>list.find(q=>q.x>200&&q.x<innerWidth-240&&q.y>95&&q.y<innerHeight-90&&window.__miningValidation.cell(q.coord)>0&&window.__miningValidation.canMine(q.coord)&&document.querySelector('.scene').contains(document.elementFromPoint(q.x,q.y))),list);assert.ok(found,'reachable phone mining target');return {x:found.x,y:found.y,id:2};
 };
 try{
  const responses=['miner-a','basic-pickaxe'].map(name=>p.waitForResponse(r=>new RegExp(name+'-[^/]+\\.glb').test(r.url()),{timeout:180000}));
  await p.goto(url+'?debug=1&submission=fenced&framesInFlight=1&saveTest=master-sync-'+Date.now(),{waitUntil:'domcontentloaded'});await ready();
  report.assets=[];for(const [i,response] of (await Promise.all(responses)).entries()){
   const name=['character/miner-a','tools/basic-pickaxe'][i],m=JSON.parse(await fs.readFile('src/game/assets/'+name+'.manifest.json','utf8')),sha=createHash('sha256').update(await response.body()).digest('hex');assert.equal(sha,m.sha256);report.assets.push({name,sha,url:response.url()});
  }
  const a=(await snap()).avatar;assert.equal(a.pickaxe.attachedTo,'RightHand');assert.equal(a.bones,16);assert.equal(a.triangles,11678);assert.equal(a.textures,2);
  await check('Phone public build loads the exact merged character and pickaxe hashes; tool is on RightHand and model diagnostics match the source manifest.');
  for(const [width,height]of [[844,390],[640,320]]){
   await p.setViewportSize({width,height});
   for(const selector of ['.hud-status','.hud-navigation','.guide-card','.joystick','.jump-button','.hud-return']){
    const r=await p.locator(selector).boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,selector+' fits');
   }
   assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.game-shell')).userSelect),'none');
   await shot('01-phone-'+width+'x'+height);
  }
  await check('Both phone landscape sizes retain the Pinewind scene, compact HUD, thumb controls and long-press selection guard.');
  await p.setViewportSize({width:844,height:390});
  let r=await p.locator('.joystick').boundingBox(),finger={x:r.x+r.width/2+32,y:r.y+r.height/2,id:1};
  const start=await snap();await send('touchStart',[finger]);
  await p.waitForFunction(()=>{const a=window.__miningValidation.snapshot().avatar;return a.speed>1&&a.clips.some(c=>c.name!=='Idle'&&c.weight>.1);});
  report.moving=(await snap()).avatar;
  await shot('02-phone-moving-with-pickaxe');await send('touchEnd');
  await p.waitForFunction(()=>{const a=window.__miningValidation.snapshot().avatar;return a.speed<.1&&a.clips.find(c=>c.name==='Idle').weight>.99;});assert.equal(await p.evaluate(()=>window.__mining.getInput().moveX),0);
  assert.ok(Math.hypot((await snap()).position[0]-start.position[0],(await snap()).position[2]-start.position[2])>.1);
  await check('Actual phone joystick drives locomotion with the equipped tool; releasing stops movement and returns to Idle.');
  await p.evaluate(()=>{window.__miningValidation.teleport([0,.1,4]);window.__miningValidation.look(0,.65);});await ready();await draw();
  assert.equal(await p.locator('.guide-dig-caption').innerText(),'长按这里挖矿');
  await p.evaluate(()=>{window.__syncSamples=[];window.__syncTimer=setInterval(()=>{const s=window.__miningValidation.snapshot();window.__syncSamples.push({avatar:s.avatar,hit:s.economy.hitSerial,position:s.position});},60);});
  const before=await snap(),point=await target();await send('touchStart',[point]);
  await p.waitForFunction(n=>{const s=window.__miningValidation.snapshot();return s.economy.inventory.used>0&&s.avatar.mining.strikes>n&&s.avatar.mining.active;},before.avatar.mining.strikes,{timeout:90000});
  report.mining=(await snap()).avatar;await shot('03-phone-touch-mining');await send('touchEnd');
  await p.waitForFunction(()=>!window.__miningValidation.snapshot().avatar.mining.active);
  const after=await snap();assert.equal(after.avatar.mining.strikes-before.avatar.mining.strikes,after.economy.hitSerial-before.economy.hitSerial);assert.equal(await p.evaluate(()=>window.__mining.getInput().mining),false);
  const samples=await p.evaluate(()=>window.__syncSamples);assert.ok(new Set(samples.filter(s=>s.avatar.mining.active).map(s=>s.avatar.pickaxe.tip.map(v=>v.toFixed(3)).join(','))).size>=2);await fs.writeFile(path.join(dir,'swing-samples.json'),JSON.stringify(samples));
  await check('Holding a real block with a finger collects ore and animates the pickaxe; each accepted damaging hit produces one swing, and release ends it.');
  // Repeat with two fingers: slower sideways movement keeps the block in reach.
  await p.evaluate(()=>{window.__miningValidation.teleport([0,.1,4]);window.__miningValidation.look(0,.65);});await ready();await draw();
  const next=await target();r=await p.locator('.joystick').boundingBox();finger={x:r.x+r.width/2+14,y:r.y+r.height/2,id:1};
  await send('touchStart',[finger,next]);
  await p.waitForFunction(()=>{const a=window.__miningValidation.snapshot().avatar;return a.speed>.2&&a.mining.active&&a.clips.some(c=>c.name!=='Idle'&&c.weight>.1);},null,{timeout:20000});
  report.movingMining=(await snap()).avatar;await shot('04-phone-moving-and-mining');await send('touchEnd');
  await p.waitForFunction(()=>!window.__miningValidation.snapshot().avatar.mining.active);await check('Two phone fingers combine joystick locomotion and upper-body mining without replacing the movement controller.');
  await p.evaluate(()=>window.__miningValidation.look(0,-.55));await draw();const empty=(await snap()).avatar.mining.strikes;
  await send('touchStart',[{x:440,y:140,id:2}]);await p.waitForTimeout(850);await draw();await send('touchEnd');assert.equal((await snap()).avatar.mining.strikes,empty);
  const inventoryBeforeReturn=(await snap()).economy.inventory;
  await p.getByRole('button',{name:'返回地表',exact:true}).tap();await ready();assert.ok((await snap()).position[2]>40);assert.equal((await snap()).avatar.mining.active,false);assert.deepEqual((await snap()).economy.inventory,inventoryBeforeReturn);
  await check('Holding empty sky creates no fake swings; touching Return preserves inventory and leaves mining inactive on the surface.');
  await p.getByRole('button',{name:'操作帮助',exact:true}).tap();await p.getByRole('dialog').waitFor();r=await p.locator('.guide-help p').first().boundingBox();
  await send('touchStart',[{x:r.x+30,y:r.y+10,id:3}]);await p.waitForTimeout(850);await send('touchEnd');assert.equal(await p.evaluate(()=>getSelection().toString()),'');
  await p.getByRole('button',{name:'关闭操作帮助',exact:true}).tap();assert.equal(await p.locator('.hud-settings').evaluate(e=>e.open),false);
  await check('Merged build retains phone long-press protection and dialog-close click-through protection.');
  await p.evaluate(()=>clearInterval(window.__syncTimer));assert.deepEqual(report.errors,[]);report.ok=true;
 }catch(e){report.failure=String(e);report.snapshot=await snap().catch(()=>null);await p.screenshot({path:path.join(dir,'failure.png'),timeout:30000}).catch(()=>{});throw e;}
 finally{await save();await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
