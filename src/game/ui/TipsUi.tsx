import { useSyncExternalStore, type RefObject } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { Tip } from '../application/Tips.ts';
import type { TipId } from '../logic/Onboarding.ts';
import { GameButton } from './GameButton.tsx';
import { Icon, type IconKind } from './kit/icons.tsx';
import './tips.css';

import { tr } from '../i18n/i18n.ts';
const touchControls = window.matchMedia('(any-pointer: coarse)');
const subscribeTouch = (notify: () => void) => { touchControls.addEventListener('change', notify); return () => touchControls.removeEventListener('change', notify); };
function useTouchControls() { return useSyncExternalStore(subscribeTouch, () => touchControls.matches); }

/** The first-dig tip lives in the world: a ground arrow toward the mine with a label over the mine, then a
 *  glowing ring on a block (GuideMarkerProjector and MiningLessonHighlight place it every frame). */
export function TipMarker({ tip, anchor, hidden, marker }: { tip: Tip | null; anchor: readonly number[] | null; hidden: boolean; marker: RefObject<HTMLDivElement | null> }) {
  const touch = useTouchControls();
  if (hidden || !tip) return null;
  if (tip.anchor === 'dig') return <div key="dig" ref={marker} className="guide-dig-marker" data-input={touch ? 'touch' : 'mouse'} style={{ visibility: 'hidden' }} aria-hidden="true">
    <span className="guide-dig-ring" /><b className="guide-dig-caption">{touch ? tr("msg.press_and_hold_here_to_dig") : tr("msg.point_here_hold_left_mouse")}</b>
  </div>;
  // Just the label over the mine while it is in view; the ground arrow leads the way otherwise.
  if (tip.anchor === 'mine' && anchor) return <div key="mine" ref={marker} className="guide-marker" style={{ visibility: 'hidden' }} aria-hidden="true">
    <b>{tr("msg.go_dig_in_the_pit")}</b>
  </div>;
  return null;
}

const HUD_TIPS: Partial<Record<TipId, [IconKind, string, string]>> = {
  shop: ['chest', tr("msg.enough_gold_upgrade_your_pickaxe_in_the_shop"), tr("msg.tip_go_shop")],
  pets: ['paw', tr("msg.tip_first_egg"), tr("msg.tip_go_egg")],
  station: ['portal', tr("msg.tip_station"), tr("msg.tip_go_station")],
  portal: ['globe', tr("msg.tip_portal"), tr("msg.tip_view_ticket")],
  world2: ['globe', tr("msg.tip_world_ready", { world: tr("msg.world_2") }), tr("msg.tip_go_portal")],
  world3: ['globe', tr("msg.tip_world_ready", { world: tr("msg.world_3") }), tr("msg.tip_go_portal")],
};
/** One optional suggestion with a direct route to its entrance; closing is a separate touch target. */
export function TipToast({ session, tip }: { session: GameSession; tip: Tip | null }) {
  const content = tip && HUD_TIPS[tip.id];
  if (!tip || !content) return null;
  return <aside className="ui-tip" data-tip={tip.id}>
    <GameButton className="ui-tip-go" onPress={() => session.followTip(tip.id)}>
      <Icon kind={content[0]} /><span>{content[1]}<b>{content[2]} <span aria-hidden="true">→</span></b></span>
    </GameButton>
    <GameButton className="ui-tip-close" aria-label={tr("msg.tip_dismiss")} onPress={() => session.dismissTip(tip.id)}><span aria-hidden="true">×</span></GameButton>
  </aside>;
}

