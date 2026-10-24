import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { ShopCategory } from '../content/shopCatalog.ts';
import type { ShopView } from '../presentation/ShopView.ts';
import { formatNumber as number } from '../presentation/formatNumber.ts';
import { CloseButton, Pill, Tile, UiButton } from './kit/controls.tsx';
import { Icon } from './kit/icons.tsx';
import { TIER_LABEL, offerAction, offerState, offerStats, offerTier } from './shopOffer.ts';
import './shop.css';

/** Opens the showroom on a counter at the item the player has now. */
export function showShopCategory(view: ShopView, state: ReturnType<GameSession['getSnapshot']>, category: ShopCategory) {
  const items = state.shopCatalog[category];
  const index = items.findIndex(item => category === 'tools' ? item.level === state.pickaxe.level : item.capacity === state.inventory.capacity);
  view.show(category, items, Math.max(0, index));
}

/** The tool & backpack shop: a 3D showroom the camera glides along, an info card on the right with the item's
 *  numbers next to what the player carries now, and a rail of every item at the bottom to jump to. It opens
 *  anywhere (the HUD button, the bag's plus, or walking into a surface shop). */
export function ShopPanel({ session, view, onClose }: { session: GameSession; view: ShopView; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const display = useSyncExternalStore(view.subscribe, view.getSnapshot);
  const [message, setMessage] = useState('');
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => { setMessage(''); }, [display.mode, display.index]);
  const count = display.mode === 'tools' || display.mode === 'backpacks' ? state.shopCatalog[display.mode].length : 0;
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.repeat && !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const step = event.key === 'ArrowLeft' || event.code === 'KeyA' ? -1 : event.key === 'ArrowRight' || event.code === 'KeyD' ? 1 : 0;
      if (step && count) { event.preventDefault(); view.select(Math.max(0, Math.min(count - 1, view.getSnapshot().index + step))); }
    };
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys);
  }, [onClose, view, count]);
  // Keep the selected cell in view on the rail.
  useEffect(() => { rail.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }, [display.index, display.mode]);
  const open = (category: ShopCategory) => showShopCategory(view, state, category);
  if (display.mode !== 'tools' && display.mode !== 'backpacks') return null;
  const category = display.mode, items = state.shopCatalog[category], item = items[display.index];
  const offer = offerState(category, item, state), action = offerAction(category, item, state, offer), tier = offerTier(item);
  const blocked = !action.enabled || !display.ready || !!display.error;
  const label = action.short != null ? `还差 ${number(action.short)}` : action.buy ? `购买 · ${number(item.price)}` : action.label;
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
    <UiButton className="shop-arrow shop-prev" aria-label="上一件商品" disabled={display.index === 0} onPress={() => view.select(display.index - 1)}>◀</UiButton>
    <UiButton className="shop-arrow shop-next" aria-label="下一件商品" disabled={display.index === items.length - 1} onPress={() => view.select(display.index + 1)}>▶</UiButton>
    {!display.ready && !display.error && <div className="shop-loading ui-card" role="status">正在布置展厅…</div>}
    {display.error && <div className="shop-loading ui-card" role="alert"><p>展厅资源加载失败</p><UiButton size="s" onPress={view.retry}>重新加载</UiButton></div>}
    <article className="shop-card" data-tier={tier} data-state={offer} key={`${category}-${item.id}`}>
      <div className="shop-card-tags">
        <span className="shop-tier">{TIER_LABEL[tier]}</span>
        <span className="shop-level">{category === 'tools' ? '镐子' : '背包'} · {display.index + 1} / {items.length}</span>
        {offer === 'equipped' && <span className="shop-badge" data-kind="equipped">已装备</span>}
        {offer === 'owned' && <span className="shop-badge" data-kind="owned">已拥有</span>}
      </div>
      <h1 className="ui-outline">{item.name}</h1>
      <p className="shop-description">{item.description}</p>
      <div className="shop-stat-list">{offerStats(category, item, items, state).map(stat => {
        const delta = stat.value - stat.current;
        return <div key={stat.key} className="shop-stat">
          <Icon kind={stat.key === 'speed' ? 'bolt' : stat.key === 'capacity' ? 'backpack' : 'pickaxe'} />
          <span className="shop-stat-label">{stat.label}</span>
          <b className="shop-stat-value">{stat.key === 'power' ? '+' : ''}{number(stat.value)}{stat.unit}</b>
          {delta !== 0 && <span className="shop-delta" data-up={delta > 0}>{delta > 0 ? '▲' : '▼'} {number(Math.abs(Math.round(delta * 100) / 100))}</span>}
          <div className="shop-meter"><i style={{ width: `${Math.min(100, stat.current / stat.max * 100)}%` }} className="shop-meter-now" /><i style={{ width: `${Math.min(100, stat.value / stat.max * 100)}%` }} className="shop-meter-item" data-up={delta > 0} /></div>
        </div>;
      })}</div>
      {(offer === 'next' || offer === 'locked') && <div className="shop-price"><Icon kind="coin" /><b className="ui-outline">{number(item.price)}</b></div>}
      <UiButton size="l" tone={offer === 'owned' ? 'purple' : action.buy ? 'green' : 'orange'} icon={action.buy ? 'coin' : undefined} className="shop-buy" data-owned={offer === 'owned' || offer === 'equipped'} data-testid="shop-buy" disabled={blocked} onPress={purchase}>{label}</UiButton>
      <div className="shop-feedback" role="status">{message || (offer === 'locked' ? '按顺序购买，先拿下前一件' : offer === 'next' ? '买下后立刻装备' : '')}</div>
    </article>
    <div className="shop-rail" ref={rail} role="listbox" aria-label={category === 'tools' ? '全部镐子' : '全部背包'}>
      {items.map((entry, index) => {
        const at = offerState(category, entry, state);
        return <button key={entry.id} type="button" role="option" className="shop-cell" data-state={at} data-tier={offerTier(entry)} aria-selected={index === display.index} aria-current={index === display.index}
          aria-label={`${entry.name}${at === 'equipped' ? '，已装备' : at === 'owned' ? '，已拥有' : ''}`} onClick={() => view.select(index)}>
          <Icon kind={category === 'tools' ? 'pickaxe' : 'backpack'} />
          <span>{category === 'tools' ? entry.level : number(entry.capacity!)}</span>
        </button>;
      })}
    </div>
  </section>;
}
