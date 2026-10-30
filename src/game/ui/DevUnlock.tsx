import { useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { WorldId } from '../content/worldJourney.ts';
import { colliderViewShown, toggleColliderView } from '../presentation/ColliderView.ts';
import './devUnlock.css';

/** Testing page (?debug=1): plain buttons that unlock worlds and layers outright, or lock them all again as at a fresh
 *  start, and show the scenery's colliders as lines. Deliberately unstyled. */
export function DevUnlockPage({ session, onClose }: { session: GameSession; onClose: () => void }) {
  useSyncExternalStore(session.subscribe, session.getSnapshot);
  const worlds = session.devUnlocks();
  return <div className="dev-unlock" onKeyDown={e => e.stopPropagation()}>
    <p><button onClick={onClose}>关闭</button> <button onClick={() => { for (const w of worlds) session.devUnlockWorld(w.id as WorldId); session.devUnlockLayer(); }}>全部解锁</button> <button onClick={() => { session.devResetUnlocks(); onClose(); }}>清空解锁</button> <button onClick={() => { toggleColliderView(); onClose(); }}>{colliderViewShown() ? '隐藏碰撞' : '显示碰撞'}</button></p>
    {worlds.map(w => <div key={w.id}>
      <h3>{w.name} {w.open ? '(已开放)' : <button onClick={() => session.devUnlockWorld(w.id as WorldId)}>解锁世界</button>}</h3>
      <ul>{w.layers.map(l => <li key={l.id}>{l.name} · {l.depth} 米 {l.unlocked ? '(已解锁)' : <button onClick={() => session.devUnlockLayer(l.id)}>解锁</button>}</li>)}</ul>
    </div>)}
  </div>;
}
