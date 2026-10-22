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
    <header><h1 id="travel-title">{state.journey?`世界 ${state.currentWorld} · 矿层传送`:'营地传送'}</h1><GameButton onPress={onClose} aria-label="关闭传送界面">关闭</GameButton></header>
    <p className="upgrade-description">历史最深 {Math.floor(state.maxDepth)} 米 · 达到对应深度，永久解锁传送和宠物蛋。</p>
    <div className="travel-list">{state.destinations.map(room => <div key={room.id}>
      <span><strong>{room.name}</strong><small>地下 {room.depth} 米</small></span>
      <GameButton disabled={!state.canTravel || !room.unlocked} onPress={() => { if (session.travelTo(room.id) === 'travelling') onClose(); }}>{room.unlocked ? '传送' : '未解锁'}</GameButton>
    </div>)}</div>
    <p className="upgrade-result">{state.rewards.permanent.travel?'便携传送已开启，可前往已解锁层':'回到地表家中可以传送'} · 解锁进度自动保存</p>
  </section></div>;
}
