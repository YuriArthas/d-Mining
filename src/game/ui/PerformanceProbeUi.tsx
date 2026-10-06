import type {RenderRate} from '../movement.ts';
import {useEffect,useRef,useState} from 'react';
import {PerformanceProbe,PROBE_STAGES,type ProbeMode,type ProbeResult} from '../presentation/PerformanceProbe.ts';
import type {PerformanceSnapshot} from '../presentation/PerformanceMeter.ts';

export function PerformanceProbeUi({stats,onMode,shadowsEnabled,renderRate,stylized}:{stylized:boolean;renderRate:RenderRate;shadowsEnabled:boolean;stats:PerformanceSnapshot|null;onMode:(mode:ProbeMode)=>void}){
 const [open,setOpen]=useState(false),[running,setRunning]=useState(false),[index,setIndex]=useState(0),[results,setResults]=useState<ProbeResult[]>([]),[notice,setNotice]=useState('');
 const probe=useRef<PerformanceProbe|null>(null);
 const stop=()=>{probe.current=null;setRunning(false);onMode('normal');};
 useEffect(()=>{
  const current=probe.current;if(!current||!stats)return;
  if(current.record(performance.now(),stats)){
   setResults([...current.results]);setIndex(current.index);onMode(current.mode);
   if(current.done){probe.current=null;setRunning(false);setNotice('已恢复正常画面。对比前后两次正常画面，检查是否存在明显温度/负载漂移。');}
  }
 },[stats,onMode]);
 useEffect(()=>{
  const hidden=()=>{if(document.hidden&&probe.current){probe.current=null;setRunning(false);onMode('normal');setNotice('切到后台，诊断已取消并恢复设置，请在前台重测。');}};
  document.addEventListener('visibilitychange',hidden);
  return ()=>{document.removeEventListener('visibilitychange',hidden);onMode('normal');};
 },[onMode]);
 useEffect(()=>{
  if(probe.current){probe.current=null;setRunning(false);onMode('normal');setNotice('画面、帧率或阴影设置已改变，请重新开始诊断。');}
  setResults([]);
 },[shadowsEnabled,renderRate,stylized,onMode]);
 const report=()=>[`Mining 性能对照（V25 · 帧率可切换）`, `画面：${stylized?'风格化':'原始'}`, `烘焙阴影开关：${shadowsEnabled?'开':'关'}`, `帧率模式：${renderRate==='display'?'跟随屏幕':'60帧上限'}`,navigator.userAgent,...results.map(r=>!r.samples?`${r.label}: 无有效样本`:`${r.label}: RAF ${r.raf.toFixed(1)}, 提交FPS ${r.fps.toFixed(1)}, 逻辑 ${r.logic.toFixed(1)}ms, 绘制CPU ${r.submit.toFixed(1)}ms, 样本 ${r.samples}`)].join('\n');
 return <>
  <button className="performance-probe-toggle" type="button" onClick={()=>{if(open)stop();setOpen(!open);}}>性能诊断</button>
  {open&&<section className="performance-probe" aria-label="性能诊断">
   <strong>{running?`测试 ${index+1}/${PROBE_STAGES.length}：${PROBE_STAGES[index].label}`:'性能对照 · 约 40 秒'}</strong>
   <p>当前烘焙阴影：{shadowsEnabled?'开':'关'}。站在卡顿的位置，保持镜头和手机朝向不变。测试时画面会短暂静止、变灰或变模糊，结束自动恢复。</p>
   <div className="probe-actions">
    <button type="button" disabled={running||!stats} onClick={()=>{probe.current=new PerformanceProbe(performance.now());setRunning(true);setIndex(0);setResults([]);setNotice('');onMode('normal');}}>开始诊断</button>
    {running&&<button type="button" onClick={()=>{stop();setNotice('已取消并恢复正常画面。');}}>取消</button>}
    {!running&&results.length>0&&<button type="button" onClick={()=>{navigator.clipboard.writeText(report()).then(()=>setNotice('结果已复制。'),()=>setNotice(report()));}}>复制结果</button>}
    <button type="button" onClick={()=>{stop();setOpen(false);}}>关闭</button>
   </div>
   {results.length>0&&<table><thead><tr><th>场景</th><th>RAF</th><th>提交 FPS</th></tr></thead><tbody>{results.map((r,i)=><tr key={i}><td>{r.label}</td><td>{r.samples?r.raf.toFixed(1):'—'}</td><td>{r.samples?r.fps.toFixed(1):'—'}</td></tr>)}</tbody></table>}
   {notice&&<p className="probe-notice">{notice}</p>}
  </section>}
 </>;
}
