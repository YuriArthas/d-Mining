import { useEffect, useState, useSyncExternalStore, type PointerEvent } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { ShopCategory } from '../content/shopCatalog.ts';
import type { ShopView } from '../presentation/ShopView.ts';
import { formatNumber as number } from '../presentation/formatNumber.ts';
import { CloseButton, Pill, Tile, UiButton } from './kit/controls.tsx';
import { Icon } from './kit/icons.tsx';
import { offerAction, offerState, offerStats, offerTier } from './shopOffer.ts';
import './shop.css';

/** Opens the showroom on a counter at the item the player has now. */
export function showShopCategory(view: ShopView, state: ReturnType<GameSession['getSnapshot']>, category: ShopCategory) {
  const items = state.shopCatalog[category];
  const index = items.findIndex(item => category === 'tools' ? item.level === state.pickaxe.level : item.capacity === state.inventory.capacity);
  view.show(category, items, Math.max(0, index));
}

/** The tool & backpack shop: a 3D showroom the camera glides along. The screen says only what matters: the
 *  item's name over its cart, its numbers under it (with the gain over what the player carries), and one
 *  button that buys, equips or says why not. It opens anywhere (the HUD button, the bag's plus, or walking
 *  into a surface shop). */
export function ShopPanel({ session, view, onClose }: { session: GameSession; view: ShopView; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const display = useSyncExternalStore(view.subscribe, view.getSnapshot);
  const [message, setMessage] = useState('');
  useEffect(() => { setMessage(''); }, [display.mode, display.index]);
  const count = display.mode === 'tools' || display.mode === 'backpacks' ? state.shopCatalog[display.mode].length : 0;
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      const step = event.key === 'ArrowLeft' || event.code === 'KeyA' ? -1 : event.key === 'ArrowRight' || event.code === 'KeyD' ? 1 : 0;
      if (step && count) { event.preventDefault(); view.select(Math.max(0, Math.min(count - 1, view.getSnapshot().index + step))); }
    };
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys);
  }, [onClose, view, count]);
  const open = (category: ShopCategory) => showShopCategory(view, state, category);
  if (display.mode !== 'tools' && display.mode !== 'backpacks') return null;
  const category = display.mode, items = state.shopCatalog[category], item = items[display.index];
  const offer = offerState(category, item, state), action = offerAction(category, item, state, offer);
  const blocked = !action.enabled || !display.ready || !!display.error;
  // Items still to buy show their price on the button; further ones too, on a greyed button.
  const priced = offer === 'next' || offer === 'locked';
  // How the button feels: buy now, short of coins, further up the ladder, owned or worn.
  const mood = offer === 'next' ? (action.enabled ? 'buy' : 'short') : offer === 'locked' ? 'locked' : offer === 'owned' ? (action.enabled ? 'owned' : 'locked') : 'equipped';
  const purchase = () => {
    const result = session.useShopItem(category, item.id);
    setMessage(result.status === 'upgraded' ? '购买成功，已装备！' : result.status === 'equipped' ? '已装备' : result.status === 'insufficient' ? '金币不足' : result.status === 'too-small' ? '背包装不下现有矿石，先去卖掉' : result.status === 'locked' ? '请先购买上一件' : '请重新进入商店');
  };
  const lean = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    view.setPointer((event.clientX - box.left) / box.width * 2 - 1, (event.clientY - box.top) / box.height * 2 - 1);
  };
  return <section className="shop-showroom" role="dialog" aria-modal="true" aria-label={category === 'tools' ? '工具商店' : '背包商店'} data-category={category} data-item={item.id} onPointerMove={lean}>
    <div className="shop-wallet" aria-label="随身资源">
      <Pill icon="backpack" meter={state.inventory.capacity ? state.inventory.used / state.inventory.capacity : 0}>{number(state.inventory.used)} / {number(state.inventory.capacity)}</Pill>
      <Pill icon="coin" tone="gold">{number(state.coins)}</Pill>
    </div>
    <nav className="shop-top-actions" aria-label="商店操作">
      <Tile icon={category === 'tools' ? 'backpack' : 'pickaxe'} label={category === 'tools' ? '背包' : '工具'} tone="purple" className="shop-switch" aria-label={category === 'tools' ? '切换到背包商店' : '切换到工具商店'} onPress={() => open(category === 'tools' ? 'backpacks' : 'tools')} />
      <CloseButton label="关闭商店" onPress={onClose} />
    </nav>
    <h1 className="shop-name ui-outline" data-tier={offerTier(item)} key={item.id}>{item.name}</h1>
    <p className="shop-blurb ui-outline" key={`${item.id}-blurb`}>{item.description}</p>
    <UiButton className="shop-arrow shop-prev" aria-label="上一件商品" disabled={display.index === 0} onPress={() => view.select(display.index - 1)}>◀</UiButton>
    <UiButton className="shop-arrow shop-next" aria-label="下一件商品" disabled={display.index === items.length - 1} onPress={() => view.select(display.index + 1)}>▶</UiButton>
    {!display.ready && !display.error && <div className="shop-loading ui-card" role="status">正在布置展厅…</div>}
    {display.error && <div className="shop-loading ui-card" role="alert"><p>展厅资源加载失败</p><UiButton size="s" onPress={view.retry}>重新加载</UiButton></div>}
    <footer className="shop-under" data-state={offer}>
      <div className="shop-stats">{offerStats(category, item, items, state).map(stat => {
        const gain = Math.round((stat.value - stat.current) * 100) / 100;
        return <span key={stat.key} className="shop-stat" data-kind={stat.key}>
          <i className="shop-stat-icon"><Icon kind={stat.key === 'speed' ? 'bolt' : stat.key === 'capacity' ? 'backpack' : 'pickaxe'} /></i>
          <b className="ui-outline">{stat.key === 'power' ? '+' : ''}{number(stat.value)}{stat.unit}</b>
          {gain > 0 && <em className="shop-gain ui-outline" key={item.id}>▲{number(gain)}</em>}
        </span>;
      })}</div>
      <UiButton size="l" tone={mood === 'buy' ? 'green' : mood === 'short' ? 'red' : mood === 'owned' ? 'purple' : mood === 'equipped' ? 'blue' : 'steel'} icon={priced ? 'coin' : undefined}
        className="shop-buy" data-mood={mood} data-testid="shop-buy" disabled={blocked} onPress={purchase}
        aria-label={offer === 'locked' ? `先买上一件，${number(item.price)} 金币` : priced ? (action.enabled ? `购买，${number(item.price)} 金币` : `还差 ${number(action.short ?? item.price)} 金币`) : action.label}>
        {priced ? number(item.price) : mood === 'equipped' ? '✓ 已装备' : action.label}
      </UiButton>
      <div className="shop-hint ui-outline" data-mood={message ? 'message' : mood} role="status">{message || (mood === 'short' ? `还差 ${number(action.short!)}` : mood === 'locked' ? '先买上一件' : '')}</div>
    </footer>
  </section>;
}
