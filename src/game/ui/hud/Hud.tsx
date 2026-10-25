import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import { formatDepth, formatNumber as number } from '../../presentation/formatNumber.ts';
import { Pill, Tile, UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { OrePickupFeed } from '../OrePickupFeed.tsx';
import { teamCanImprove } from '../bag/BagSheet.tsx';
import { claimableRewards } from '../rewards/RewardsSheet.tsx';
import { SystemMenu, type SystemControls } from './SystemMenu.tsx';
import { TipToast } from '../TipsUi.tsx';
import './hud.css';
import { currencyIcon, currencyName } from '../currency.ts';

type HudActions = {
  openPets(): void; openShop(): void; openBackpacks(): void; openRewards(): void; openMinerals(): void; openHelp(): void; openRebirth(): void;
};

/** Screen-space HUD. Zones mirror the original: resources left, depth top-centre, four
 *  actions down the right edge, Sell / Surface trips at the bottom when they help. The block
 *  being mined and fresh pickups stack under the depth, clear of the miner in the lower middle. */
export function Hud({ session, actions, system, objective, target, prompts, tipHidden = false }: {
  session: GameSession; actions: HudActions; system: SystemControls;
  objective?: ReactNode; target?: ReactNode; prompts?: ReactNode; tipHidden?: boolean;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const pets = useSyncExternalStore(session.pets.subscribe, session.pets.getSnapshot);
  const run = (action: () => void) => () => action();
  const claimable = claimableRewards(state.rewards);
  const bag = state.inventory;
  const world = state.worlds.find(w => w.id === state.currentWorld)?.name ?? `世界 ${state.currentWorld}`;
  // Location is null until the first physics step; the game always starts on the surface.
  const surface = state.location !== 'mine' && state.location !== 'room';
  const depth = surface ? '地表' : formatDepth(state.depth);
  const { speed, luck, sell } = state.rewards.timed;
  // HUD tips name a control on screen; the first-dig tip is drawn in the world instead.
  const tip = !tipHidden && state.tip && state.tip.anchor !== 'mine' && state.tip.anchor !== 'dig' ? state.tip : null;
  return <div className="ui-hud" data-location={state.location ?? 'surface'} data-tip={tip?.id}>
    <section className="hud-left" aria-label="资源与目标">
      <Pill icon="backpack" meter={bag.capacity > 0 ? bag.used / bag.capacity : 0} state={bag.isFull ? 'full' : undefined}
        onPress={run(actions.openMinerals)} pressLabel="查看背包里的矿物" plus={{ label: '升级背包', onPress: run(actions.openBackpacks) }}>
        <span data-testid="bag-count" aria-label={`背包容量 ${number(bag.used)} / ${number(bag.capacity)}`}>{number(bag.used)} / {number(bag.capacity)}</span>
      </Pill>
      <Pill icon={currencyIcon(state.currency)} tone="gold"><span data-testid="coins" aria-label={`${currencyName(state.currency)} ${number(state.coins)}`}>{number(state.coins)}</span>
        {state.rebirth.multiplier > 1 && <b className="hud-coin-mult ui-outline" aria-label={`重生收益 ${state.rebirth.multiplier} 倍`}>×{state.rebirth.multiplier}</b>}</Pill>
      {(speed > 0 || luck > 0 || sell > 0) && <div className="hud-buffs">
        {speed > 0 && <span className="ui-toast"><Icon kind="bolt" />移速 ×2 · {Math.ceil(speed)} 秒</span>}
        {luck > 0 && <span className="ui-toast"><Icon kind="clover" />稀有率 ×2 · {Math.ceil(luck)} 秒</span>}
        {sell > 0 && <span className="ui-toast"><Icon kind={currencyIcon(state.currency)} />出售 ×2 · {Math.ceil(sell)} 秒</span>}
      </div>}
      {objective && <div className="hud-objective">{objective}</div>}
    </section>

    <div className="hud-center">
      <header className="hud-depth" aria-label={`${world}，${surface ? '地表' : `深度 ${Math.floor(state.depth)} 米`}`}>
        <span className="hud-depth-kicker ui-outline">{world} · 深度</span>
        <strong className="hud-depth-value ui-outline ui-num" data-testid="depth">{depth}</strong>
      </header>
      <TipToast session={session} tip={tip} />
      {target}
      <OrePickupFeed session={session} />
    </div>

    <SystemMenu system={system} onHelp={run(actions.openHelp)} />

    <nav className="hud-rail" aria-label="游戏功能">
      <Tile icon="paw" label="宠物" aria-label="打开我的宠物" data-tip-target="pets" badge={teamCanImprove(pets) ? '!' : undefined} onPress={run(actions.openPets)} />
      <Tile icon="chest" label="商店" tone="orange" aria-label="商店" data-kind="upgrade" data-tip-target="shop" onPress={run(actions.openShop)} />
      <Tile icon="gift" label="奖励" tone="pink" aria-label={claimable ? `奖励，${claimable} 个可领取` : '奖励'} badge={claimable || undefined} onPress={run(actions.openRewards)} />
      {state.rebirth.shown && <Tile icon="rebirth" label="重生" tone="green" aria-label={state.rebirth.ready ? '重生，可以重生了' : '重生'} badge={state.rebirth.ready ? '!' : undefined} onPress={run(actions.openRebirth)} />}
    </nav>

    <div className="hud-bottom">
      {prompts}
      {/* The one-time sell tip already says it; do not repeat the full-bag notice under it. */}
      <HudNotice text={tip?.id === 'sell' && state.inventory.isFull ? '' : state.notice} />
      {(bag.used > 0 && !state.inSellZone || !surface) && <div className="hud-trips">
        {bag.used > 0 && !state.inSellZone && <UiButton className="hud-sell" size="l" tone="green" icon={currencyIcon(state.currency)} data-state={bag.isFull ? 'full' : undefined} aria-label="传送到售卖圈出售" onPress={() => { session.dismissTip('sell'); session.goTo('sale'); }}>出售</UiButton>}
        {!surface && <UiButton className="hud-return" size="l" icon="home" onPress={run(session.returnToSurface)}>返回地表</UiButton>}
      </div>}
    </div>
  </div>;
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
