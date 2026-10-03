import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import { GameButton } from './GameButton.tsx';
export function UpgradePanel({ session, onClose }: {
  session: Pick<GameSession, 'subscribe' | 'getSnapshot' | 'upgradeBackpack' | 'upgradePickaxe'>;
  onClose: () => void;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [tab, setTab] = useState<'pickaxe' | 'backpack'>('pickaxe');
  const panel = useRef<HTMLElement>(null);
  const [message, setMessage] = useState('');
  const bag = state.backpackUpgrade, axe = state.pickaxeUpgrade, pickaxe = state.pickaxe;
  const next = tab === 'pickaxe' ? axe.next : bag.next;
  const price = tab === 'pickaxe' ? axe.price : bag.next?.price ?? 0;
  const canAfford = tab === 'pickaxe' ? axe.canAfford : bag.canAfford;
  useEffect(() => { panel.current?.focus(); }, []);
  return <div className="upgrade-backdrop">
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="upgrade-title" className="upgrade-panel"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key !== 'Tab') return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
        event.preventDefault(); buttons[nextIndex]?.focus();
      }}>
      <header><h1 id="upgrade-title">升级</h1><GameButton blurAfterPress={false} aria-label="关闭升级界面" className="upgrade-close" onPress={onClose}>关闭</GameButton></header>
      <nav className="upgrade-tabs" aria-label="升级类别">
        {(['pickaxe', 'backpack'] as const).map(value => <GameButton key={value} blurAfterPress={false} aria-pressed={tab === value} onPress={() => { setTab(value); setMessage(''); }}>{value === 'pickaxe' ? '镐子' : '背包'}</GameButton>)}
      </nav>
      {tab === 'pickaxe' ? <>
        <p className="upgrade-description" data-testid="pickaxe-level">镐子 Lv.{pickaxe.level}{axe.next ? ` → Lv.${axe.next.level}` : ''}</p>
        <div className="pickaxe-stats">
          <div><span>力量</span><strong>{pickaxe.power} <i>→</i> {axe.next?.power ?? pickaxe.power}</strong></div>
          <div><span>攻速 · 次/秒</span><strong>{pickaxe.speed} <i>→</i> {axe.next?.speed ?? pickaxe.speed}</strong></div>
        </div>
        <p className="speed-step">{pickaxe.levelsUntilSpeed === null ? '攻速已达上限，力量继续提升' : pickaxe.levelsUntilSpeed === 1 ? '本次升级提升攻速' : `再升 ${pickaxe.levelsUntilSpeed} 级提升攻速`}</p>
      </> : <>
        <p className="upgrade-description">扩充容量，一趟带回更多矿物。</p>
        <div className="upgrade-capacity"><div><span>当前容量</span><strong>{state.inventory.capacity}</strong></div><span aria-hidden="true">→</span><div><span>{bag.next ? '升级后容量' : '最高容量'}</span><strong>{bag.next?.capacity ?? state.inventory.capacity}</strong></div></div>
      </>}
      <div className="upgrade-price"><span>持有金币 <b>{state.coins}</b></span>{next && <span>升级费用 <b>{price}</b></span>}</div>
      <GameButton blurAfterPress={false} className="upgrade-buy" disabled={!next || !canAfford} onPress={() => {
        if (!next) return;
        if (tab === 'pickaxe') {
          const result = session.upgradePickaxe(pickaxe.level);
          setMessage(result.status === 'upgraded' ? `升级成功！镐子 Lv.${result.level}` : result.status === 'insufficient' ? '金币不足，先去出售矿物' : '等级已更新，请查看当前升级');
        } else if (bag.next) {
          const result = session.upgradeBackpack(bag.next.id);
          setMessage(result.status === 'upgraded' ? `升级成功！容量增加到 ${result.capacity}` : result.status === 'insufficient' ? '金币不足，先去出售矿物' : '档位已更新，请查看当前升级');
        }
        panel.current?.focus();
      }}>{!next ? (tab === 'backpack' ? '已升至最高容量' : '已达数值范围上限') : canAfford ? `花费 ${price} 金币升级` : `还差 ${price - state.coins} 金币`}</GameButton>
      <output role="status" className="upgrade-result">{message || '矿物可在地表金色圆圈出售'}</output>
    </section>
  </div>;
}
