import { formatNumber as number } from '../presentation/formatNumber.ts';
import { useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
export function TargetHealth({ session }: { session: Pick<GameSession, 'subscribe' | 'getSnapshot'> }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot), target = state.target;
  if (!target) return null;
  return <aside className="target-health" aria-label="当前矿物血量">
    <div><strong>{target.name}</strong><span data-testid="target-hp">{number(target.hp)} / {number(target.maximum)}</span></div>
    <div className="target-health-track" role="progressbar" aria-label={`${target.name}血量`} aria-valuenow={target.hp} aria-valuemin={0} aria-valuemax={target.maximum}>
      <span key={`${target.key}:${state.hitSerial}`} className={target.hp < target.maximum ? 'hit-flash' : ''} style={{ width: `${target.hp / target.maximum * 100}%` }} />
    </div>
    <small className="target-value" data-testid="target-value">体积 {target.volume} · 售价 {number(target.price)} 金币</small>
    {/* Pickaxe stats live in the shop; while mining only a blocked or finished block needs a word. */}
    {(target.locked || target.hp === 0) && <small>{target.locked ? `需要 Lv.${target.requiredLevel} 镐子` : '已击碎，正在挖除'}</small>}
  </aside>;
}
