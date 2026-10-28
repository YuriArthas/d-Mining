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
    ['jump', '#2fb4ff', tr('移动'), coarse ? tr('左边摇杆走，右下角跳') : tr('WASD 走，空格跳')],
    ['pickaxe', '#ff9f1a', tr('挖矿'), coarse ? tr('按住方块一直挖') : tr('按住左键一直挖')],
    ['coin', '#3fc93a', tr('出售'), tr('背包满了点「出售」')],
    ['chest', '#2fb4ff', tr('升级'), tr('商店换更强的镐子')],
    ['paw', '#ff9f1a', tr('宠物'), tr('开蛋得宠物，赚得更多')],
    ['portal', '#9b6bff', tr('深度'), tr('挖到新层，解锁传送和新蛋')],
    ['globe', '#3fc93a', tr('世界'), tr('集齐门票，去下一个世界')],
    ['gift', '#9b6bff', tr('奖励'), tr('在线和签到领幸运币，去扭蛋机抽奖')],
  ];
  return <Sheet title={tr('怎么玩')} size="m" onClose={onClose} label={tr('操作帮助')} className="help-sheet">
    <ol className="help-tips">{tips.map(([icon, color, title, text], i) => <li key={title} className="help-tip" style={{ '--c': color } as CSSProperties}>
      <span className="help-tip-num ui-num">{i + 1}</span>
      <Icon kind={icon} className="ui-icon help-tip-art" />
      <b>{title}</b>
      <p>{text}</p>
    </li>)}</ol>
  </Sheet>;
}
