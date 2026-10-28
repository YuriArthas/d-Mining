import { useEffect, useState, useSyncExternalStore, type PointerEvent } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { ShopCategory } from '../content/shopCatalog.ts';
import type { ShopView } from '../presentation/ShopView.ts';
import { formatNumber as number } from '../presentation/formatNumber.ts';
import { CloseButton, Pill, PriceButton, Tile, UiButton } from './kit/controls.tsx';
import { Icon } from './kit/icons.tsx';
import { offerAction, offerGain, offerState, offerStats, offerTier, offerWorld, toolReach } from './shopOffer.ts';
import { WORLD_REQUIREMENTS } from '../content/worldJourney.ts';
import './shop.css';
import { currencyIcon, currencyName } from './currency.ts';

import { tr } from '../i18n/i18n.ts';
/** Opens the showroom on a counter at the item the player has now. */
export function showShopCategory(view: ShopView, state: ReturnType<GameSession['getSnapshot']>, category: ShopCategory) {
  const items = state.shopCatalog[category];
  const index = items.findIndex(item => category === 'tools' ? item.level === state.pickaxe.level : item.capacity === state.inventory.capacity);
  view.show(category, items, Math.max(0, index));
}

/** The tool & backpack shop (docs/draft-ui-v2.md, U6): a 3D showroom the camera glides along. Over the cart: the
 *  item's name, its level, its world and (for a pickaxe) how deep it digs; under it: its numbers with the gain over
 *  what the player carries (damage ×1.5, speed +0.5), and one button that says what it does and what it costs
 *  (购买 · 价格, 强化 +N · 价格, 装备, 已装备). A price the player cannot pay yet is greyed, never a missing amount.
 *  It opens anywhere (the HUD button, the bag's plus, or walking into a surface shop). */
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
  // How the button feels: buy now, short of coins (the price, greyed), further up the ladder, owned or worn.
  const mood = offer === 'next' ? (action.enabled ? 'buy' : 'short') : offer === 'locked' ? 'locked' : offer === 'owned' ? (action.enabled ? 'owned' : 'locked') : 'equipped';
  const unit = currencyName(item.currency);
  // The newest pickaxe, worn: its button enhances it (+1..+3) while it can; its name carries the enhancement.
  const top = category === 'tools' && item.level === state.equipment.toolLevel, enhance = state.pickaxeEnhance;
  const enhancing = top && offer === 'equipped' && !!enhance.next;
  const improve = () => {
    const result = session.enhancePickaxe(enhance.level, enhance.enhance);
    setMessage(result.status === 'enhanced' ? tr('强化到 +{enhance}！', { enhance: result.enhance }) : result.status === 'insufficient' ? '' : result.status === 'max' ? tr('已经强化满了') : tr('请重新进入商店'));
  };
  const purchase = () => {
    const result = session.useShopItem(category, item.id);
    setMessage(result.status === 'upgraded' ? tr('购买成功，已装备！') : result.status === 'equipped' ? tr('已装备') : result.status === 'insufficient' ? '' : result.status === 'too-small' ? tr('背包装不下现有矿石，先去卖掉') : result.status === 'locked' ? tr('先买上一件') : tr('请重新进入商店'));
  };
  const lean = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    view.setPointer((event.clientX - box.left) / box.width * 2 - 1, (event.clientY - box.top) / box.height * 2 - 1);
  };
  return <section className="shop-showroom" role="dialog" aria-modal="true" aria-label={category === 'tools' ? tr('工具商店') : tr('背包商店')} data-category={category} data-item={item.id} onPointerMove={lean}>
    <div className="shop-wallet" aria-label={tr('随身资源')}>
      <Pill icon="backpack" meter={state.inventory.capacity ? state.inventory.used / state.inventory.capacity : 0}>{number(state.inventory.used)} / {number(state.inventory.capacity)}</Pill>
      <Pill icon={currencyIcon(item.currency)} tone="gold">{number(state.balances[item.currency])}</Pill>
    </div>
    <nav className="shop-top-actions" aria-label={tr('商店操作')}>
      <Tile icon={category === 'tools' ? 'backpack' : 'pickaxe'} label={category === 'tools' ? tr('背包') : tr('工具')} tone="purple" className="shop-switch" aria-label={category === 'tools' ? tr('切换到背包商店') : tr('切换到工具商店')} onPress={() => open(category === 'tools' ? 'backpacks' : 'tools')} />
      <CloseButton label={tr('关闭商店')} onPress={onClose} />
    </nav>
    <header className="shop-head" key={item.id}>
      <h1 className="shop-name ui-outline" data-tier={offerTier(item)} data-long={item.name.length > 13 || undefined}>{item.name}{top && state.equipment.enhance ? ` +${state.equipment.enhance}` : ''}</h1>
      <div className="shop-tags">
        <span className="shop-tag ui-num">Lv.{item.level}<small>/{items.length}</small></span>
        <span className="shop-tag"><Icon kind={currencyIcon(item.currency)} />{WORLD_REQUIREMENTS[offerWorld(item) - 1].name}</span>
        {category === 'tools' && <span className="shop-tag shop-reach"><Icon kind="pickaxe" />{tr('能挖到 {layer}', { layer: toolReach(item.level) })}</span>}
      </div>
      <p className="shop-blurb">{item.description}</p>
    </header>
    <UiButton className="shop-arrow shop-prev" aria-label={tr('上一件商品')} disabled={display.index === 0} onPress={() => view.select(display.index - 1)}>◀</UiButton>
    <UiButton className="shop-arrow shop-next" aria-label={tr('下一件商品')} disabled={display.index === items.length - 1} onPress={() => view.select(display.index + 1)}>▶</UiButton>
    {!display.ready && !display.error && <div className="shop-loading ui-card" role="status">{tr('正在布置展厅…')}</div>}
    {display.error && <div className="shop-loading ui-card" role="alert"><p>{tr('展厅资源加载失败')}</p><UiButton size="s" onPress={view.retry}>{tr('重新加载')}</UiButton></div>}
    <footer className="shop-under" data-state={offer}>
      <div className="shop-stats">{offerStats(category, item, items, state).map(stat => {
        // The worn newest pickaxe shows what its next enhancement brings instead.
        const gain = enhancing && stat.key === 'power' ? tr('强化后 {power}', { power: number(enhance.next!.power) }) : offerGain(stat);
        return <span key={stat.key} className="shop-stat" data-kind={stat.key}>
          <i className="shop-stat-icon"><Icon kind={stat.key === 'speed' ? 'bolt' : stat.key === 'capacity' ? 'backpack' : 'pickaxe'} /></i>
          <span className="shop-stat-text"><small>{stat.label}</small><b className="ui-num">{stat.key === 'power' ? '+' : ''}{number(stat.value)}{stat.unit}</b></span>
          {gain && <em className="shop-gain ui-outline" key={`${item.id}-${stat.key}`}>{gain}</em>}
        </span>;
      })}</div>
      {enhancing ? <PriceButton verb={tr('强化 +{enhance}', { enhance: enhance.next!.enhance })} price={number(enhance.next!.price)} currency={currencyIcon(enhance.next!.currency)} tone="orange" size="l"
        className="shop-buy" data-mood={enhance.canAfford ? 'buy' : 'short'} data-testid="shop-enhance" disabled={!enhance.canAfford || !display.ready} onPress={improve}
        aria-label={tr('强化到 +{enhance}，{price} {unit}', { enhance: enhance.next!.enhance, price: number(enhance.next!.price), unit: unit })} />
      : priced ? <PriceButton verb={tr('购买')} price={number(item.price)} currency={currencyIcon(item.currency)} tone="green" size="l"
        className="shop-buy" data-mood={mood} data-testid="shop-buy" disabled={blocked} onPress={purchase}
        aria-label={offer === 'locked' ? tr('先买上一件，{price} {unit}', { price: number(item.price), unit: unit }) : tr('购买，{price} {unit}', { price: number(item.price), unit: unit })} />
      : <UiButton size="l" tone={mood === 'owned' ? 'purple' : 'white'} icon={mood === 'equipped' ? undefined : category === 'tools' ? 'pickaxe' : 'backpack'}
        className="shop-buy" data-mood={mood} data-testid="shop-buy" disabled={blocked} onPress={purchase} aria-label={action.label}>
        {mood === 'equipped' ? tr('✓ 已装备') : action.label}
      </UiButton>}
      <div className="shop-hint" data-mood={message ? 'message' : enhancing ? 'enhance' : mood} role="status">{message || (enhancing
        ? tr('强化：伤害变高，模型和门槛不变')
        : mood === 'locked' ? tr('先买上一件') : top && offer === 'equipped' && category === 'tools' ? tr('已经强化满了') : '')}</div>
    </footer>
  </section>;
}
