import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import { UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Sheet } from '../kit/panel.tsx';
import { tr } from '../../i18n/i18n.ts';
import './rebirth.css';

/** The rebirth panel (docs/draft-ui-v2.md, U7): the ore income multiplier now and after, big; what it takes (world 3's
 *  last layer and the last pickaxe) as a checklist; what is reset and what is kept side by side; one green button
 *  that asks once more, right on the panel, because it cannot be undone. */
export function RebirthSheet({ session, onClose, onReborn }: { session: GameSession; onClose(): void; onReborn(count: number, multiplier: number): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const offer = state.rebirth;
  const [confirm, setConfirm] = useState(false), [message, setMessage] = useState('');
  const go = () => {
    const result = session.rebirth(offer.count);
    setConfirm(false);
    if (result.status === 'reborn') { onReborn(result.count, result.multiplier); onClose(); return; }
    setMessage(result.status === 'locked' ? tr('条件还没满足，没有任何改变') : tr('请稍后再试'));
  };
  return <Sheet title={tr('重生')} subtitle={offer.count ? tr('已重生 {count} 次', { count: offer.count }) : undefined} onClose={onClose} className="rebirth-sheet">
    <div className="rebirth-layout">
      <section className="rebirth-boost" aria-label={tr('卖矿收入')}>
        <span className="rebirth-boost-label">{tr('卖矿收入')}</span>
        <div className="rebirth-mults">
          <b className="rebirth-mult ui-outline ui-num" data-now="">×{offer.multiplier}</b>
          <svg className="rebirth-arrow" viewBox="0 0 40 28" aria-hidden="true"><path d="M3 10h20V3l14 11-14 11v-7H3Z" fill="#ffc61a" stroke="#1b2340" strokeWidth="3" strokeLinejoin="round" /></svg>
          <b className="rebirth-mult ui-outline ui-num" data-next="">×{offer.nextMultiplier}</b>
        </div>
        <small>{tr('走完三个世界后可以重生；之后每个世界卖矿都多拿 {x} 倍', { x: offer.nextMultiplier })}</small>
        <ul className="rebirth-needs">
          <li data-done={offer.reached || undefined}><i aria-hidden="true">{offer.reached ? '✓' : ''}</i><Icon kind="portal" />{tr('到达{layerName}', { layerName: offer.layerName })}</li>
          <li data-done={offer.level || undefined}><i aria-hidden="true">{offer.level ? '✓' : ''}</i><Icon kind="pickaxe" />{tr('镐子达到 Lv.{toolLevel}', { toolLevel: offer.toolLevel })}</li>
        </ul>
      </section>
      <div className="rebirth-side">
        <div className="rebirth-terms">
          <section className="rebirth-term" data-kind="lose"><b>{tr('会重置')}</b>
            <span><Icon kind="coin" />{tr('三种货币')}</span><span><Icon kind="pickaxe" />{tr('镐子和背包（回到第一件）')}</span><span><Icon kind="globe" />{tr('开放的世界和地下层')}</span></section>
          <section className="rebirth-term" data-kind="keep"><b>{tr('会保留')}</b>
            <span><Icon kind="paw" />{tr('所有宠物和栏位')}</span><span><Icon kind="gift" />{tr('奖励和加成')}</span></section>
        </div>
        {confirm
          ? <div className="rebirth-confirm"><span>{tr('确定要重生吗？重生后无法撤销。')}</span>
            <div><UiButton size="s" tone="white" onPress={() => setConfirm(false)}>{tr('取消')}</UiButton>
              <UiButton size="s" tone="green" icon="rebirth" disabled={!offer.ready} onPress={go}>{tr('重生')}</UiButton></div></div>
          : <UiButton size="l" tone="green" icon="rebirth" className="rebirth-go" disabled={!offer.ready} onPress={() => setConfirm(true)}>{tr('重生')}</UiButton>}
        {message && <p className="ui-hint" role="status">{message}</p>}
      </div>
    </div>
  </Sheet>;
}

/** The flourish after a rebirth: the new multiplier, big, on spinning rays for a few seconds (tap to dismiss). */
export function RebirthCelebration({ count, multiplier, onDone }: { count: number; multiplier: number; onDone(): void }) {
  useEffect(() => { const timer = setTimeout(onDone, 3600); return () => clearTimeout(timer); }, [onDone]);
  return <div className="rebirth-celebration" role="status" onPointerDown={onDone}>
    <div className="rebirth-rays" aria-hidden="true" />
    <Icon kind="rebirth" className="ui-icon rebirth-celebration-icon" />
    <strong className="ui-outline">{tr('第 {n} 次重生！', { n: count })}</strong>
    <span className="rebirth-celebration-mult">{tr('卖矿收入')} <b className="ui-outline ui-num">×{multiplier}</b></span>
  </div>;
}
