import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { Pill, Tile, UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { OrePickupFeed } from '../OrePickupFeed.tsx';
import { SystemMenu, type SystemControls } from './SystemMenu.tsx';
import './hud.css';

export type HudActions = {
  openPets(): void; openShop(): void; openRewards(): void; openWorlds(): void;
  openTravel(): void; openMinerals(): void; openHelp(): void;
};

/** Screen-space HUD. Zones mirror the original: resources left, depth top-centre,
 *  actions down the right edge, the return-to-surface button only underground. */
export function Hud({ session, actions, system, objective, target, prompts }: {
  session: GameSession; actions: HudActions; system: SystemControls;
  objective?: ReactNode; target?: ReactNode; prompts?: ReactNode;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [moreOpen, setMoreOpen] = useState(false);
  const run = (action: () => void) => () => { setMoreOpen(false); action(); };
  const bag = state.inventory;
  const world = state.worlds.find(w => w.id === state.currentWorld)?.name ?? `世界 ${state.currentWorld}`;
  // Location is null until the first physics step; the game always starts on the surface.
  const surface = state.location !== 'mine' && state.location !== 'room';
  const depth = surface ? '地表' : `${number(Math.floor(state.depth))} 米`;
  const { speed, luck } = state.rewards.timed;
  return <div className="ui-hud" data-location={state.location ?? 'surface'}>
    <section className="hud-left" aria-label="资源与目标">
      <Pill icon="backpack" meter={bag.capacity > 0 ? bag.used / bag.capacity : 0} state={bag.isFull ? 'full' : undefined}
        onPress={run(actions.openMinerals)} pressLabel="查看背包里的矿物" plus={{ label: '升级背包', onPress: run(actions.openShop) }}>
        <span data-testid="bag-count" aria-label={`背包容量 ${number(bag.used)} / ${number(bag.capacity)}`}>{number(bag.used)} / {number(bag.capacity)}</span>
      </Pill>
      <Pill icon="coin" tone="gold"><span data-testid="coins" aria-label={`金币 ${number(state.coins)}`}>{number(state.coins)}</span></Pill>
      {(speed > 0 || luck > 0) && <div className="hud-buffs">
        {speed > 0 && <span className="ui-toast"><Icon kind="bolt" />移速 ×2 · {Math.ceil(speed)} 秒</span>}
        {luck > 0 && <span className="ui-toast"><Icon kind="clover" />稀有率 ×2 · {Math.ceil(luck)} 秒</span>}
      </div>}
      {objective && <div className="hud-objective">{objective}</div>}
    </section>

    <header className="hud-depth" aria-label={`${world}，${surface ? '地表' : `深度 ${Math.floor(state.depth)} 米`}`}>
      <span className="hud-depth-kicker ui-outline">{world} · 深度</span>
      <strong className="hud-depth-value ui-outline ui-num" data-testid="depth">{depth}</strong>
    </header>

    <SystemMenu system={system} onHelp={run(actions.openHelp)} />

    <nav className="hud-rail" aria-label="游戏功能">
      <Tile icon="paw" label="宠物" aria-label="打开我的宠物" data-guide-action="pets" onPress={run(actions.openPets)} />
      <Tile icon="chest" label="商店" tone="orange" aria-label="商店" data-kind="upgrade" data-guide-action="upgrade" onPress={run(actions.openShop)} />
      <Tile icon="gift" label="奖励" tone="pink" aria-label={`奖励，幸运币 ${state.rewards.balance}`}
        badge={state.rewards.balance > 0 ? number(state.rewards.balance) : undefined} onPress={run(actions.openRewards)} />
      <div className="hud-more">
        <Tile className="hud-more-toggle" icon="grid" label={moreOpen ? '收起' : '更多'} aria-label={moreOpen ? '收起功能' : '更多功能'}
          aria-expanded={moreOpen} aria-controls="hud-more-panel" onPress={() => setMoreOpen(value => !value)} />
        <div id="hud-more-panel" className="hud-more-panel ui-panel" data-open={moreOpen}>
          {state.journey && <Tile icon="globe" label="世界" aria-label="世界" onPress={run(actions.openWorlds)} />}
          <Tile icon="portal" label="传送" tone="purple" aria-label="传送" disabled={!state.canTravel}
            title={state.canTravel ? '前往已解锁的地下层' : '回到营地后可以传送'} onPress={run(actions.openTravel)} />
          {state.journey && <Tile icon="gem" label="矿物" aria-label="矿物背包" onPress={run(actions.openMinerals)} />}
        </div>
      </div>
    </nav>

    <div className="hud-bottom">
      {target}
      {prompts}
      <HudNotice text={state.notice} />
      {!surface && <UiButton className="hud-return" size="l" icon="home" data-guide-action="return" onPress={run(session.returnToSurface)}>返回地表</UiButton>}
    </div>
    <OrePickupFeed session={session} />
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
