import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import { UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Sheet } from '../kit/panel.tsx';
import './rebirth.css';

import { tr } from '../../i18n/i18n.ts';
/** The rebirth panel: what it takes (the whole journey: world 3's last layer and the last pickaxe), what goes and
 *  what stays, and the income multiplier now and after. Rebirthing asks once more ("cannot be undone"). */
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
  const missing = [!offer.reached && tr('到达{layerName}', { layerName: offer.layerName }), !offer.level && tr('镐子达到 Lv.{toolLevel}', { toolLevel: offer.toolLevel })].filter(Boolean).join(tr('，'));
  const footer = confirm
    ? <><span className="ui-hint rebirth-warning">{tr('确定要重生吗？重生后无法撤销。')}</span><span className="ui-grow" />
      <UiButton size="s" tone="steel" onPress={() => setConfirm(false)}>{tr('取消')}</UiButton>
      <UiButton size="s" tone="green" icon="rebirth" disabled={!offer.ready} onPress={go}>{tr('重生')}</UiButton></>
    : <><span className="ui-hint" role="status">{message || (offer.ready ? tr('条件满足，可以重生了！') : tr('还需要：{missing}', { missing: missing }))}</span><span className="ui-grow" />
      <UiButton size="m" tone={offer.ready ? 'green' : 'steel'} icon="rebirth" disabled={!offer.ready} onPress={() => setConfirm(true)}>{tr('重生')}</UiButton></>;
  return <Sheet title={tr('重生')} subtitle={offer.count ? tr('已重生 {count} 次', { count: offer.count }) : undefined} size="m" onClose={onClose} className="rebirth-sheet" footer={footer}>
    <div className="rebirth-boost ui-well">
      <span className="rebirth-boost-label ui-outline">{tr('卖矿收益')}</span>
      <b className="rebirth-mult ui-outline" data-now="">×{offer.multiplier}</b>
      <svg className="rebirth-arrow" viewBox="0 0 40 28" aria-hidden="true"><path d="M3 10h20V3l14 11-14 11v-7H3Z" fill="#ffd24d" stroke="#13355d" strokeWidth="3" strokeLinejoin="round" /></svg>
      <b className="rebirth-mult ui-outline" data-next="">×{offer.nextMultiplier}</b>
      <small>{tr('走完三个世界后可以重生；之后每个世界卖矿都多拿 {x} 倍', { x: offer.nextMultiplier })}</small>
    </div>
    <div className="rebirth-terms">
      <div className="rebirth-term" data-kind="lose"><b className="ui-outline">{tr('会重置')}</b>
        <span><Icon kind="coin" />{tr('三种货币')}</span><span><Icon kind="pickaxe" />{tr('镐子和背包（回到第一件）')}</span><span><Icon kind="globe" />{tr('开放的世界和地下层')}</span></div>
      <div className="rebirth-term" data-kind="keep"><b className="ui-outline">{tr('会保留')}</b>
        <span><Icon kind="paw" />{tr('所有宠物和栏位')}</span><span><Icon kind="gift" />{tr('奖励和加成')}</span></div>
    </div>
  </Sheet>;
}

/** The flourish after a rebirth: the new multiplier, big, for a few seconds (tap to dismiss). */
export function RebirthCelebration({ count, multiplier, onDone }: { count: number; multiplier: number; onDone(): void }) {
  useEffect(() => { const timer = setTimeout(onDone, 3600); return () => clearTimeout(timer); }, [onDone]);
  return <div className="rebirth-celebration" role="status" onPointerDown={onDone}>
    <div className="rebirth-burst" aria-hidden="true" />
    <Icon kind="rebirth" className="ui-icon rebirth-celebration-icon" />
    <strong className="ui-outline">{tr('第 {n} 次重生！', { n: count })}</strong>
    <span className="ui-outline">{tr('卖矿收益')} <b>×{multiplier}</b></span>
  </div>;
}
