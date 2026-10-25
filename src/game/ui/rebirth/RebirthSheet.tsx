import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Sheet } from '../kit/panel.tsx';
import './rebirth.css';

/** The rebirth panel: what goes and what stays, the coin multiplier now and after, and the price on the button.
 *  Rebirthing asks once more ("cannot be undone") before it spends anything. */
export function RebirthSheet({ session, onClose, onReborn }: { session: GameSession; onClose(): void; onReborn(count: number, multiplier: number): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const offer = state.rebirth;
  const [confirm, setConfirm] = useState(false), [message, setMessage] = useState('');
  const go = () => {
    const result = session.rebirth(offer.count);
    setConfirm(false);
    if (result.status === 'reborn') { onReborn(result.count, result.multiplier); onClose(); return; }
    setMessage(result.status === 'insufficient' ? '金币不够，没有扣除任何东西' : result.status === 'max' ? '已经达到重生上限' : '请稍后再试');
  };
  const price = offer.cost === null ? '—' : number(offer.cost);
  const short = offer.cost === null ? 0 : Math.max(0, offer.cost - state.coins);
  const footer = confirm
    ? <><span className="ui-hint rebirth-warning">确定要重生吗？重生后无法撤销。</span><span className="ui-grow" />
      <UiButton size="s" tone="steel" onPress={() => setConfirm(false)}>取消</UiButton>
      <UiButton size="s" tone="green" icon="coin" disabled={!offer.canAfford} onPress={go}>{price}</UiButton></>
    : <><span className="ui-hint" role="status">{message || (offer.canAfford ? '条件满足，可以重生了！' : offer.cost === null ? '已经达到重生上限' : `还差 ${number(short)} 金币`)}</span><span className="ui-grow" />
      <UiButton size="m" tone={offer.canAfford ? 'green' : 'red'} icon="coin" disabled={!offer.canAfford} aria-label={`重生，${price} 金币`} onPress={() => setConfirm(true)}>{price}</UiButton></>;
  return <Sheet title="重生" subtitle={offer.count ? `已重生 ${offer.count} 次` : undefined} size="m" onClose={onClose} className="rebirth-sheet" footer={footer}>
    <div className="rebirth-boost ui-well">
      <span className="rebirth-boost-label ui-outline">金币收益</span>
      <b className="rebirth-mult ui-outline" data-now="">×{offer.multiplier}</b>
      <svg className="rebirth-arrow" viewBox="0 0 40 28" aria-hidden="true"><path d="M3 10h20V3l14 11-14 11v-7H3Z" fill="#ffd24d" stroke="#13355d" strokeWidth="3" strokeLinejoin="round" /></svg>
      <b className="rebirth-mult ui-outline" data-next="">×{offer.nextMultiplier}</b>
      <small>重生后卖出的矿石，每一块都值 {offer.nextMultiplier} 倍金币</small>
    </div>
    <div className="rebirth-terms">
      <div className="rebirth-term" data-kind="lose"><b className="ui-outline">会失去</b>
        <span><Icon kind="coin" />全部金币</span><span><Icon kind="pickaxe" />工具（回到老木镐）</span><span><Icon kind="backpack" />背包和里面的矿（回到麻布袋）</span></div>
      <div className="rebirth-term" data-kind="keep"><b className="ui-outline">会保留</b>
        <span><Icon kind="paw" />所有宠物</span><span><Icon kind="globe" />已开放的世界和地下层</span><span><Icon kind="gift" />奖励和加成</span></div>
    </div>
  </Sheet>;
}

/** The flourish after a rebirth: the new multiplier, big, for a few seconds (tap to dismiss). */
export function RebirthCelebration({ count, multiplier, onDone }: { count: number; multiplier: number; onDone(): void }) {
  useEffect(() => { const timer = setTimeout(onDone, 3600); return () => clearTimeout(timer); }, [onDone]);
  return <div className="rebirth-celebration" role="status" onPointerDown={onDone}>
    <div className="rebirth-burst" aria-hidden="true" />
    <Icon kind="rebirth" className="ui-icon rebirth-celebration-icon" />
    <strong className="ui-outline">第 {count} 次重生！</strong>
    <span className="ui-outline">金币收益 <b>×{multiplier}</b></span>
  </div>;
}
