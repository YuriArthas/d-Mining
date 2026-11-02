import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import { depthRoutePosition } from './depthRoute.ts';
import chestMedallion from '../../assets/hud/depth-chest.webp';
import crystalMedallion from '../../assets/hud/depth-crystal.webp';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { uiTimeScale } from '../../presentation/MiningOverlay.ts';
import { SALE_FLIGHT } from '../../presentation/saleFlight.ts';
import { CountUp, Pill, Tile, UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { teamCanImprove } from '../bag/BagSheet.tsx';
import { claimableRewards } from '../rewards/RewardsSheet.tsx';
import { SystemMenu, type SystemControls } from './SystemMenu.tsx';
import { TipToast } from '../TipsUi.tsx';
import { GameButton } from '../GameButton.tsx';
import './hud.css';
import { currencyIcon, currencyName } from '../currency.ts';

import { tr } from '../../i18n/i18n.ts';

/** Testing tools (the performance report) show only with ?debug=1. */
type HudActions = {
  openPets(): void; openShop(): void; openBackpacks(): void; openRewards(): void; openMinerals(): void; openHelp(): void; openRebirth(): void;
};

/** Screen-space HUD (docs/draft-ui-v2.md, U2). Phone landscape first, and the middle of the screen stays clear for
 *  the miner and the pit:
 *  - top left: the world's money and the bag, with the two trips (sell, back to the surface) small underneath;
 *  - top centre: the depth route, current-depth pointer and discovered halls, then buffs and a contextual tip (the block being mined has its plate over it, MiningOverlay);
 *  - top right: one menu (help and settings), then one column of equal tiles: pets, shop, rewards, and rebirth
 *    once it shows (last, so the others never move);
 *  - bottom centre: what the spot you stand on offers (an egg, the capsule machine) and short notices;
 *  - bottom left: a small button that reports performance (on touch screens a round icon beside the thumbstick). */
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
  // Something to sell: locked ore stays in the bag and does not count.
  const showSell = state.sale.status === 'quoted' && state.sale.count > 0 && !state.inSellZone;
  const showSellGuide = showSell && bag.isFull && !tipHidden;
  // The full-bag guide lives beside Sell and takes priority over the timed HUD tips.
  const tip = !tipHidden && !showSellGuide && state.tip && state.tip.id !== 'sell' && state.tip.anchor !== 'mine' && state.tip.anchor !== 'dig' ? state.tip : null;
  const goSell = () => { session.dismissTip('sell'); session.goTo('sale'); };
  // A sale's money rolls in as its coins land in the counter (MiningOverlay), not the moment it is made.
  const soldAt = useRef(-Infinity);
  useEffect(() => session.onFeedback(event => { if (event.type === 'sold') soldAt.current = performance.now(); }), [session]);
  const selling = performance.now() - soldAt.current < 250;
  return <div className="ui-hud" data-location={state.location ?? 'surface'} data-tip={tip?.id}>
    <section className="hud-left" aria-label={tr("msg.resources")}>
      <div className="hud-wallet">
        <Pill icon={currencyIcon(state.currency)} className="hud-coins">
          {/* Keyed by currency: a new world's money appears at once instead of rolling from the last world's. */}
          <span data-testid="coins" aria-label={`${currencyName(state.currency)} ${number(state.coins)}`}><CountUp key={state.currency} value={state.coins} format={number}
            {...selling && { delay: SALE_FLIGHT.first * uiTimeScale(), ms: SALE_FLIGHT.stream * uiTimeScale() }} /></span>
          {state.rebirth.multiplier > 1 && <b className="hud-coin-mult" aria-label={tr("msg.rebirth_ore_income_multiplier", { multiplier: state.rebirth.multiplier })}>×{state.rebirth.multiplier}</b>}
        </Pill>
        <Pill icon="backpack" className="hud-bag" meter={bag.capacity > 0 ? bag.used / bag.capacity : 0} state={bag.isFull ? 'full' : undefined}
          onPress={run(actions.openMinerals)} pressLabel={tr("msg.view_the_ore_in_your_bag")} plus={{ label: tr("msg.upgrade_backpack"), onPress: run(actions.openBackpacks) }}>
          <span className="hud-bag-value" data-testid="bag-count" aria-label={tr("msg.bag_capacity_used_capacity", { used: number(bag.used), capacity: number(bag.capacity) })}><span className="hud-bag-label">{tr("msg.capacity")}</span><span>{number(bag.used)}<small>/{number(bag.capacity)}</small></span></span>
        </Pill>
      </div>
      {(showSell || !surface) && <div className="hud-trips">
        {showSell && <div className="hud-sell-group">
          <UiButton className="hud-sell" size="s" tone="green" icon={currencyIcon(state.currency)} data-state={bag.isFull ? 'full' : undefined} data-tip-target="sell"
            aria-label={tr("msg.teleport_to_the_sell_circle")} onPress={goSell}>{tr("msg.sell")}</UiButton>
          {showSellGuide && <GameButton className="hud-sell-guide" onPress={goSell}>
            <svg className="hud-sell-arrow" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
              <path d="M3 20 18 5v9h18v12H18v9Z" />
            </svg>
            <span>{tr("msg.bag_full_tap_sell_61f94b67")}</span>
          </GameButton>}
        </div>}
        {!surface && <UiButton className="hud-return" size="s" tone="blue" icon="home" onPress={run(session.returnToSurface)}>{tr("msg.surface")}</UiButton>}
      </div>}
    </section>

    <div className="hud-center">
      <Whereabouts session={session} title={world?.title ?? ''} kicker={world?.name ?? ''} surface={surface} />
      {(speed > 0 || luck > 0 || sell > 0) && <div className="hud-buffs">
        {speed > 0 && <span className="hud-buff"><Icon kind="bolt" />{tr("msg.speed_2")}<b className="ui-num">{clock(speed)}</b></span>}
        {luck > 0 && <span className="hud-buff"><Icon kind="clover" />{tr("msg.rare_chance_2")}<b className="ui-num">{clock(luck)}</b></span>}
        {sell > 0 && <span className="hud-buff"><Icon kind={currencyIcon(state.currency)} />{tr("msg.sell_2")}<b className="ui-num">{clock(sell)}</b></span>}
      </div>}
      <TipToast session={session} tip={tip} />
    </div>

    <SystemMenu system={system} onHelp={run(actions.openHelp)} />

    <nav className="hud-rail" aria-label={tr("msg.game_functions")}>
      <Tile icon="paw" label={tr("msg.pets")} tone="orange" aria-label={tr("msg.open_my_pets")} data-tip-target="pets" badge={teamCanImprove(pets) ? '!' : undefined} onPress={run(actions.openPets)} />
      <Tile icon="chest" label={tr("msg.shop")} tone="blue" aria-label={tr("msg.shop")} data-kind="upgrade" data-tip-target="shop" onPress={run(actions.openShop)} />
      <Tile icon="gift" label={tr("msg.rewards")} tone="purple" aria-label={claimable ? tr("msg.rewards_claimable_to_claim", { claimable: claimable }) : tr("msg.rewards")} data-kind="rewards" badge={claimable || undefined} onPress={run(actions.openRewards)} />
      {state.rebirth.shown && <Tile icon="rebirth" label={tr("msg.rebirth")} tone="green" aria-label={state.rebirth.ready ? tr("msg.rebirth_ready_to_be_reborn") : tr("msg.rebirth")} data-kind="rebirth" badge={state.rebirth.ready ? '!' : undefined} onPress={run(actions.openRebirth)} />}
    </nav>

    <div className="hud-bottom">
      {prompts}
      {/* The one-time sell tip already says it; do not repeat the full-bag notice under it. */}
      {/* Ticket ore says where it went in the chip by the bag (MiningOverlay), so its store notice is not repeated here. */}
      <HudNotice text={showSellGuide || state.noticeKind === 'materials' ? '' : state.notice} />
    </div>

  </div>;
}

const clock = (seconds: number) => { const s = Math.ceil(seconds); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Current position and permanent discoveries share a route, including when back on the surface. */
function Whereabouts({ session, title, kicker, surface }: { session: GameSession; title: string; kicker: string; surface: boolean }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const nodes = [...state.destinations].sort((a,b) => a.depth-b.depth);
  const metres = surface ? 0 : Math.max(0, Math.floor(state.depth));
  const end = nodes.at(-1)?.depth ?? 1;
  const position = depthRoutePosition(metres, nodes);
  return <header className="hud-where" aria-label={`${kicker} · ${title}`}>
    <div className="hud-route" data-testid="journey-goals" role="progressbar" aria-label={tr("msg.depth_route")}
      aria-valuemin={0} aria-valuemax={end} aria-valuenow={Math.min(end,metres)} aria-valuetext={tr("msg.depth_route_value", { depth: metres, end })}>
      <div className="hud-route-track" />
      {nodes.map((node,i) => <span key={node.id} className="hud-route-node" data-unlocked={node.unlocked} data-destination={node.id}
        title={`${node.name} · ${node.depth}${tr("msg.m")}${node.hasShop ? ` · ${tr("msg.shop")}` : ''}`}
        aria-label={tr(node.unlocked ? "msg.depth_node_open" : "msg.depth_node_locked", { name: node.name, depth: node.depth })}
        style={{ left: `${(i+1)/nodes.length*100}%`, '--node-hue': `${i*35}deg` } as CSSProperties}>
        <img src={node.hasShop ? chestMedallion : crystalMedallion} data-kind={node.hasShop ? 'shop' : 'layer'} alt="" draggable={false} />
      </span>)}
      <span className="hud-route-pointer" style={{ left: `${position}%` }}>
        <i aria-hidden="true" /><b className="ui-num" data-testid="depth">{metres}<u>{tr("msg.m")}</u></b>
      </span>
    </div>
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
