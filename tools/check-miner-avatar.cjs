const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const path=require('node:path');

(async()=>{
  const dir=path.resolve(__dirname,'../artifacts/miner-a');
  await fs.mkdir(dir,{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  page.setDefaultTimeout(90000);
  const report={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html',checks:[],errors:[],consoleErrors:[],failedRequests:[]};
  const start=Date.now();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
  page.on('response',r=>{if(r.status()>=400)report.failedRequests.push({url:r.url(),status:r.status()})});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const shot=name=>page.screenshot({path:path.join(dir,name+'.png'),timeout:90000});
  const ready=()=>page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000,polling:500});
  const frames=async(count=3)=>{const n=(await snap()).renderer.submission.submitted;await page.waitForFunction(({n,count})=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+count,{n,count},{polling:100})};
  const check=name=>{report.checks.push(name);console.log(name)};
  try{
    console.log('Opening public Mining test');
    await page.goto(report.url+'?debug=1&submission=fenced&saveTest=miner-a-'+Date.now(),{waitUntil:'domcontentloaded'});
    await page.bringToFront();
    console.log('Waiting for public game assets and shaders');
    await ready();
    await page.evaluate(()=>{window.__miningValidation.performance({submission:'fenced',framesInFlight:1});const gl=document.querySelector('canvas').getContext('webgl2');setInterval(()=>gl.flush(),100)});
    await frames();
    report.videoStartSeconds=(Date.now()-start)/1000;
    let s=await snap();
    assert.equal(s.avatar.bones,16);assert.equal(s.avatar.skinnedMeshes,1);assert.equal(s.avatar.textures,1);
    assert.equal(s.avatar.triangles,11678);assert.equal(s.avatar.clips[0].weight,1);
    report.initial=s.avatar;
    check('Public game loads the textured Miner A, 16 bones and RAB clips');
    await page.evaluate(()=>{
      const stream=document.querySelector('canvas').captureStream(15);
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1800000});
      const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      window.__minerRecording={recorder,stream,chunks};recorder.start();
    });
    // 保持人物朝向，转动正常游戏相机观察正面。
    await page.evaluate(()=>window.__miningValidation.look(Math.PI,.12));
    await frames(3);await shot('01-idle-front');
    const idle0=(await snap()).avatar;
    await frames(4);
    const idle1=(await snap()).avatar;
    assert.notDeepEqual(idle0.joints.Head,idle1.joints.Head);
    check('Idle advances bone poses while the player stands still');
    await page.evaluate(()=>window.__miningValidation.look(0,.22));
    await frames();
    const before=(await snap()).position;
    await page.keyboard.down('d');
    await page.waitForFunction(()=>window.__miningValidation.snapshot().avatar.clips.find(c=>c.name==='Run').weight>.75,null,{timeout:15000,polling:100});
    await shot('02-running');
    report.moving=(await snap()).avatar;
    await page.keyboard.up('d');
    const after=(await snap()).position;
    assert.ok(Math.hypot(after[0]-before[0],after[2]-before[2])>.5);
    check('Actual keyboard movement translates the player and blends to Run');
    await page.waitForFunction(()=>window.__miningValidation.snapshot().avatar.clips.find(c=>c.name==='Idle').weight>.97,null,{polling:100});
    await shot('03-stopped');
    check('Releasing movement blends back to Idle');
    await page.keyboard.press('Space');
    await page.waitForFunction(()=>!window.__miningValidation.snapshot().avatar.grounded,null,{timeout:10000,polling:50});
    await shot('04-jump');
    await page.waitForFunction(()=>window.__miningValidation.snapshot().avatar.grounded,null,{polling:100});
    check('Jump and landing retain the original game physics');
    const recorded=await page.evaluate(()=>new Promise(resolve=>{
      const {recorder,stream,chunks}=window.__minerRecording;
      recorder.onstop=async()=>{const buffer=await new Blob(chunks,{type:'video/webm'}).arrayBuffer();stream.getTracks().forEach(t=>t.stop());resolve(Array.from(new Uint8Array(buffer)))};
      recorder.stop();
    }));
    await fs.writeFile(path.join(dir,'gameplay.webm'),Buffer.from(recorded));
    report.video='gameplay.webm';
    const rooms=(await snap()).content.rooms;
    await page.evaluate(p=>window.__miningValidation.teleport(p),rooms[0].spawn);
    await ready();await frames(4);await shot('05-underground');
    s=await snap();assert.ok(s.position[1]<-2);assert.ok(s.avatar.speed<.1);
    check('Underground travel preserves the character and clears movement blending');
    await page.evaluate(()=>window.__miningValidation.teleport('surface'));
    await ready();await frames(4);
    s=await snap();
    report.final={position:s.position,avatar:s.avatar,ready:s.ready};
    await shot('06-returned');
    check('Return to surface remains playable');
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.failedRequests,[]);
    report.ok=true;
  }catch(error){report.failure=String(error);report.snapshot=await snap().catch(()=>null);await shot('failure').catch(()=>{});process.exitCode=1;console.error(String(error))}
  finally{
    report.videoEndSeconds=(Date.now()-start)/1000;
    await context.close();
    await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1});
