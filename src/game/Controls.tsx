import { ROOMS } from './world/rooms.ts';
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import type { GameInput } from './GameInput.ts';
import { MINERALS } from './terrain/minerals.ts';
import { bindInput } from './bindInput.ts';

export function Controls({ input, surface }: { input: GameInput; surface: RefObject<HTMLDivElement | null> }) {
  const touchTarget = useRef<HTMLDivElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const jump = useRef<HTMLButtonElement>(null);
  useEffect(() => bindInput(input, {
    touchTarget: touchTarget.current!, surface: surface.current!, stick: stick.current!, knob: knob.current!, jump: jump.current!,
  }), [input, surface]);
  return <>
    <div ref={touchTarget} className="touch-target" hidden aria-hidden="true" />
    <div className="touch-controls">
      <div ref={stick} className="joystick" role="group" aria-label="移动摇杆">
        <span ref={knob} className="joystick-knob" />
        <span className="joystick-label">移动</span>
      </div>
      <div className="action-buttons">
        <button ref={jump} className="jump-button" type="button" aria-label="跳跃输入" aria-pressed="false">跳跃</button>
      </div>
    </div>
    <div className="control-hint">
      <span className="desktop-hint">WASD 移动 · 空格跳跃 · 右键观察 · 鼠标指向 · 左键挖掘</span>
      <span className="touch-hint">左侧移动 · 拖动观察 · 点按敲击 · 长按挖掘</span>
    </div>
  </>;
}

export function InputMonitor({ input }: { input: GameInput }) {
  const value = useSyncExternalStore(input.subscribe, input.getSnapshot);
  return <output className="input-monitor" aria-label="输入调试">
    移动 {value.moveX.toFixed(2)}, {value.moveY.toFixed(2)} · 跳跃 {value.jumpCount} · 挥镐 {value.mining ? '按住' : '松开'}
  </output>;
}


export function ValidationPanel() {
  const [summary, setSummary] = useState('正在加载');
  const [samples, setSamples] = useState<{ name: string; renderTriangles: number | null; collisionTriangles: number | null }[]>([]);
  const [wireframe, setWireframe] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => {
      const stats = window.__miningValidation?.snapshot() as { chunks: number; terrainColliders: number; editBytes: number; pendingEdit: boolean; samples: typeof samples } | undefined;
      if (stats) setSamples(stats.samples);
      if (stats) setSummary(`区块 ${stats.chunks} · 碰撞 ${stats.terrainColliders} · 修改 ${(stats.editBytes / 1024).toFixed(2)} KiB${stats.pendingEdit ? ' · 更新中' : ''}`);
    }, 250);
    return () => clearInterval(id);
  }, []);
  return <aside className="validation-panel">
    <output>{summary}</output>
    <details><summary>矿物图例 · 30 种</summary><div className="mineral-legend">{MINERALS.map(m => <span key={m.id}><i style={{ background: m.color }} />{m.name}</span>)}</div></details>
    <div><button type="button" onClick={() => window.__miningValidation?.teleport('surface')}>定位地表</button>{new URLSearchParams(location.search).get('samples') === '1' && <button type="button" onClick={() => window.__miningValidation?.teleport('course')}>碰撞场</button>}<button type="button" onClick={() => window.__miningValidation?.teleport('deep')}>定位地心</button></div>
    <select aria-label="预览场景" defaultValue="" onChange={event => {
      const room=ROOMS.find(r=>r.id===event.target.value);
      if(room)window.__miningValidation?.teleport(room.spawn);
      else if(event.target.value==='surface')window.__miningValidation?.teleport('surface');
    }}><option value="" disabled>选择主题场景</option><option value="surface">草地矿场 · 地表</option>{ROOMS.map(r=><option key={r.id} value={r.id}>{r.name} · {r.depth} 米</option>)}</select>
    {new URLSearchParams(location.search).get('samples') === '1' && <details className="ore-samples"><summary>矿样与合并检查</summary>
      <div>同为 16×16 格表面；R 渲染三角 / C 碰撞三角</div>
      <div>{samples.map((s, i) => <button type="button" key={s.name} onClick={() => window.__miningValidation?.teleport((['uniform', 'bands', 'checker'] as const)[i])}>
        {s.name} R{s.renderTriangles ?? '—'} / C{s.collisionTriangles ?? '—'}
      </button>)}</div>
      <button type="button" aria-pressed={wireframe} onClick={() => { window.__miningValidation?.wireframe(!wireframe); setWireframe(!wireframe); }}>网格线{wireframe ? '开' : '关'}</button>
      <div>— 表示对应区域未完整加载；碰撞按 4 个 8 格区域合计。</div>
    </details>}
  </aside>;
}
