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
    setMessage(result.status === 'locked' ? tr("msg.not_ready_yet_nothing_changed") : tr("msg.please_try_again_in_a_moment"));
  };
  return <Sheet title={tr("msg.rebirth")} subtitle={offer.count ? tr("msg.reborn_count_times", { count: offer.count }) : undefined} onClose={onClose} className="rebirth-sheet">
    <div className="rebirth-layout">
      <section className="rebirth-boost" aria-label={tr("msg.ore_income")}>
        <span className="rebirth-boost-label">{tr("msg.ore_income")}</span>
        <div className="rebirth-mults">
          <b className="rebirth-mult ui-outline ui-num" data-now="">×{offer.multiplier}</b>
          <svg className="rebirth-arrow" viewBox="0 0 40 28" aria-hidden="true"><path d="M3 10h20V3l14 11-14 11v-7H3Z" fill="#ffc61a" stroke="#1b2340" strokeWidth="3" strokeLinejoin="round" /></svg>
          <b className="rebirth-mult ui-outline ui-num" data-next="">×{offer.nextMultiplier}</b>
        </div>
        <small>{tr("msg.finish_all_three_worlds_to_be_reborn_after_that_ore_sells_fo", { x: offer.nextMultiplier })}</small>
        <ul className="rebirth-needs">
          <li data-done={offer.reached || undefined}><i aria-hidden="true">{offer.reached ? '✓' : ''}</i><Icon kind="portal" />{tr("msg.reach_layername", { layerName: offer.layerName })}</li>
          <li data-done={offer.level || undefined}><i aria-hidden="true">{offer.level ? '✓' : ''}</i><Icon kind="pickaxe" />{tr("msg.needs_named_pickaxe", { name: state.shopCatalog.tools[offer.toolLevel - 1].name })}</li>
        </ul>
      </section>
      <div className="rebirth-side">
        <div className="rebirth-terms">
          <section className="rebirth-term" data-kind="lose"><b>{tr("msg.reset")}</b>
            <span><Icon kind="coin" />{tr("msg.three_currencies")}</span><span><Icon kind="pickaxe" />{tr("msg.pickaxe_and_backpack_back_to_the_first_ones")}</span><span><Icon kind="globe" />{tr("msg.open_worlds_and_layers")}</span></section>
          <section className="rebirth-term" data-kind="keep"><b>{tr("msg.kept")}</b>
            <span><Icon kind="paw" />{tr("msg.all_pets_and_slots")}</span><span><Icon kind="gift" />{tr("msg.rewards_and_boosts")}</span></section>
        </div>
        {confirm
          ? <div className="rebirth-confirm"><span>{tr("msg.are_you_sure_you_want_to_be_reborn_this_can_t_be_undone")}</span>
            <div><UiButton size="s" tone="white" onPress={() => setConfirm(false)}>{tr("msg.cancel")}</UiButton>
              <UiButton size="s" tone="green" icon="rebirth" disabled={!offer.ready} onPress={go}>{tr("msg.rebirth")}</UiButton></div></div>
          : <UiButton size="l" tone="green" icon="rebirth" className="rebirth-go" disabled={!offer.ready} onPress={() => setConfirm(true)}>{tr("msg.rebirth")}</UiButton>}
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
    <strong className="ui-outline">{tr("msg.rebirth_n", { n: count })}</strong>
    <span className="rebirth-celebration-mult">{tr("msg.ore_income")} <b className="ui-outline ui-num">×{multiplier}</b></span>
  </div>;
}
