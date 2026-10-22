import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { ShopCategory } from '../content/shopCatalog.ts';
import type { ShopView } from '../presentation/ShopView.ts';
import { formatNumber as number } from '../presentation/formatNumber.ts';
import { GameButton } from './GameButton.tsx';
import { CloseButton, Pill, Tile, UiButton } from './kit/controls.tsx';
import { Icon } from './kit/icons.tsx';
import { Chip, Sheet } from './kit/panel.tsx';
import './shop.css';

/** The tool & backpack shop: pick a counter, then browse items in the 3D mine-cart showroom. */
export function ShopPanel({ session, view, onClose }: { session: GameSession; view: ShopView; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const display = useSyncExternalStore(view.subscribe, view.getSnapshot);
  const [message, setMessage] = useState('');
  useEffect(() => { setMessage(''); }, [display.mode, display.index]);
  useEffect(() => {
    if (display.mode === 'categories') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [onClose, display.mode]);
  const open = (category: ShopCategory) => {
    const items = state.shopCatalog[category];
    const index = items.findIndex(item => category === 'tools' ? item.level === state.pickaxe.level : item.capacity === state.inventory.capacity);
    view.show(category, items, Math.max(0, index));
  };
  if (display.mode === 'categories') {
    const tool = state.shopCatalog.tools.find(item => item.level === state.pickaxe.level), bag = state.shopCatalog.backpacks.find(item => item.capacity === state.inventory.capacity);
    return <Sheet title="商店" size="s" onClose={onClose} label="商店分类" className="shop-chooser">
      <div className="shop-categories">
        <GameButton className="shop-category ui-card-tile" data-category="tools" onPress={() => open('tools')}><Icon kind="pickaxe" /><strong className="ui-outline">工具</strong><small>当前：{tool?.name}</small></GameButton>
        <GameButton className="shop-category ui-card-tile" data-category="backpacks" onPress={() => open('backpacks')}><Icon kind="backpack" /><strong className="ui-outline">背包</strong><small>当前：{bag?.name}</small></GameButton>
      </div>
    </Sheet>;
  }
  if (display.mode !== 'tools' && display.mode !== 'backpacks') return null;
  const category = display.mode, items = state.shopCatalog[category], item = items[display.index];
  const owned = category === 'tools' ? item.level <= state.equipment.toolLevel : item.capacity! <= state.equipment.backpackCapacity;
  const equipped = category === 'tools' ? item.level === state.pickaxe.level : item.capacity === state.inventory.capacity;
  const next = category === 'tools' ? item.level === state.equipment.toolLevel + 1 : item.id === state.backpackUpgrade.next?.id;
  const tooSmall = category === 'backpacks' && item.capacity! < state.inventory.used;
  const affordable = state.coins >= item.price;
  const blocked = equipped || tooSmall || (!owned && (!next || !affordable)) || !display.ready || !!display.error;
  const label = equipped ? '已装备' : owned ? (tooSmall ? '先卖掉矿石' : '装备') : !next ? '先买上一件' : !affordable ? `还差 ${number(item.price - state.coins)}` : '购买';
  const purchase = () => {
    const result = session.useShopItem(category, item.id);
    setMessage(result.status === 'upgraded' ? '购买成功，已装备！' : result.status === 'equipped' ? '已装备' : result.status === 'insufficient' ? '金币不足' : result.status === 'too-small' ? '背包装不下现有矿石，先去卖掉' : result.status === 'locked' ? '请先购买上一件' : '请重新进入商店');
  };
  return <section className="shop-showroom" role="dialog" aria-modal="true" aria-label={category === 'tools' ? '工具商店' : '背包商店'} data-category={category} data-item={item.id}>
    <header className="shop-item-heading"><h1 className="ui-outline">{item.name}</h1><p>{item.description}</p></header>
    <nav className="shop-top-actions" aria-label="商店操作">
      <Tile icon="grid" label="分类" className="shop-category-back" onPress={view.categories} />
      <Tile icon={category === 'tools' ? 'backpack' : 'pickaxe'} label={category === 'tools' ? '背包' : '工具'} tone="purple" className="shop-switch" aria-label={category === 'tools' ? '切换到背包商店' : '切换到工具商店'} onPress={() => open(category === 'tools' ? 'backpacks' : 'tools')} />
      <CloseButton label="关闭商店" onPress={onClose} />
    </nav>
    <UiButton className="shop-arrow shop-prev" aria-label="上一件商品" disabled={display.index === 0} onPress={() => view.select(display.index - 1)}>◀</UiButton>
    <UiButton className="shop-arrow shop-next" aria-label="下一件商品" disabled={display.index === items.length - 1} onPress={() => view.select(display.index + 1)}>▶</UiButton>
    {!display.ready && !display.error && <div className="shop-loading ui-card" role="status">正在布置展厅…</div>}
    {display.error && <div className="shop-loading ui-card" role="alert"><p>展厅资源加载失败</p><UiButton size="s" onPress={view.retry}>重新加载</UiButton></div>}
    <div className="shop-wallet" aria-label="随身资源">
      <Pill icon="backpack" meter={state.inventory.capacity ? state.inventory.used / state.inventory.capacity : 0}>{number(state.inventory.used)} / {number(state.inventory.capacity)}</Pill>
      <Pill icon="coin" tone="gold">{number(state.coins)}</Pill>
    </div>
    <footer className="shop-item-actions">
      <div className="shop-stats">{category === 'tools' ? <><Chip icon="pickaxe">力量 <b>+{number(item.power!)}</b></Chip><Chip icon="bolt">攻速 <b>{item.speed}/秒</b></Chip></> : <Chip icon="backpack">容量 <b>{number(item.capacity!)}</b></Chip>}</div>
      <UiButton size="l" tone={owned ? 'purple' : 'orange'} icon={!owned && next && affordable ? 'coin' : undefined} className="shop-buy" data-owned={owned} data-testid="shop-buy" disabled={blocked} onPress={purchase}>
        {!owned && next && affordable ? `${label} · ${number(item.price)}` : label}
      </UiButton>
      <div className="shop-feedback ui-outline" role="status">{message || `${display.index + 1} / ${items.length}${owned ? ' · 已拥有' : ''}`}</div>
    </footer>
  </section>;
}
