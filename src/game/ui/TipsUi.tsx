import { useSyncExternalStore, type RefObject } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { DepthGoal, Tip } from '../application/Tips.ts';
import type { TipId } from '../logic/Onboarding.ts';
import { GameButton } from './GameButton.tsx';
import { Icon, type IconKind } from './kit/icons.tsx';
import './tips.css';
import arrowUrl from '../assets/guide-arrow/roblox-arrow-v1.webp';

const touchControls = window.matchMedia('(any-pointer: coarse)');
const subscribeTouch = (notify: () => void) => { touchControls.addEventListener('change', notify); return () => touchControls.removeEventListener('change', notify); };
function useTouchControls() { return useSyncExternalStore(subscribeTouch, () => touchControls.matches); }

/** The first-dig tip lives in the world: an arrow toward the mine, then a glowing ring on a block
 *  (GuideMarkerProjector and MiningLessonHighlight place it every frame). */
export function TipMarker({ tip, anchor, hidden, marker }: { tip: Tip | null; anchor: readonly number[] | null; hidden: boolean; marker: RefObject<HTMLDivElement | null> }) {
  const touch = useTouchControls();
  if (hidden || !tip) return null;
  if (tip.anchor === 'dig') return <div key="dig" ref={marker} className="guide-dig-marker" data-input={touch ? 'touch' : 'mouse'} style={{ visibility: 'hidden' }} aria-hidden="true">
    <span className="guide-dig-ring" /><b className="guide-dig-caption">{touch ? '长按这里挖矿' : '鼠标移到这里 · 按住左键'}</b>
  </div>;
  if (tip.anchor === 'mine' && anchor) return <div key="mine" ref={marker} className="guide-marker" style={{ visibility: 'hidden' }} aria-hidden="true">
    <span className="guide-marker-arrow"><img src={arrowUrl} className="guide-arrow-image" alt="" /></span><b>去矿坑挖矿</b><small className="guide-offscreen">朝这个方向</small>
  </div>;
  return null;
}

const HUD_TIPS: Partial<Record<TipId, [IconKind, string]>> = {
  sell: ['coin', '背包满了，点「出售」卖掉'],
  shop: ['chest', '金币够了，去「商店」升级镐子'],
  pets: ['paw', '点「宠物」开蛋，挖得更快'],
};
/** A HUD tip: one short line under the depth while the control it names pulses. Tap to put it away. */
export function TipToast({ session, tip }: { session: GameSession; tip: Tip | null }) {
  const content = tip && HUD_TIPS[tip.id];
  if (!tip || !content) return null;
  return <GameButton className="ui-tip" data-tip={tip.id} aria-label={`提示：${content[1]}（点按收起）`} onPress={() => session.dismissTip(tip.id)}>
    <Icon kind={content[0]} /><span>{content[1]}</span>
  </GameButton>;
}

/** Where the next layer is: a slim progress line, not a task list. */
export function DepthGoalCard({ goal }: { goal: DepthGoal | null }) {
  if (!goal) return null;
  return <aside className="journey-goals" aria-label="探索目标" data-testid="journey-goals">
    <div className="journey-depth"><span className="guide-kicker">下一层</span><strong>{goal.name}</strong>
      <p>{Math.floor(goal.currentDepth)} / {goal.depth} 米</p>
      <progress aria-label={`解锁${goal.name}的深度进度`} value={goal.currentDepth} max={goal.depth} /></div>
  </aside>;
}
