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

import { tr , resolveText } from '../i18n/i18n.ts';
/** Opens the showroom on a counter at the item the player has now. */
/** Shows a page of the counter the player stands at: on the item worn, else the next one to buy, else the first. */
export function showShopCategory(view: ShopView, state: ReturnType<GameSession['getSnapshot']>, category: ShopCategory) {
  const items = state.shopStock?.[category] ?? [];
  if (!items.length) return;
  const worn = items.findIndex(item => category === 'tools' ? item.level === state.pickaxe.level : item.capacity === state.inventory.capacity);
  const next = items.findIndex(item => offerState(category, item, state) === 'next');
  view.show(category, items, worn >= 0 ? worn : Math.max(0, next));
}

/** The tool & backpack shop (docs/draft-ui-v2.md, U6): a 3D showroom the camera glides along. Over the cart: the
 *  item's name, its level, its world and (for a pickaxe) how deep it digs; under it: its numbers with the gain over
 *  what the player carries (damage ×1.5, speed +0.5), and one button that says what it does and what it costs
 *  (购买 · 价格, 强化 +N · 价格, 装备, 已装备). A price the player cannot pay yet is greyed, never a missing amount.
 *  It opens at a shop counter, with what that counter sells: each world's surface and its halls of layers 2 and 4
 *  have their own shelves (economy.json `shop`); the shop button takes the player to the furthest one open. */
export function ShopPanel({ session, view, onClose }: { session: GameSession; view: ShopView; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const display = useSyncExternalStore(view.subscribe, view.getSnapshot);
  const [message, setMessage] = useState('');
  useEffect(() => { setMessage(''); }, [display.mode, display.index]);
  // A purchase can change the shelf (the newest pickaxe stands on every shelf of its world, to be enhanced there):
  // rebuild it and stay on the item looked at.
  const shelf = display.mode === 'tools' || display.mode === 'backpacks' ? state.shopStock?.[display.mode] : undefined;
  const shelfKey = shelf?.map(i => i.id).join(',') ?? '';
  const [lastShelf, setLastShelf] = useState(shelfKey);
  useEffect(() => {
    if (shelfKey === lastShelf) return;
    const previous = view.getSnapshot(), looked = lastShelf.split(',')[previous.index];
    setLastShelf(shelfKey);
    if (shelf && (previous.mode === 'tools' || previous.mode === 'backpacks')) view.show(previous.mode, shelf, Math.max(0, shelf.findIndex(i => i.id === looked)));
  }, [shelfKey, lastShelf, shelf, view]);
  const count = display.mode === 'tools' || display.mode === 'backpacks' ? state.shopStock?.[display.mode].length ?? 0 : 0;
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      const step = event.key === 'ArrowLeft' || event.code === 'KeyA' ? -1 : event.key === 'ArrowRight' || event.code === 'KeyD' ? 1 : 0;
      if (step && count) { event.preventDefault(); view.select(Math.max(0, Math.min(count - 1, view.getSnapshot().index + step))); }
    };
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys);
  }, [onClose, view, count]);
  const open = (category: ShopCategory) => showShopCategory(view, state, category);
  if (display.mode !== 'tools' && display.mode !== 'backpacks' || !state.shopStock) return null;
  // The counter's shelf; levels and the stat bars count against the whole catalogue.
  const category = display.mode, items = state.shopStock[category], all = state.shopCatalog[category], item = items[display.index];
  if (!item) return null;
  const offer = offerState(category, item, state), action = offerAction(category, item, state, offer);
  const blocked = !action.enabled || !display.ready || !!display.error;
  // Every unowned item on this shelf can be bought directly at its own price.
  const priced = offer === 'next';
  // Buy now, short of coins, owned or worn.
  const mood = offer === 'next' ? (action.enabled ? 'buy' : 'short') : offer === 'owned' ? (action.enabled ? 'owned' : 'locked') : 'equipped';
  const unit = currencyName(item.currency);
  // The newest pickaxe, worn: its button enhances it (+1..+3) while it can; its name carries the enhancement.
  const top = category === 'tools' && item.level === state.equipment.toolLevel, enhance = state.pickaxeEnhance;
  const enhancing = top && offer === 'equipped' && !!enhance.next;
  const improve = () => {
    const result = session.enhancePickaxe(enhance.level, enhance.enhance);
    setMessage(result.status === 'enhanced' ? tr("msg.enhanced_to_enhance", { enhance: result.enhance }) : result.status === 'insufficient' ? '' : result.status === 'max' ? tr("msg.fully_enhanced") : tr("msg.please_reopen_the_shop"));
  };
  const purchase = () => {
    const result = session.useShopItem(category, item.id);
    setMessage(result.status === 'upgraded' ? tr("msg.bought_and_equipped") : result.status === 'equipped' ? tr("msg.equipped_a68821c6") : result.status === 'insufficient' ? '' : result.status === 'too-small' ? tr("msg.the_bag_can_t_hold_your_ore_sell_first") : tr("msg.please_reopen_the_shop"));
  };
  const lean = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    view.setPointer((event.clientX - box.left) / box.width * 2 - 1, (event.clientY - box.top) / box.height * 2 - 1);
  };
  return <section className="shop-showroom" role="dialog" aria-modal="true" aria-label={category === 'tools' ? tr("msg.tool_shop") : tr("msg.backpack_shop")} data-category={category} data-item={item.id} onPointerMove={lean}>
    <div className="shop-wallet" aria-label={tr("msg.your_resources")}>
      <Pill icon="backpack" meter={state.inventory.capacity ? state.inventory.used / state.inventory.capacity : 0}>{number(state.inventory.used)} / {number(state.inventory.capacity)}</Pill>
      <Pill icon={currencyIcon(item.currency)} tone="gold">{number(state.balances[item.currency])}</Pill>
    </div>
    <nav className="shop-top-actions" aria-label={tr("msg.shop_actions")}>
      <Tile icon={category === 'tools' ? 'backpack' : 'pickaxe'} label={category === 'tools' ? tr("msg.backpack") : tr("msg.tools")} tone="purple" className="shop-switch" aria-label={category === 'tools' ? tr("msg.switch_to_the_backpack_shop") : tr("msg.switch_to_the_tool_shop")} onPress={() => open(category === 'tools' ? 'backpacks' : 'tools')} />
      <CloseButton label={tr("msg.close_shop")} onPress={onClose} />
    </nav>
    <header className="shop-head" key={item.id}>
      <h1 className="shop-name ui-outline" data-tier={offerTier(item)} data-long={resolveText(item.name).length > 13 || undefined}>{resolveText(item.name)}{top && state.equipment.enhance ? ` +${state.equipment.enhance}` : ''}</h1>
      <div className="shop-tags">
        <span className="shop-tag ui-num">Lv.{item.level}<small>/{all.length}</small></span>
        <span className="shop-tag"><Icon kind={currencyIcon(item.currency)} />{resolveText(WORLD_REQUIREMENTS[offerWorld(item) - 1].name)}</span>
        {category === 'tools' && <span className="shop-tag shop-reach"><Icon kind="pickaxe" />{tr("msg.digs_to_layer", { layer: toolReach(item.level) })}</span>}
      </div>
      <p className="shop-blurb">{resolveText(item.description)}</p>
    </header>
    <UiButton className="shop-arrow shop-prev" aria-label={tr("msg.previous_item")} disabled={display.index === 0} onPress={() => view.select(display.index - 1)}>◀</UiButton>
    <UiButton className="shop-arrow shop-next" aria-label={tr("msg.next_item")} disabled={display.index === items.length - 1} onPress={() => view.select(display.index + 1)}>▶</UiButton>
    {!display.ready && !display.error && <div className="shop-loading ui-card" role="status">{tr("msg.setting_up_the_showroom")}</div>}
    {display.error && <div className="shop-loading ui-card" role="alert"><p>{tr("msg.the_showroom_failed_to_load")}</p><UiButton size="s" onPress={view.retry}>{tr("msg.reload")}</UiButton></div>}
    <footer className="shop-under" data-state={offer}>
      <div className="shop-stats">{offerStats(category, item, all, state).map(stat => {
        // The worn newest pickaxe shows what its next enhancement brings instead.
        const gain = enhancing && stat.key === 'power' ? tr("msg.enhanced_power", { power: number(enhance.next!.power) }) : offerGain(stat);
        return <span key={stat.key} className="shop-stat" data-kind={stat.key}>
          <i className="shop-stat-icon"><Icon kind={stat.key === 'speed' ? 'bolt' : stat.key === 'capacity' ? 'backpack' : 'pickaxe'} /></i>
          <span className="shop-stat-text"><small>{stat.label}</small><b className="ui-num">{stat.key === 'power' ? '+' : ''}{number(stat.value)}{stat.unit}</b></span>
          {gain && <em className="shop-gain ui-outline" key={`${item.id}-${stat.key}`}>{gain}</em>}
        </span>;
      })}</div>
      {enhancing ? <PriceButton verb={tr("msg.enhance_enhance", { enhance: enhance.next!.enhance })} price={number(enhance.next!.price)} currency={currencyIcon(enhance.next!.currency)} tone="orange" size="l"
        className="shop-buy" data-mood={enhance.canAfford ? 'buy' : 'short'} data-testid="shop-enhance" disabled={!enhance.canAfford || !display.ready} onPress={improve}
        aria-label={tr("msg.enhance_to_enhance_price_unit", { enhance: enhance.next!.enhance, price: number(enhance.next!.price), unit: unit })} />
      : priced ? <PriceButton verb={tr("msg.buy")} price={number(item.price)} currency={currencyIcon(item.currency)} tone="green" size="l"
        className="shop-buy" data-mood={mood} data-testid="shop-buy" disabled={blocked} onPress={purchase}
        aria-label={tr("msg.buy_price_unit", { price: number(item.price), unit: unit })} />
      : <UiButton size="l" tone={mood === 'owned' ? 'purple' : 'white'} icon={mood === 'equipped' ? undefined : category === 'tools' ? 'pickaxe' : 'backpack'}
        className="shop-buy" data-mood={mood} data-testid="shop-buy" disabled={blocked} onPress={purchase} aria-label={action.label}>
        {mood === 'equipped' ? tr("msg.equipped") : action.label}
      </UiButton>}
      <div className="shop-hint" data-mood={message ? 'message' : enhancing ? 'enhance' : mood} role="status">{message || (enhancing
        ? tr("msg.enhance_more_damage_same_model_and_gate")
        : mood === 'locked' ? tr("msg.sell_your_ore_first") : top && offer === 'equipped' && category === 'tools' ? tr("msg.fully_enhanced") : '')}</div>
    </footer>
  </section>;
}
