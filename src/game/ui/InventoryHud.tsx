import { formatNumber as number } from '../presentation/formatNumber.ts';
import { useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import { GameButton } from './GameButton.tsx';
import { ORE_ITEMS } from '../application/items.ts';
import { OreIcon } from './InventoryIcons.tsx';
import { HudIcon } from './HudIcon.tsx';
import { OrePickupFeed } from './OrePickupFeed.tsx';
import './inventory.css';

type Props = {
  session: Pick<GameSession, 'subscribe' | 'getSnapshot' | 'returnToSurface' | 'onOreCollected'>;
  onOpenUpgrade(): void; onOpenTravel(): void; onOpenPets(): void; onOpenHelp(): void;
  onOpenWorlds(): void; onOpenMinerals(): void; onOpenRewards(): void;
};
export function InventoryHud({ session, onOpenUpgrade, onOpenTravel, onOpenPets, onOpenHelp, onOpenWorlds, onOpenMinerals, onOpenRewards }: Props) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const bag = state.inventory;
  const items = ORE_ITEMS.filter(item => (bag.items[item.itemId] ?? 0) > 0);
  const [moreOpen, setMoreOpen] = useState(false);
  const open = (action: () => void) => { setMoreOpen(false); action(); };
  return <><aside className="inventory-hud roblox-hud" aria-label="游戏状态与操作">
    <section className="hud-status" aria-label="世界与资源">
      <div className="hud-world"><HudIcon kind="world" /><div><strong>{state.worlds.find(w => w.id === state.currentWorld)?.name ?? `世界 ${state.currentWorld}`}</strong><span>深度 {Math.floor(state.depth)} 米</span></div></div>
      <div className="hud-currency" aria-label={`金币 ${number(state.coins)}`}><HudIcon kind="coin" /><strong data-testid="coins">{number(state.coins)}</strong></div>
      <div className="hud-capacity" data-full={bag.isFull}>
        <HudIcon kind="backpack" /><div><strong data-testid="bag-count" aria-label={`背包容量 ${number(bag.used)} / ${number(bag.capacity)}`}>{number(bag.used)} / {number(bag.capacity)}</strong><progress aria-label="背包容量" value={bag.used} max={bag.capacity} /></div>
      </div>
      {state.journey && <span className="hud-mined">累计挖掘 {number(state.minedVolume)}</span>}
    </section>
    <nav className="hud-navigation" aria-label="游戏功能">
      <GameButton className="hud-action" data-kind="upgrade" data-guide-action="upgrade" onPress={() => open(onOpenUpgrade)}><HudIcon kind="upgrade" /><span>商店</span></GameButton>
      <GameButton className="hud-action" data-kind="pets" data-guide-action="pets" aria-label="打开我的宠物" onPress={() => open(onOpenPets)}><HudIcon kind="pets" /><span>宠物</span></GameButton>
      <GameButton className="hud-action hud-more" aria-label={moreOpen ? '收起功能' : '更多功能'} aria-expanded={moreOpen} aria-controls="hud-secondary" onPress={() => setMoreOpen(value => !value)}><svg className="hud-icon" viewBox="0 0 48 48" aria-hidden="true" fill="#d3f2ff" stroke="#173c58" strokeWidth="3"><rect x="5" y="5" width="15" height="15" rx="4"/><rect x="28" y="5" width="15" height="15" rx="4"/><rect x="5" y="28" width="15" height="15" rx="4"/><rect x="28" y="28" width="15" height="15" rx="4"/></svg><span>{moreOpen ? '收起' : '更多'}</span></GameButton>
      <div id="hud-secondary" className="hud-secondary" data-open={moreOpen}>
        {state.journey && <><GameButton className="hud-action" data-kind="world" onPress={() => open(onOpenWorlds)}><HudIcon kind="world" /><span>世界</span></GameButton><GameButton className="hud-action" data-kind="minerals" aria-label="矿物背包" onPress={() => open(onOpenMinerals)}><HudIcon kind="minerals" /><span>矿物</span></GameButton></>}
        <GameButton className="hud-action" data-kind="rewards" aria-label={`奖励，幸运币 ${state.rewards.balance}`} onPress={() => open(onOpenRewards)}><HudIcon kind="rewards" /><b className="hud-badge">{number(state.rewards.balance)}</b><span>奖励</span></GameButton>
        <GameButton className="hud-action" data-kind="travel" disabled={!state.canTravel} title={state.canTravel ? '前往已解锁的地下层' : '返回地表营地后可传送'} onPress={() => open(onOpenTravel)}><HudIcon kind="travel" /><span>传送</span></GameButton>
      </div>
    </nav>
    <div className="hud-equipment" aria-label="装备等级">
      <span className="hud-equipped" data-testid="pickaxe-level"><HudIcon kind="upgrade" /><span>镐子 Lv.{state.pickaxe.level}</span></span>
      <span className="hud-equipped" data-testid="backpack-level"><HudIcon kind="backpack" /><span>背包 Lv.{state.backpackLevel}</span></span>
      <GameButton className="hud-action hud-return" data-guide-action="return" onPress={() => open(session.returnToSurface)}><span className="hud-home-icon"><HudIcon kind="home" /></span><span>返回地表</span></GameButton>
    </div>
    <GameButton className="hud-help" aria-label="操作帮助" onPress={() => open(onOpenHelp)}><HudIcon kind="help" /></GameButton>
    <div className="hud-loot">
    <ul className="inventory-ore-slots" aria-label={`随身矿石，${items.length} 种`}>
      {items.slice(0, 10).map(item => <li key={item.itemId} data-item-id={item.itemId} title={`${item.name} ×${bag.items[item.itemId]}，每件占 ${item.volume} 容量，售价 ${item.price} 金币`}>
        <OreIcon color={item.color} /><span>{item.name}</span><b>×{number(bag.items[item.itemId] ?? 0)}</b>
      </li>)}
    </ul>
    {bag.totalCount > 0 && <div className="sale-hint" data-testid="sale-quote">共 {bag.totalCount} 件 · {state.sale.status === 'quoted' ? `预计 ${number(state.sale.coins)} 金币` : '售价超出数值范围'}</div>}
    <output className="sale-notice" role="status">{state.onboarding.status==='active'&&(!state.notice||state.notice==='走进金色圆圈出售，或踩左侧圆盘前往已解锁层')?'':state.notice || '走进金色圆圈自动出售'}</output>
    </div>
    <div className="hud-buffs">{state.rewards.timed.speed>0&&<span>移速 ×2 · {Math.ceil(state.rewards.timed.speed)} 秒</span>}{state.rewards.timed.luck>0&&<span>稀有率 ×2 · {Math.ceil(state.rewards.timed.luck)} 秒</span>}</div>
  </aside><OrePickupFeed session={session} /></>;
}
