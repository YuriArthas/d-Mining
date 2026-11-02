import { resolveText } from '../i18n/i18n.ts';
import type { RenderRate } from '../movement.ts';
import type { ProbeMode } from '../presentation/PerformanceProbe.ts';
import type { PerformanceSnapshot } from '../presentation/PerformanceMeter.ts';
import type { GameInput } from '../GameInput.ts';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { GAME_CONTENT } from '../content/gameContent.ts';
import { MINERALS } from '../terrain/minerals.ts';
import { PerformanceProbeUi } from './PerformanceProbeUi.tsx';

import './debugTools.css';
/** The ?debug=1 panel: stage, live performance, the probe, the input monitor and the validation panel. Developer
 *  text only (not translated). */
export function DebugTools({ status, performanceStats, renderRate, shadowsEnabled, changeProbeMode, input }: {
  status: string; performanceStats: PerformanceSnapshot | null; renderRate: RenderRate; shadowsEnabled: boolean;
  changeProbeMode(mode: ProbeMode): void; input: GameInput;
}) {
  return <details className="hud-debug-tools"><summary>调试</summary><div className="hud-debug-content"><span className="wordmark">MINING</span><span className="stage-label">{status}</span>
          <div className="performance-hud" aria-label="实时性能" title="帧率模式可切换60帧上限或跟随屏幕回调；FPS 按实际提交的主画面计数；CPU 是每次逻辑更新均值，提交是实际绘制的主线程均值（含反射）。RAF 是浏览器回调频率，调度是游戏限帧的跳过比例；GPU 计时需显式开启；绘制次数拆为主画面 / 反射，三角面含两个通道。">
            <div>{performanceStats?`${performanceStats.fps.toFixed(1)} FPS · ${performanceStats.frameMs?.toFixed(1)??'—'} ms`:'FPS — · — ms'}</div>
            <details className="performance-details"><summary>详情</summary><div className="performance-expanded">
            <div className="performance-detail">{performanceStats?`CPU ${performanceStats.logicCpuMs.toFixed(1)} ms · 提交 ${performanceStats.renderCpuMs?.toFixed(1)??'—'} ms · GPU ${performanceStats.gpu?.mainMs?.toFixed(1)??'—'} ms`:'正在采样性能…'}</div>
            {performanceStats&&<div className="performance-detail">{`绘制 ${performanceStats.mainCalls} · 三角 ${(performanceStats.triangles/10000).toFixed(1)}万 · GPU 等待跳帧 ${performanceStats.skipPercent.toFixed(0)}%`}</div>}
            {performanceStats&&<div className="performance-detail">{`RAF ${performanceStats.rafFps.toFixed(1)} · 调度跳过 ${performanceStats.scheduleSkipPercent.toFixed(0)}% · 同步 ${performanceStats.waitCpuMs.toFixed(1)} ms`}</div>}
            {performanceStats&&<div className="performance-detail">{!performanceStats.gpu?.enabled?'GPU 计时关闭（避免同步查询干扰）':performanceStats.gpu?.supported?`GPU 主画面 ${performanceStats.gpu.mainMs?.toFixed(1)??'—'} ms`:'GPU 计时：此浏览器不支持'}</div>}
            <PerformanceProbeUi renderRate={renderRate} shadowsEnabled={shadowsEnabled} stats={performanceStats} onMode={changeProbeMode} />
            </div></details>
          </div>
          <InputMonitor input={input} /><ValidationPanel />
        </div></details>;
}

export function InputMonitor({ input }: { input: GameInput }) {
  const value = useSyncExternalStore(input.subscribe, input.getSnapshot);
  return <output className="input-monitor" aria-label="输入调试">
    移动 {value.moveX.toFixed(2)}, {value.moveY.toFixed(2)} · 跳跃 {value.jumpCount} · 挥镐 {value.mining ? '按住' : '松开'}
  </output>;
}


export function ValidationPanel() {
  const [summary, setSummary] = useState('正在加载');
  useEffect(() => {
    const id = window.setInterval(() => {
      const stats = window.__miningValidation?.snapshot() as { chunks: number; terrainColliders: number; editBytes: number; pendingEdit: boolean } | undefined;
      if (stats) setSummary(`区块 ${stats.chunks} · 碰撞 ${stats.terrainColliders} · 修改 ${(stats.editBytes / 1024).toFixed(2)} KiB${stats.pendingEdit ? ' · 更新中' : ''}`);
    }, 250);
    return () => clearInterval(id);
  }, []);
  return <aside className="validation-panel">
    <output>{summary}</output>
    <details><summary>矿物图例 · {MINERALS.length} 种</summary><div className="mineral-legend">{MINERALS.map(m => <span key={m.id}><i style={{ background: m.color }} />{resolveText(m.name)}</span>)}</div></details>
    <div><button type="button" onClick={() => window.__miningValidation?.teleport('surface')}>定位地表</button><button type="button" onClick={() => window.__miningValidation?.teleport('deep')}>定位最深层</button></div>
    <select aria-label="预览场景" defaultValue="" onChange={event => {
      const room=GAME_CONTENT.session.destinations.find(r=>r.id===event.target.value);
      if(room)window.__miningValidation?.teleport(room.spawn);
      else if(event.target.value==='surface')window.__miningValidation?.teleport('surface');
    }}><option value="" disabled>选择主题场景</option><option value="surface">松风矿谷 · 地表</option>{GAME_CONTENT.session.destinations.map(r=><option key={r.id} value={r.id}>世界 {r.worldId} · {resolveText(r.name)} · {r.depth} 米</option>)}</select>
  </aside>;
}
