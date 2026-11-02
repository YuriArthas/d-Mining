import { useSyncExternalStore, type CSSProperties } from 'react';
import { Icon, type IconKind } from './kit/icons.tsx';
import { Sheet } from './kit/panel.tsx';
import { tr } from '../i18n/i18n.ts';
import './help.css';

const touch = window.matchMedia('(any-pointer: coarse)');
const subscribeTouch = (notify: () => void) => { touch.addEventListener('change', notify); return () => touch.removeEventListener('change', notify); };

/** How to play (docs/draft-ui-v2.md, U8): eight picture cards on one screen, one short line each, in the order a new
 *  player meets them. Each card's colour is the colour of the button or place it talks about. */
export function HelpSheet({ onClose }: { onClose(): void }) {
  const coarse = useSyncExternalStore(subscribeTouch, () => touch.matches);
  const tips: [IconKind, string, string, string][] = [
    ['jump', '#2fb4ff', tr("msg.move"), coarse ? tr("msg.left_stick_to_walk_bottom_right_to_jump") : tr("msg.wasd_to_walk_space_to_jump")],
    ['pickaxe', '#ff9f1a', tr("msg.mining"), coarse ? tr("msg.hold_a_block_to_dig") : tr("msg.hold_left_mouse_to_dig")],
    ['coin', '#3fc93a', tr("msg.sell"), tr("msg.bag_full_tap_sell")],
    ['chest', '#2fb4ff', tr("msg.upgrade"), tr("msg.buy_stronger_pickaxes_in_the_shop")],
    ['paw', '#ff9f1a', tr("msg.pets"), tr("msg.hatch_eggs_for_pets_that_earn_more")],
    ['portal', '#9b6bff', tr("msg.depth"), tr("msg.reach_a_new_layer_to_unlock_its_teleport_and_egg")],
    ['globe', '#3fc93a', tr("msg.worlds"), tr("msg.collect_the_ticket_go_to_the_next_world")],
    ['gift', '#9b6bff', tr("msg.rewards"), tr("msg.play_and_sign_in_for_lucky_coins_spin_at_the_machine")],
  ];
  return <Sheet title={tr("msg.how_to_play")} size="m" onClose={onClose} label={tr("msg.how_to_play_7a328466")} className="help-sheet">
    <ol className="help-tips">{tips.map(([icon, color, title, text], i) => <li key={title} className="help-tip" style={{ '--c': color } as CSSProperties}>
      <span className="help-tip-num ui-num">{i + 1}</span>
      <Icon kind={icon} className="ui-icon help-tip-art" />
      <b>{title}</b>
      <p>{text}</p>
    </li>)}</ol>
  </Sheet>;
}
