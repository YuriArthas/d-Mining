import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import { selectDepthGoal } from '../../application/Tips.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { CountUp, Pill, Tile, UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { teamCanImprove } from '../bag/BagSheet.tsx';
import { claimableRewards } from '../rewards/RewardsSheet.tsx';
import { SystemMenu, type SystemControls } from './SystemMenu.tsx';
import { TipToast } from '../TipsUi.tsx';
import './hud.css';
import { currencyIcon, currencyName } from '../currency.ts';

import { tr } from '../../i18n/i18n.ts';
type HudActions = {
  openPets(): void; openShop(): void; openBackpacks(): void; openRewards(): void; openMinerals(): void; openHelp(): void; openRebirth(): void;
};

/** Screen-space HUD (docs/draft-ui-v2.md, U2). Phone landscape first, and the middle of the screen stays clear for
 *  the miner and the pit:
 *  - top left: the world's money and the bag, with the two trips (sell, back to the surface) small underneath;
 *  - top centre: where you are (the world's name on the surface; the layer and depth below it) over one thin bar
 *    to the next layer, then buffs and a one-time tip (the block being mined has its plate over it, MiningOverlay);
 *  - top right: one menu (help and settings), then pets and shop large, rebirth and rewards small;
 *  - bottom centre: what the spot you stand on offers (an egg, the capsule machine) and short notices. */
export function Hud({ session, actions, system, prompts, tipHidden = false }: {
  session: GameSession; actions: HudActions; system: SystemControls;
  prompts?: ReactNode; tipHidden?: boolean;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const pets = useSyncExternalStore(session.pets.subscribe, session.pets.getSnapshot);
  const run = (action: () => void) => () => action();
  const claimable = claimableRewards(state.rewards);
  const bag = state.inventory;
  const world = state.worlds.find(w => w.id === state.currentWorld);
  // Location is null until the first physics step; the game always starts on the surface.
  const surface = state.location !== 'mine' && state.location !== 'room';
  const { speed, luck, sell } = state.rewards.timed;
  // HUD tips name a control on screen; the first-dig tip is drawn in the world instead.
  const tip = !tipHidden && state.tip && state.tip.anchor !== 'mine' && state.tip.anchor !== 'dig' ? state.tip : null;
  const showSell = bag.used > 0 && !state.inSellZone;
  return <div className="ui-hud" data-location={state.location ?? 'surface'} data-tip={tip?.id}>
    <section className="hud-left" aria-label={tr('资源')}>
      <div className="hud-wallet">
        <Pill icon={currencyIcon(state.currency)} className="hud-coins">
          {/* Keyed by currency: a new world's money appears at once instead of rolling from the last world's. */}
          <span data-testid="coins" aria-label={`${currencyName(state.currency)} ${number(state.coins)}`}><CountUp key={state.currency} value={state.coins} format={number} /></span>
          {state.rebirth.multiplier > 1 && <b className="hud-coin-mult" aria-label={tr('重生卖矿收入 ×{multiplier}', { multiplier: state.rebirth.multiplier })}>×{state.rebirth.multiplier}</b>}
        </Pill>
        <Pill icon="backpack" className="hud-bag" meter={bag.capacity > 0 ? bag.used / bag.capacity : 0} state={bag.isFull ? 'full' : undefined}
          onPress={run(actions.openMinerals)} pressLabel={tr('查看背包里的矿物')} plus={{ label: tr('升级背包'), onPress: run(actions.openBackpacks) }}>
          <span data-testid="bag-count" aria-label={tr('背包容量 {used} / {capacity}', { used: number(bag.used), capacity: number(bag.capacity) })}>{number(bag.used)}<small>/{number(bag.capacity)}</small></span>
        </Pill>
      </div>
      {(showSell || !surface) && <div className="hud-trips">
        {showSell && <UiButton className="hud-sell" size="s" tone="green" icon={currencyIcon(state.currency)} data-state={bag.isFull ? 'full' : undefined} data-tip-target="sell"
          aria-label={tr('传送到售卖圈出售')} onPress={() => { session.dismissTip('sell'); session.goTo('sale'); }}>{tr('出售')}</UiButton>}
        {!surface && <UiButton className="hud-return" size="s" tone="blue" icon="home" onPress={run(session.returnToSurface)}>{tr('回地表')}</UiButton>}
      </div>}
    </section>

    <div className="hud-center">
      <Whereabouts session={session} title={world?.title ?? ''} kicker={world?.name ?? ''} surface={surface} />
      {(speed > 0 || luck > 0 || sell > 0) && <div className="hud-buffs">
        {speed > 0 && <span className="hud-buff"><Icon kind="bolt" />{tr('移速 ×2')}<b className="ui-num">{clock(speed)}</b></span>}
        {luck > 0 && <span className="hud-buff"><Icon kind="clover" />{tr('稀有率 ×2')}<b className="ui-num">{clock(luck)}</b></span>}
        {sell > 0 && <span className="hud-buff"><Icon kind={currencyIcon(state.currency)} />{tr('出售 ×2')}<b className="ui-num">{clock(sell)}</b></span>}
      </div>}
      <TipToast session={session} tip={tip} />
    </div>

    <SystemMenu system={system} onHelp={run(actions.openHelp)} />

    <nav className="hud-rail" aria-label={tr('游戏功能')}>
      <Tile icon="paw" label={tr('宠物')} tone="orange" className="hud-big" aria-label={tr('打开我的宠物')} data-tip-target="pets" badge={teamCanImprove(pets) ? '!' : undefined} onPress={run(actions.openPets)} />
      <Tile icon="chest" label={tr('商店')} tone="blue" className="hud-big" aria-label={tr('商店')} data-kind="upgrade" data-tip-target="shop" onPress={run(actions.openShop)} />
      <div className="hud-rail-row">
        {state.rebirth.shown && <Tile icon="rebirth" label={tr('重生')} tone="green" aria-label={state.rebirth.ready ? tr('重生，可以重生了') : tr('重生')} badge={state.rebirth.ready ? '!' : undefined} onPress={run(actions.openRebirth)} />}
        <Tile icon="gift" label={tr('奖励')} tone="purple" aria-label={claimable ? tr('奖励，{claimable} 个可领取', { claimable: claimable }) : tr('奖励')} badge={claimable || undefined} onPress={run(actions.openRewards)} />
      </div>
    </nav>

    <div className="hud-bottom">
      {prompts}
      {/* The one-time sell tip already says it; do not repeat the full-bag notice under it. */}
      {/* Ticket ore says where it went in the chip by the bag (MiningOverlay), so its store notice is not repeated here. */}
      <HudNotice text={tip?.id === 'sell' && state.inventory.isFull || state.notice.startsWith(tr('材料仓 +')) ? '' : state.notice} />
    </div>
  </div>;
}

const clock = (seconds: number) => { const s = Math.ceil(seconds); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Where the player is: the world's place name on the surface; underground the layer and the depth. Under it, one
 *  thin bar to the next layer not reached yet (by the deepest point reached), until every layer is open. */
function Whereabouts({ session, title, kicker, surface }: { session: GameSession; title: string; kicker: string; surface: boolean }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const goal = selectDepthGoal(state.maxDepth, state.destinations);
  const layer = state.destinations.filter(d => d.depth <= state.depth).sort((a, b) => a.depth - b.depth).at(-1);
  const metres = Math.floor(state.depth);
  return <header className="hud-where" aria-label={surface ? tr('{kicker}，{title}，地表', { kicker: kicker, title: title }) : tr('{kicker}，{name}，深度 {metres} 米', { kicker: kicker, name: layer?.name ?? title, metres: metres })}>
    {surface
      ? <div className="hud-place"><small>{kicker}</small><b>{title}</b></div>
      : <div className="hud-depth"><small>{layer?.name ?? title}</small><b className="ui-num" data-testid="depth">{metres}<u>{tr('米')}</u></b></div>}
    {goal && <div className="hud-goal" data-testid="journey-goals" role="progressbar" aria-label={tr('下一层 {layer}', { layer: goal.name })} aria-valuemin={0} aria-valuemax={goal.depth} aria-valuenow={Math.floor(goal.currentDepth)}
      style={{ '--v': `${Math.min(100, goal.currentDepth / goal.depth * 100).toFixed(1)}%` } as CSSProperties}>
      <i /><span>{tr('下一层 {layer}', { layer: goal.name })}<em className="ui-num">{tr('{now} / {depth} 米', { now: Math.floor(goal.currentDepth), depth: goal.depth })}</em></span>
    </div>}
  </header>;
}

/** Session notices are transient: show each new message briefly, then clear the stage. */
function HudNotice({ text }: { text: string }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown(text);
    if (!text) return;
    const timer = setTimeout(() => setShown(''), 4500);
    return () => clearTimeout(timer);
  }, [text]);
  return <output className="hud-notice" role="status">{shown && <span className="ui-toast">{shown}</span>}</output>;
}
