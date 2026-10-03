import { useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import { GameButton } from './GameButton.tsx';
import { ORE_ITEMS } from '../application/items.ts';
export function InventoryHud({ session, onOpenUpgrade }: { session: Pick<GameSession, 'subscribe' | 'getSnapshot' | 'returnToSurface'>; onOpenUpgrade: () => void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const bag = state.inventory;
  return <aside className="inventory-hud" aria-label="背包与售卖">
    <div className="inventory-totals"><strong data-full={bag.isFull} data-testid="bag-count">容量 {bag.used}/{bag.capacity}</strong><span data-testid="coins">金币 {state.coins}</span></div>
    <div className="inventory-items">{ORE_ITEMS.map(item => <span key={item.itemId} title={`每件占 ${item.volume} 容量，售价 ${item.price} 金币`}><i style={{ background: item.color }} />{item.name} <b>×{bag.items[item.itemId] ?? 0}</b></span>)}</div>
    <div className="inventory-actions">
      <GameButton onPress={session.returnToSurface}>返回地表</GameButton>
      <GameButton onPress={onOpenUpgrade}>升级</GameButton>
    </div>
    <div className="sale-hint" data-testid="sale-quote">共 {bag.totalCount} 件 · {state.sale.status === 'quoted' ? `预计 ${state.sale.coins} 金币` : '售价超出数值范围'}</div>
    <output className="sale-notice" role="status">{state.notice || '走进地表金色圆圈自动出售'}</output>
  </aside>;
}
