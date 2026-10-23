import { useSyncExternalStore, type RefObject } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { DepthGoal, Tip } from '../application/Tips.ts';
import type { TipId } from '../logic/Onboarding.ts';
import { GameButton } from './GameButton.tsx';
import { Icon, type IconKind } from './kit/icons.tsx';
import { Bar } from './kit/panel.tsx';
import './tips.css';

const touchControls = window.matchMedia('(any-pointer: coarse)');
const subscribeTouch = (notify: () => void) => { touchControls.addEventListener('change', notify); return () => touchControls.removeEventListener('change', notify); };
function useTouchControls() { return useSyncExternalStore(subscribeTouch, () => touchControls.matches); }

/** The first-dig tip lives in the world: a ground arrow toward the mine with a label over the mine, then a
 *  glowing ring on a block (GuideMarkerProjector and MiningLessonHighlight place it every frame). */
export function TipMarker({ tip, anchor, hidden, marker }: { tip: Tip | null; anchor: readonly number[] | null; hidden: boolean; marker: RefObject<HTMLDivElement | null> }) {
  const touch = useTouchControls();
  if (hidden || !tip) return null;
  if (tip.anchor === 'dig') return <div key="dig" ref={marker} className="guide-dig-marker" data-input={touch ? 'touch' : 'mouse'} style={{ visibility: 'hidden' }} aria-hidden="true">
    <span className="guide-dig-ring" /><b className="guide-dig-caption">{touch ? '长按这里挖矿' : '鼠标移到这里 · 按住左键'}</b>
  </div>;
  // Just the label over the mine while it is in view; the ground arrow leads the way otherwise.
  if (tip.anchor === 'mine' && anchor) return <div key="mine" ref={marker} className="guide-marker" style={{ visibility: 'hidden' }} aria-hidden="true">
    <b>去矿坑挖矿</b>
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

/** Where the next layer is: one compact strip in the HUD's style (like the resource capsules), not a task list. */
export function DepthGoalCard({ goal }: { goal: DepthGoal | null }) {
  if (!goal) return null;
  const now = Math.floor(goal.currentDepth);
  return <aside className="journey-goals" aria-label="探索目标" data-testid="journey-goals">
    <div className="journey-depth"><span className="guide-kicker ui-outline">下一层</span><strong className="ui-outline">{goal.name}</strong></div>
    <Bar value={now} max={goal.depth} size="s">{now} / {goal.depth} 米</Bar>
  </aside>;
}
