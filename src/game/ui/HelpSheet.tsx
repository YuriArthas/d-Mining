import { useSyncExternalStore } from 'react';
import { UiButton } from './kit/controls.tsx';
import { Icon, type IconKind } from './kit/icons.tsx';
import { Sheet } from './kit/panel.tsx';
import './help.css';

import { tr } from '../i18n/i18n.ts';
const touch = window.matchMedia('(any-pointer: coarse)');
const subscribeTouch = (notify: () => void) => { touch.addEventListener('change', notify); return () => touch.removeEventListener('change', notify); };

/** How to play, as six picture cards instead of a manual. */
export function HelpSheet({ onClose }: { onClose(): void }) {
  const coarse = useSyncExternalStore(subscribeTouch, () => touch.matches);
  const tips: [IconKind, string, string][] = [
    ['jump', tr('移动'), coarse ? tr('左边摇杆走路，右下跳跃，右侧空白处拖动看四周') : tr('WASD 走路，空格跳跃，按住右键拖动看四周')],
    ['pickaxe', tr('挖矿'), coarse ? tr('点一下敲击，按住持续挖，矿石自动进背包') : tr('鼠标指向方块，按住左键挖，矿石自动进背包')],
    ['coin', tr('出售'), tr('背包满了点「出售」，或走进金色圆圈自动卖掉')],
    ['chest', tr('升级'), tr('在商店换更强的镐子和更大的背包')],
    ['paw', tr('宠物'), tr('去蛋台开蛋：宠物在自己的世界加卖矿收入，在哪里都加挖矿速度')],
    ['portal', tr('深度'), tr('每层要求一定等级的镐子；到达新层解锁传送和新蛋')],
    ['globe', tr('世界'), tr('每个世界有自己的货币；在世界传送门用上一世界的货币和矿物解锁新世界')],
  ];
  return <Sheet title={tr('怎么玩')} size="m" onClose={onClose} label={tr('操作帮助')} className="help-sheet" footer={<>
    <span className="ui-grow" /><UiButton size="s" tone="orange" onPress={onClose}>{tr('知道了')}</UiButton>
  </>}>
    <div className="help-tips">{tips.map(([icon, title, text]) => <div key={title} className="ui-card-tile help-tip">
      <Icon kind={icon} className="ui-icon help-tip-art" /><div><h4 className="ui-outline">{title}</h4><p>{text}</p></div>
    </div>)}</div>
  </Sheet>;
}
