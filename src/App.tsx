import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { Canvas, unmountComponentAtNode, type RootState } from '@react-three/fiber';
import { GAME_CONFIG } from './game/config.ts';
import { GameInput, type InputSnapshot } from './game/GameInput.ts';
import { Controls, InputMonitor, ValidationPanel } from './game/Controls.tsx';
import { ValidationScene } from './game/validation/ValidationScene.tsx';
import { GameSession } from './game/application/GameSession.ts';
import { InventoryHud } from './game/ui/InventoryHud.tsx';
import { UpgradePanel } from './game/ui/UpgradePanel.tsx';
import { TargetHealth } from './game/ui/TargetHealth.tsx';

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
  const hosted = /\/games\/mining\/(?:index\.html)?$/.test(window.location.pathname);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<RootState | null>(null);
  const exiting = useRef(false);
  const [exited, setExited] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [status, setStatus] = useState('正在准备地形');
  const [input] = useState(() => new GameInput());
  const [session] = useState(() => new GameSession());
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
      <div ref={surface} className="scene" tabIndex={0} aria-label="游戏视角，拖动观察，长按方块挖掘">
        <Canvas
          ref={canvas}
          onCreated={state => { scene.current = state; }}
          frameloop="never"
          resize={{ offsetSize: true }}
          dpr={[1, GAME_CONFIG.pixelRatioMax]}
          camera={{ fov: GAME_CONFIG.camera.fov, near: GAME_CONFIG.camera.near, far: 80 }}
          gl={{ antialias: false }}
          fallback={<p className="graphics-error">当前浏览器无法启动 3D 画面，请使用支持 WebGL2 的浏览器。</p>}
        >
          <ValidationScene input={input} onStatus={setStatus} session={session} />
        </Canvas>
      </div>
      <header className="game-header">
        <div><span className="wordmark">MINING</span><span className="stage-label">{status}</span></div>
        <button type="button" onClick={exit}
          onPointerDown={event => { if (event.pointerType !== 'mouse') event.preventDefault(); }}
          onPointerUp={event => {
            // A second touch does not synthesize click on every mobile browser.
            if (event.pointerType !== 'mouse' && event.currentTarget.contains(document.elementFromPoint(event.clientX, event.clientY))) exit();
          }} aria-label={hosted ? '退出游戏，返回游戏列表' : '退出游戏'}>
          退出游戏
        </button>
      </header>
      {!upgradeOpen && <TargetHealth session={session} />}
      <InventoryHud session={session} onOpenUpgrade={() => { input.reset(); setUpgradeOpen(true); }} />
      {!upgradeOpen && <Controls input={input} surface={surface} />}
      {upgradeOpen && <UpgradePanel session={session} onClose={() => {
        input.reset(); setUpgradeOpen(false); surface.current?.focus();
      }} />}
      {debug && <><InputMonitor input={input} /><ValidationPanel /></>}
    </main>
  );
}
