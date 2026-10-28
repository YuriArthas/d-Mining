import { ShopView } from './game/presentation/ShopView.ts';
import {GAME_CONTENT,GAME_GENERATION} from './game/content/gameContent.ts';
import {LoadingScreen,LoadingBoundary} from './game/ui/LoadingScreen.tsx';
import {initialLoading,updateLoading,type LoadingEvent} from './game/ui/loadingState.ts';
import type {RenderRate} from './game/movement.ts';
import {SURFACE_EXPOSURE} from './game/world/SceneLighting.ts';
import {applyToneGrade} from './game/presentation/toneGrade.ts';
import { lazy, Suspense, useCallback, useReducer, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { Canvas, unmountComponentAtNode, type RootState } from '@react-three/fiber';
import { GAME_CONFIG } from './game/config.ts';
import { GameInput, type InputSnapshot } from './game/GameInput.ts';
import { InputMonitor, ValidationPanel } from './game/Controls.tsx';
import { ValidationScene } from './game/validation/ValidationScene.tsx';
import { SaveEntry } from './game/ui/SaveEntry.tsx';
import type { SavedGame } from './game/persistence/SaveBootstrap.ts';
import { SessionUi } from './game/ui/SessionUi.tsx';
import {PerformanceProbeUi} from './game/ui/PerformanceProbeUi.tsx';
import type {ProbeMode} from './game/presentation/PerformanceProbe.ts';
import type {PerformanceSnapshot} from './game/presentation/PerformanceMeter.ts';
import {beginGameTouch, blockGameCompatibilityClick} from './game/ui/GameButton.tsx';
import {gameAudio} from './game/audio/GameAudio.ts';
import type {SystemControls} from './game/ui/hud/SystemMenu.tsx';
import {UiButton} from './game/ui/kit/controls.tsx';
import {Sheet} from './game/ui/kit/panel.tsx';
import './game/ui/kit/fonts.css';
import './game/ui/kit/tokens.css';
import './game/ui/legacy.css';

declare global {
  interface Window {
    __mining?: {
      getInput: () => InputSnapshot;
      getShop: () => ReturnType<ShopView["diagnostics"]>;
      getCamera: () => number[] | null;
      getCellState: (x: number, y: number, z: number) => 'unavailable' | 'solid' | 'empty';
    };
  }
}

// ?kit=1 shows the UI kit sample page instead of the game (docs/draft-ui-v2.md, U1).
const KitSample = lazy(() => import('./game/ui/kit/KitSample.tsx').then(m => ({ default: m.KitSample })));
export function App() {
  if (new URLSearchParams(window.location.search).get('kit') === '1') return <Suspense><KitSample /></Suspense>;
  return <SaveEntry content={GAME_CONTENT.session} generation={GAME_GENERATION}>{game => <GameView savedGame={game} />}</SaveEntry>;
}
function GameView({ savedGame }: { savedGame: SavedGame }) {
  const hosted = /\/games\/mining(?:-test|-surface-play)?\/(?:index\.html)?$/.test(window.location.pathname);
  const canvas = useRef<HTMLCanvasElement>(null);
  const guideMarker = useRef<HTMLDivElement>(null);
  const scene = useRef<RootState | null>(null);
  const exiting = useRef(false);
  const [exited, setExited] = useState(false);
  const [shadowsEnabled,setShadowsEnabled]=useState(true);
  const [renderRate,setRenderRate]=useState<RenderRate>('display');
  const [loading,dispatchLoading]=useReducer(updateLoading,undefined,initialLoading);
  const onLoading=useCallback((event:LoadingEvent)=>{
    dispatchLoading(event);
    const log=window.__MINING_LOG__;
    if('error' in event)log?.write('loading.error',event.error);
    else if('ready' in event)log?.ready();
    else if('stage' in event)log?.phase(event.stage,{...event,bucket:event.complete?'complete':Math.floor(event.done/Math.max(1,event.total)*10)});
  },[]);
  useEffect(()=>{window.__MINING_LOG__?.write('game.ui-mounted');},[]);
  const [loadingVisible,setLoadingVisible]=useState(true);
  const showLoading=!loading.ready||loadingVisible;
  useEffect(()=>{
    if(!loading.ready){setLoadingVisible(true);return;}
    // Let the bar reach its endpoint before revealing the already-rendered game.
    const timer=setTimeout(()=>setLoadingVisible(false),220);
    return ()=>clearTimeout(timer);
  },[loading.ready]);
  const failLoading=useCallback((error:string)=>{savedGame.saves.invalidate(error);onLoading({error});},[savedGame]);
  const [status, setStatus] = useState('正在准备地形');
  const [performanceStats,setPerformanceStats]=useState<PerformanceSnapshot|null>(null);
  const [input] = useState(() => new GameInput());
  const [shopView] = useState(() => new ShopView());
  useEffect(() => () => shopView.dispose(), [shopView]);
  // Sound and music start on the first touch, click or key press (browser rule) and pause while hidden.
  useEffect(() => gameAudio.attach(), []);
  const sound = useSyncExternalStore(gameAudio.subscribe, gameAudio.isEnabled);
  const music = useSyncExternalStore(gameAudio.subscribe, gameAudio.isMusicEnabled);
  const session = savedGame.session;
  const saveStatus = useSyncExternalStore(savedGame.saves.subscribe, savedGame.saves.getStatus);
  const [exitState, setExitState] = useState<'saving' | 'failed' | null>(null);
  const [exitError, setExitError] = useState('');
  const [probeMode,setProbeMode]=useState<ProbeMode>('normal');
  const changeProbeMode=useCallback((mode:ProbeMode)=>{input.reset();setProbeMode(mode);},[input]);
  const surface = useRef<HTMLDivElement>(null);
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';

  useEffect(() => {
    if (!debug || exited) return;
    let live = true;
    void import('./game/persistence/saveDebug.ts').then(({ attachSaveDebug }) => { if (live) attachSaveDebug(savedGame); });
    window.__mining = {
      getInput: input.getSnapshot,
      getShop: () => shopView.diagnostics(),
      getCamera: () => scene.current?.camera.position.toArray() ?? null,
      getCellState: (x, y, z) => {
        const value = window.__miningValidation?.cell([x, y, z]);
        return value == null ? 'unavailable' : value ? 'solid' : 'empty';
      },
    };
    return () => { live = false; delete window.__mining; delete window.__miningSave; };
  }, [input, debug, exited, savedGame]);

  const exit = async (discard = false) => {
    if (exiting.current) return;
    exiting.current = true;
    input.reset();
    session.setSuspended(true);
    setExitState('saving');
    if (!discard) {
      try { await savedGame.saves.flush(); }
      catch (error) { setExitError(String(error)); setExitState('failed'); exiting.current = false; return; }
    }
    if (discard) await savedGame.saves.stop();
    // Saving precedes the asynchronous renderer teardown.
    const finish = () => queueMicrotask(() => {
      // Finish removing the DOM Canvas outside the R3F commit callback. Pending Canvas
      // effects may reconnect events, so disconnect once more after its final removal.
      flushSync(() => setExited(true));
      gameAudio.dispose();
      scene.current?.events.disconnect?.();
      scene.current = null;
      // Replace the disposed game entry so browser Back cannot restore an empty game.
      void savedGame.close().then(() => { if (hosted) window.location.replace(new URL('../../', window.location.href).href); });
    });
    if (canvas.current && scene.current) {
      // R3F owns the renderer. Its completion callback runs after event and GPU cleanup.
      unmountComponentAtNode(canvas.current, finish);
    } else {
      // Canvas handles cancellation of initialization when it is removed before readiness.
      finish();
    }
  };

  const settle = () => { input.reset(); surface.current?.focus(); };
  const system: SystemControls = {
    renderRate, toggleRenderRate: () => { settle(); setRenderRate(r => r === 'display' ? '60' : 'display'); },
    shadows: shadowsEnabled, toggleShadows: () => { settle(); setShadowsEnabled(v => !v); },
    music, toggleMusic: () => { settle(); gameAudio.toggleMusic(); },
    sound, toggleSound: () => { settle(); gameAudio.toggle(); },


    hosted, exit: () => void exit(),
  };

  if (exited) {
    return (
      <main onContextMenuCapture={event => event.preventDefault()} className="game-shell" aria-label="Mining 游戏">
        <section className="placeholder" role="status">
          <h1>已退出游戏</h1>
        </section>
      </main>
    );
  }

  return (
    <main onPointerDownCapture={beginGameTouch} onClickCapture={blockGameCompatibilityClick} onContextMenuCapture={event => event.preventDefault()} className="game-shell game-shell--active game-shell--roblox-hud" aria-label="Mining 游戏" style={{ '--scene-background': GAME_CONFIG.background } as CSSProperties}>
      <div inert={showLoading || !!exitState || saveStatus.state === 'conflicted'} ref={surface} className="scene" tabIndex={0} aria-label="游戏视角，拖动观察，点按敲击，长按方块挖掘">
        <LoadingBoundary onFailure={failLoading}><Canvas
          ref={canvas}
          onCreated={state => { scene.current = state; applyToneGrade(state.gl); state.gl.toneMappingExposure=SURFACE_EXPOSURE; }}
          frameloop="never"
          shadows={false}
          resize={{ offsetSize: true }}
          dpr={probeMode==='low-resolution'?Math.min(Math.max(window.devicePixelRatio,1),GAME_CONFIG.pixelRatioMax)*.5:[1,GAME_CONFIG.pixelRatioMax]}
          camera={{ fov: GAME_CONFIG.camera.fov, near: GAME_CONFIG.camera.near, far: 10000 }}
          gl={{ antialias: true }}
          fallback={<p>当前浏览器无法启动 3D 画面，请使用支持 WebGL2 的浏览器。</p>}
        >
          <ValidationScene shopView={shopView} guideMarker={guideMarker} savedGame={savedGame} content={GAME_CONTENT} renderRate={renderRate} shadowsEnabled={shadowsEnabled} probeMode={probeMode} input={input} onStatus={setStatus} onLoading={onLoading} onPerformance={setPerformanceStats} session={session} />
        </Canvas></LoadingBoundary>
      </div>
      <header inert={!!exitState} className="game-header" style={{display:showLoading?'none':undefined}}>
        {debug && <details className="hud-debug-tools"><summary>调试</summary><div className="hud-debug-content"><span className="wordmark">MINING</span><span className="stage-label">{status}</span>
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
        </div></details>}
      </header>
      {!showLoading&&<div inert={!!exitState || saveStatus.state === 'conflicted'}><SessionUi shopView={shopView} system={system} guideMarker={guideMarker} blocked={saveStatus.state === 'failed' || saveStatus.state === 'conflicted'} session={session} input={input} surface={surface} /></div>}
      {!exitState && (saveStatus.state === 'failed' || saveStatus.state === 'conflicted') && <aside className="save-warning ui-card" role="alert">
        <span>{saveStatus.state === 'conflicted' ? saveStatus.error : '进度暂未保存，请重试'}</span>
        {saveStatus.state === 'failed' ? <UiButton size="s" tone="orange" onPress={() => void savedGame.saves.flush().catch(() => {})}>重试保存</UiButton> : <UiButton size="s" tone="orange" onPress={() => location.reload()}>重新进入</UiButton>}
      </aside>}
      {exitState && <Sheet title={exitState === 'saving' ? '正在保存进度' : '进度尚未保存'} size="s" label="保存进度" footer={exitState === 'failed' ? <>
        <UiButton size="s" tone="red" onPress={() => void exit(true)}>不保存退出</UiButton>
        {saveStatus.state !== 'conflicted' && <UiButton size="s" tone="steel" onPress={() => { input.reset(); setExitState(null); session.setSuspended(false); surface.current?.focus(); }}>返回游戏</UiButton>}
        <span className="ui-grow" /><UiButton size="s" tone="orange" onPress={() => void exit()}>重试保存</UiButton>
      </> : undefined}>
        {exitState === 'saving' ? <p className="ui-hint">请稍候，马上就好…</p> : <div className="ui-well save-error"><span className="ui-hint">{exitError || '网络或存储暂时不可用，重试一次通常就能保存。'}</span></div>}
      </Sheet>}
      {showLoading&&<LoadingScreen state={loading} onExit={() => void exit()} />}
    </main>
  );
}
