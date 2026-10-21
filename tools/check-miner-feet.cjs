const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');

(async()=>{
  const dir=path.resolve(__dirname,'../artifacts/miner-a-feet-fix');
  await fs.mkdir(dir,{recursive:true});
  const manifest=JSON.parse(await fs.readFile(path.resolve(__dirname,'../src/game/assets/character/miner-a.manifest.json'),'utf8'));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.setDefaultTimeout(90000);
  const report={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html',expectedSha256:manifest.sha256,checks:[],errors:[]};
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const frames=async(count)=>{
    const n=(await snap()).renderer.submission.submitted;
    await page.waitForFunction(({n,count})=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+count,{n,count},{polling:100});
  };
  const check=name=>{report.checks.push(name);console.log(name)};
  try{
    const modelResponse=page.waitForResponse(r=>/miner-a-[^/]+\.glb/.test(r.url()));
    console.log('Opening published feet correction');
    await page.goto(report.url+'?debug=1&submission=fenced&saveTest=feet-'+Date.now(),{waitUntil:'domcontentloaded'});
    const response=await modelResponse;
    report.loadedModel=response.url();
    report.loadedSha256=createHash('sha256').update(await response.body()).digest('hex');
    assert.equal(report.loadedSha256,manifest.sha256);
    check('Public game loads the corrected GLB hash');
    await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000,polling:500});
    await page.evaluate(()=>{
      window.__miningValidation.performance({submission:'fenced',framesInFlight:1});
      const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2');
      setInterval(()=>gl.flush(),100);
      const stream=canvas.captureStream(15),chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1800000});
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      window.__feetRecording={stream,chunks,recorder};recorder.start();
      window.__miningValidation.look(0,.25);
    });
    await frames(4);
    const before=(await snap()).position;
    await page.keyboard.down('d');
    await page.waitForFunction(()=>window.__miningValidation.snapshot().avatar.clips.find(c=>c.name==='Run').weight>.9,null,{polling:100});
    report.running=[];
    for(let i=0;i<12;i++){await frames(1);report.running.push((await snap()).avatar)}
    await page.screenshot({path:path.join(dir,'run-corrected.png'),timeout:90000});
    await page.keyboard.up('d');
    const after=(await snap()).position;
    assert.ok(Math.hypot(after[0]-before[0],after[2]-before[2])>.5);
    assert.ok(new Set(report.running.map(s=>s.clips.find(c=>c.name==='Run').time.toFixed(3))).size>=8);
    check('Actual keyboard movement plays multiple Run phases');
    await page.waitForFunction(()=>window.__miningValidation.snapshot().avatar.clips.find(c=>c.name==='Idle').weight>.98,null,{polling:100});
    await page.evaluate(()=>window.__miningValidation.look(Math.PI,.16));
    await frames(4);
    await page.screenshot({path:path.join(dir,'idle-corrected.png'),timeout:90000});
    report.stopped=(await snap()).avatar;
    assert.ok(report.stopped.speed<.1);
    check('Releasing movement returns to Idle without residual motion');
    const recorded=await page.evaluate(()=>new Promise(resolve=>{
      const {recorder,stream,chunks}=window.__feetRecording;
      recorder.onstop=async()=>{const data=await new Blob(chunks,{type:'video/webm'}).arrayBuffer();stream.getTracks().forEach(t=>t.stop());resolve(Array.from(new Uint8Array(data)))};
      recorder.stop();
    }));
    await fs.writeFile(path.join(dir,'feet-corrected.webm'),Buffer.from(recorded));
    assert.deepEqual(report.errors,[]);
    report.ok=true;
  }catch(error){report.failure=String(error);process.exitCode=1;console.error(String(error))}
  finally{await fs.writeFile(path.join(dir,'public-report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
