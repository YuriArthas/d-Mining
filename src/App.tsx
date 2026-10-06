import {CAMP_CONTENT} from './game/content/campContent.ts';
import {LoadingScreen,LoadingBoundary} from './game/ui/LoadingScreen.tsx';
import {initialLoading,updateLoading} from './game/ui/loadingState.ts';
import type {RenderRate} from './game/movement.ts';
import type {SurfaceTime} from './game/world/SceneLighting.ts';
import { useCallback, useReducer, useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { NeutralToneMapping } from 'three';
import { Canvas, unmountComponentAtNode, type RootState } from '@react-three/fiber';
import { GAME_CONFIG } from './game/config.ts';
import { GameInput, type InputSnapshot } from './game/GameInput.ts';
import { InputMonitor, ValidationPanel } from './game/Controls.tsx';
import { ValidationScene } from './game/validation/ValidationScene.tsx';
import { GameSession } from './game/application/GameSession.ts';
import { SessionUi } from './game/ui/SessionUi.tsx';
import {PerformanceProbeUi} from './game/ui/PerformanceProbeUi.tsx';
import type {ProbeMode} from './game/presentation/PerformanceProbe.ts';
import type {PerformanceSnapshot} from './game/presentation/PerformanceMeter.ts';

declare global {
  interface Window {
    __mining?: {
      getInput: () => InputSnapshot;
      getCamera: () => number[] | null;
      getCellState: (x: number, y: number, z: number) => 'unavailable' | 'solid' | 'empty';
    };
  }
}

export function App() {
  const hosted = /\/games\/mining(?:-test)?\/(?:index\.html)?$/.test(window.location.pathname);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<RootState | null>(null);
  const exiting = useRef(false);
  const [exited, setExited] = useState(false);
  const [timeOfDay,setTimeOfDay]=useState<SurfaceTime>('night');
  const [shadowsEnabled,setShadowsEnabled]=useState(true);
  const [renderRate,setRenderRate]=useState<RenderRate>('display');
  const [loading,onLoading]=useReducer(updateLoading,undefined,initialLoading);
  const [loadingVisible,setLoadingVisible]=useState(true);
  const showLoading=!loading.ready||loadingVisible;
  useEffect(()=>{
    if(!loading.ready){setLoadingVisible(true);return;}
    // Let the bar reach its endpoint before revealing the already-rendered game.
    const timer=setTimeout(()=>setLoadingVisible(false),220);
    return ()=>clearTimeout(timer);
  },[loading.ready]);
  const failLoading=useCallback((error:string)=>onLoading({error}),[]);
  const [status, setStatus] = useState('正在准备地形');
  const [performanceStats,setPerformanceStats]=useState<PerformanceSnapshot|null>(null);
  const [input] = useState(() => new GameInput());
  const [session] = useState(() => new GameSession(CAMP_CONTENT.session));
  const [probeMode,setProbeMode]=useState<ProbeMode>('normal');
  const changeProbeMode=useCallback((mode:ProbeMode)=>{input.reset();setProbeMode(mode);},[input]);
  const surface = useRef<HTMLDivElement>(null);
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';

  useEffect(() => {
    if (!debug || exited) return;
    window.__mining = {
      getInput: input.getSnapshot,
      getCamera: () => scene.current?.camera.position.toArray() ?? null,
      getCellState: (x, y, z) => {
        const value = window.__miningValidation?.cell([x, y, z]);
        return value == null ? 'unavailable' : value ? 'solid' : 'empty';
      },
    };
    return () => { delete window.__mining; };
  }, [input, debug, exited]);

  const exit = () => {
    if (exiting.current) return;
    exiting.current = true;
    input.reset(); // Cancel a pending hold before the asynchronous renderer teardown.
    const finish = () => queueMicrotask(() => {
      // Finish removing the DOM Canvas outside the R3F commit callback. Pending Canvas
      // effects may reconnect events, so disconnect once more after its final removal.
      flushSync(() => setExited(true));
      scene.current?.events.disconnect?.();
      scene.current = null;
      // Replace the disposed game entry so browser Back cannot restore an empty game.
      if (hosted) window.location.replace(new URL('../../', window.location.href).href);
    });
    if (canvas.current && scene.current) {
      // R3F owns the renderer. Its completion callback runs after event and GPU cleanup.
      unmountComponentAtNode(canvas.current, finish);
    } else {
      // Canvas handles cancellation of initialization when it is removed before readiness.
      finish();
    }
  };

  if (exited) {
    return (
      <main className="game-shell" aria-label="Mining 游戏">
        <section className="placeholder" role="status">
          <h1>已退出游戏</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="game-shell game-shell--active" aria-label="Mining 游戏" style={{ '--scene-background': GAME_CONFIG.background } as CSSProperties}>
      <div inert={showLoading} ref={surface} className="scene" tabIndex={0} aria-label="游戏视角，拖动观察，点按敲击，长按方块挖掘">
        <LoadingBoundary onFailure={failLoading}><Canvas
          ref={canvas}
          onCreated={state => { scene.current = state; state.gl.toneMapping=NeutralToneMapping; state.gl.toneMappingExposure=1.08; }}
          frameloop="never"
          shadows={false}
          resize={{ offsetSize: true }}
          dpr={probeMode==='low-resolution'?Math.min(Math.max(window.devicePixelRatio,1),GAME_CONFIG.pixelRatioMax)*.5:[1,GAME_CONFIG.pixelRatioMax]}
          camera={{ fov: GAME_CONFIG.camera.fov, near: GAME_CONFIG.camera.near, far: 10000 }}
          gl={{ antialias: true }}
          fallback={<p>当前浏览器无法启动 3D 画面，请使用支持 WebGL2 的浏览器。</p>}
        >
          <ValidationScene content={CAMP_CONTENT} renderRate={renderRate} shadowsEnabled={shadowsEnabled} probeMode={probeMode} input={input} onStatus={setStatus} onLoading={onLoading} onPerformance={setPerformanceStats} session={session} timeOfDay={timeOfDay} />
        </Canvas></LoadingBoundary>
      </div>
      <header className="game-header" style={{display:showLoading?'none':undefined}}>
        <div><span className="wordmark">MINING</span><span className="stage-label">{status}</span>
          <div className="performance-hud" aria-label="实时性能" title="帧率模式可切换60帧上限或跟随屏幕回调；FPS 按实际提交的主画面计数；CPU 是每次逻辑更新均值，提交是实际绘制的主线程均值（含反射）。RAF 是浏览器回调频率，调度是游戏限帧的跳过比例；GPU 计时需显式开启；绘制次数拆为主画面 / 反射，三角面含两个通道。">
            <div>{performanceStats?`${performanceStats.fps.toFixed(1)} FPS · ${performanceStats.frameMs?.toFixed(1)??'—'} ms`:'FPS — · — ms'}</div>
            <details className="performance-details"><summary>详情</summary><div className="performance-expanded">
            <div className="performance-detail">{performanceStats?`CPU ${performanceStats.logicCpuMs.toFixed(1)} ms · 提交 ${performanceStats.renderCpuMs?.toFixed(1)??'—'} ms · GPU ${performanceStats.gpu?.totalMs?.toFixed(1)??'—'} ms`:'正在采样性能…'}</div>
            {performanceStats&&<div className="performance-detail">{`绘制 ${performanceStats.mainCalls} / ${performanceStats.reflectionCalls} · 三角 ${(performanceStats.triangles/10000).toFixed(1)}万 · GPU 等待跳帧 ${performanceStats.skipPercent.toFixed(0)}%`}</div>}
            {performanceStats&&<div className="performance-detail">{`RAF ${performanceStats.rafFps.toFixed(1)} · 调度跳过 ${performanceStats.scheduleSkipPercent.toFixed(0)}% · 同步 ${performanceStats.waitCpuMs.toFixed(1)} ms`}</div>}
            {performanceStats&&<div className="performance-detail">{!performanceStats.gpu?.enabled?'GPU 计时关闭（避免同步查询干扰）':performanceStats.gpu?.supported?`GPU 主画面 ${performanceStats.gpu.mainMs?.toFixed(1)??'—'} / 反射 ${performanceStats.gpu.reflectionMs?.toFixed(1)??'—'} ms`:'GPU 计时：此浏览器不支持'}</div>}
            <PerformanceProbeUi renderRate={renderRate} shadowsEnabled={shadowsEnabled} stats={performanceStats} onMode={changeProbeMode} />
            </div></details>
          </div>
        </div>
        <nav className="scene-actions" aria-label="场景设置">
        <button type="button" aria-label={renderRate==='display'?'切换为60帧上限':'跟随屏幕刷新率'} onClick={()=>{input.reset();setRenderRate(r=>r==='display'?'60':'display');surface.current?.focus();}}>帧率：{renderRate==='display'?'屏幕':'60'}</button>
        <button type="button" aria-label={shadowsEnabled?'关闭烘焙阴影':'开启烘焙阴影'} aria-pressed={shadowsEnabled} onClick={()=>{input.reset();setShadowsEnabled(v=>!v);surface.current?.focus();}}>阴影：{shadowsEnabled?'烘焙':'关'}</button>
        <button type="button" aria-label={timeOfDay==='day'?'切换到夜晚':'切换到白天'} onClick={()=>{input.reset();setTimeOfDay(t=>t==='day'?'night':'day');surface.current?.focus();}}>{timeOfDay==='day'?'☀ 白天':'☾ 夜晚'}</button>
        <button type="button" onClick={exit}
          onPointerDown={event => { if (event.pointerType !== 'mouse') event.preventDefault(); }}
          onPointerUp={event => {
            // A second touch does not synthesize click on every mobile browser.
            if (event.pointerType !== 'mouse' && event.currentTarget.contains(document.elementFromPoint(event.clientX, event.clientY))) exit();
          }} aria-label={hosted ? '退出游戏，返回游戏列表' : '退出游戏'}>
          退出游戏
        </button>
        </nav>
      </header>
      {!showLoading&&<SessionUi session={session} input={input} surface={surface} />}
      {showLoading&&<LoadingScreen state={loading} onExit={exit} />}
      {debug && !showLoading && <><InputMonitor input={input} /><ValidationPanel /></>}
    </main>
  );
}
