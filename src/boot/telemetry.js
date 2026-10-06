/* Injected inline before the game module. No React, Three.js, storage or server dependency. */
(function () {
  'use strict';
  var config = window.__MINING_LOG_CONFIG__ || {};
  var endpoint = config.enabled === false ? '' : (config.endpoint !== undefined ? config.endpoint :
    (/^\/games\/mining-test\//.test(location.pathname) ? 'https://mining-log-sunjun-public.dev.clock-p.com/ingest' : ''));
  var bytes = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (var i=0;i<bytes.length;i++) bytes[i]=Math.floor(Math.random()*256);
  var id = Array.from(bytes,function(b){return b.toString(16).padStart(2,'0');}).join('');
  var started = Date.now(), seq = 0, queue = [], sending = false, failures = 0, retryAt = 0, dropped = 0;
  var phase = '入口脚本', phaseKey = '', phaseSince = started, bootDone = false, failed = false;
  var lastHeartbeat = 0, inFlight = [];
  function summarize(value) {
    if(value instanceof Error) return {name:value.name,message:value.message,stack:String(value.stack||'').slice(0,2200)};
    if(typeof value==='string')return value.slice(0,2400);
    try{return JSON.stringify(value).slice(0,2400);}catch(_){return String(value).slice(0,2400);}
  }
  function write(type,data) {
    if(!endpoint)return;
    if(queue.length>=120){queue.shift();dropped++;}
    // Serialize immediately: later object mutations cannot alter an earlier event.
    var event={seq:++seq,time:new Date().toISOString(),elapsedMs:Date.now()-started,type:String(type).slice(0,80),data:summarize(data)};
    if(JSON.stringify(event).length>4500)event.data=JSON.stringify(event.data).slice(0,600);
    queue.push(event);
  }
  function payload(events) {
    return JSON.stringify({version:1,sessionId:id,page:location.origin+location.pathname,
      agent:navigator.userAgent,build:document.documentElement.getAttribute('data-mining-build')||'dev',dropped:dropped,events:events});
  }
  function flush(beacon) {
    if(!endpoint)return;
    if(beacon&&navigator.sendBeacon){
      // At-least-once delivery: a closing page may repeat an in-flight batch.
      var closing=boundedBatch(inFlight.concat(queue));
      if(closing.length)navigator.sendBeacon(endpoint,new Blob([payload(closing)],{type:'text/plain;charset=UTF-8'}));
      return;
    }
    if(sending||!queue.length||Date.now()<retryAt)return;
    sending=true;inFlight=queue.splice(0,boundedBatch(queue).length);
    var batch=inFlight,controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},5000);
    fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:payload(batch),signal:controller.signal})
      .then(function(r){if(!r.ok)throw Error('log HTTP '+r.status);failures=0;retryAt=0;})
      .catch(function(){failures++;retryAt=Date.now()+Math.min(30000,1000*Math.pow(2,Math.min(5,failures)));queue=batch.concat(queue);if(queue.length>120){dropped+=queue.length-120;queue=queue.slice(-120);}})
      .finally(function(){clearTimeout(timeout);sending=false;inFlight=[];});
  }
  function boundedBatch(events) {
    var batch=events.slice(0,12);
    // UTF-8 bytes, not JS string length: CJK stacks can be several bytes per character.
    while(batch.length>1&&new Blob([payload(batch)]).size>48000)batch.pop();
    return batch;
  }
  function show() {
    var label=document.getElementById('boot-status');if(!label)return;
    var seconds=Math.floor((Date.now()-started)/1000);
    label.textContent=failed?'暂时没能进入矿场':seconds>=30?'矿场还在准备中，请稍候':'正在进入矿场…';
    var detail=document.getElementById('boot-detail');if(detail){detail.hidden=!failed;detail.textContent=failed?'加载遇到了一点问题，请重新尝试。':'';}
    var busy=document.getElementById('boot-busy');if(busy)busy.hidden=failed;
    var retry=document.getElementById('boot-retry');if(retry)retry.hidden=!failed&&seconds<30;
  }
  function fail(error,type) {
    failed=true;write(type||'boot.failed',error);show();flush(false);
  }
  function setPhase(name,data) {
    if(name!==phase){phaseSince=Date.now();phase=name;}
    var key=name+':'+String(data&&data.bucket!==undefined?data.bucket:'');
    if(key!==phaseKey){phaseKey=key;write('loading.phase',{phase:name,detail:data});}
    show();
  }
  function done(){if(bootDone)return;bootDone=true;write('game.ready',{durationMs:Date.now()-started});flush(false);}
  function onError(e){
    if(e.target&&e.target!==window){
      var url=e.target.src||e.target.href||'';
      write('resource.error',{tag:e.target.tagName,url:String(url).split('?')[0]});
      if(!bootDone&&e.target.tagName==='SCRIPT')fail('启动脚本下载失败，请重试。','boot.script-failed');
    }else{write('window.error',{message:e.message,filename:e.filename,line:e.lineno,column:e.colno,stack:e.error&&e.error.stack});if(document.getElementById('boot-status'))fail(e.error||e.message);}
  }
  window.addEventListener('error',onError,true);
  window.addEventListener('unhandledrejection',function(e){write('promise.rejection',e.reason);if(document.getElementById('boot-status'))fail(e.reason);});
  ['error','warn'].forEach(function(level){var original=console[level];console[level]=function(){write('console.'+level,Array.prototype.slice.call(arguments,0,3).map(summarize));return original.apply(console,arguments);};});
  window.addEventListener('pagehide',function(){write('page.hide',{phase:phase});flush(true);});
  document.addEventListener('visibilitychange',function(){write('page.visibility',document.visibilityState);if(document.visibilityState==='hidden')flush(true);});
  document.addEventListener('DOMContentLoaded',function(){
    write('document.ready');show();
    var retry=document.getElementById('boot-retry');if(retry)retry.onclick=function(){write('boot.retry');flush(true);var url=new URL(location.href);url.searchParams.set('bootRetry',String(Date.now()));location.replace(url.href);};
  });
  if(window.PerformanceObserver){try{
    var observer=new PerformanceObserver(function(list){list.getEntries().forEach(function(e){
      if(/\.(js|css)(\?|$)/.test(e.name)&&e.name.indexOf('mining-log-')<0)write('resource.loaded',{url:e.name.split('?')[0],durationMs:Math.round(e.duration),transferSize:e.transferSize,decodedBodySize:e.decodedBodySize});
    });});observer.observe({type:'resource',buffered:true});
  }catch(_){}}
  setInterval(function(){
    show();
    if(endpoint&&document.visibilityState!=='hidden'&&Date.now()-lastHeartbeat>(bootDone?30000:10000)){
      lastHeartbeat=Date.now();write('heartbeat',{phase:phase,phaseMs:Date.now()-phaseSince,ready:bootDone,failed:failed,document:document.readyState,queue:queue.length,dropped:dropped});
    }
    flush(false);
  },2000);
  window.__MINING_LOG__={sessionId:id,write:write,flush:flush,phase:setPhase,fail:fail,ready:done,
    diagnostics:function(){return {sessionId:id,enabled:!!endpoint,phase:phase,queued:queue.length,failures:failures,dropped:dropped};}};
  write('boot.start',{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,language:navigator.language});
  flush(false);
}());
