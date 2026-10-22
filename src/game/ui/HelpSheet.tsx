import { useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import { UiButton } from './kit/controls.tsx';
import { Icon, type IconKind } from './kit/icons.tsx';
import { Sheet } from './kit/panel.tsx';
import './help.css';

const touch = window.matchMedia('(any-pointer: coarse)');
const subscribeTouch = (notify: () => void) => { touch.addEventListener('change', notify); return () => touch.removeEventListener('change', notify); };

/** How to play, as six picture cards instead of a manual. */
export function HelpSheet({ session, onClose }: { session: GameSession; onClose(): void }) {
  const coarse = useSyncExternalStore(subscribeTouch, () => touch.matches);
  const status = useSyncExternalStore(session.subscribe, () => session.getSnapshot().onboarding.status);
  const tips: [IconKind, string, string][] = [
    ['jump', '移动', coarse ? '左边摇杆走路，右下跳跃，右侧空白处拖动看四周' : 'WASD 走路，空格跳跃，按住右键拖动看四周'],
    ['pickaxe', '挖矿', coarse ? '点一下敲击，按住持续挖，矿石自动进背包' : '鼠标指向方块，按住左键挖，矿石自动进背包'],
    ['coin', '出售', '背包满了点「出售」，或走进金色圆圈自动卖掉'],
    ['chest', '升级', '在商店换更强的镐子和更大的背包'],
    ['paw', '宠物', '去蛋台开蛋，装备宠物增加挖矿力量'],
    ['portal', '深度', '越往下矿越值钱，到达新深度解锁传送和新蛋'],
  ];
  return <Sheet title="怎么玩" size="m" onClose={onClose} label="操作帮助" className="help-sheet" footer={<>
    <span className="ui-hint">{status === 'active' ? '新手引导进行中' : status === 'completed' ? '新手引导已完成，自由探索吧' : '新手引导已关闭'}</span><span className="ui-grow" />
    {status === 'active' && <UiButton size="s" tone="steel" onPress={() => { session.skipOnboarding(); onClose(); }}>跳过引导</UiButton>}
    {(status === 'skipped' || status === 'legacy') && <UiButton size="s" tone="green" onPress={() => { session.resumeOnboarding(); onClose(); }}>{status === 'legacy' ? '开启引导' : '继续引导'}</UiButton>}
    <UiButton size="s" tone="orange" onPress={onClose}>知道了</UiButton>
  </>}>
    <div className="help-tips">{tips.map(([icon, title, text]) => <div key={title} className="ui-card-tile help-tip">
      <Icon kind={icon} className="ui-icon help-tip-art" /><div><h4 className="ui-outline">{title}</h4><p>{text}</p></div>
    </div>)}</div>
  </Sheet>;
}
