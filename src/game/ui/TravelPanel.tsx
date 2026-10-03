import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import { GameButton } from './GameButton.tsx';
export function TravelPanel({ session, onClose }: { session: GameSession; onClose: () => void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot), panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  return <div className="upgrade-backdrop"><section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="travel-title" className="upgrade-panel travel-panel"
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
      }
    }}>
    <header><h1 id="travel-title">营地传送</h1><GameButton onPress={onClose} aria-label="关闭传送界面">关闭</GameButton></header>
    <p className="upgrade-description">挖到对应深度即可解锁，不必找到房间。</p>
    <div className="travel-list">{state.destinations.map(room => <div key={room.id}>
      <span><strong>{room.name}</strong><small>地下 {room.depth} 米</small></span>
      <GameButton disabled={!state.atHome || !room.unlocked} onPress={() => { if (session.travelTo(room.id) === 'travelling') onClose(); }}>{room.unlocked ? '传送' : '未解锁'}</GameButton>
    </div>)}</div>
    <p className="upgrade-result">回到地表家中可以传送 · 解锁进度保留至本局结束</p>
  </section></div>;
}
