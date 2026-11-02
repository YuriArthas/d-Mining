import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import type { PetCardView, PetPanelSnapshot } from '../../application/PetUiAdapter.ts';
import { itemDefinition } from '../../application/items.ts';
import type { CurrencyId } from '../../content/economy.ts';
import type { ShopItem } from '../../content/shopCatalog.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { GameButton } from '../GameButton.tsx';
import { OreIcon } from '../InventoryIcons.tsx';
import { PriceButton, UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Bar, RarityTag, Sheet, type SheetTab } from '../kit/panel.tsx';
import { EggArt } from '../pets/EggArt.tsx';
import { MYSTERY_EGG_NAME } from '../../content/petAppearance.ts';
import { PetArt } from '../pets/PetArt.tsx';
import { bonusLabel } from '../pets/petDisplay.ts';
import './bag.css';
import { currencyIcon, currencyName } from '../currency.ts';
import { WORLD_REQUIREMENTS } from '../../content/worldJourney.ts';

import { tr , resolveText } from '../../i18n/i18n.ts';
const WORLD_OF = Object.fromEntries(WORLD_REQUIREMENTS.map(w => [w.currency, w])) as Record<CurrencyId, (typeof WORLD_REQUIREMENTS)[number]>;

export type BagTab = 'pets' | 'ores' | 'gear';
type Props = { session: GameSession; tab: BagTab; onTab(tab: BagTab): void; onClose(): void; onShop(category: 'tools' | 'backpacks'): void };

/** What a pet adds in the current world: its bonus if it belongs to this world's currency, else nothing. */
const here = (pets: PetPanelSnapshot, card: PetCardView) => card.currency === pets.currency ? card.bonusPct : 0;
/** True when "一键最佳" would raise the team's bonus in the current world's currency. */
export function teamCanImprove(pets: PetPanelSnapshot) {
  const best = [...pets.pets].sort((a, b) => here(pets, b) - here(pets, a)).slice(0, pets.slots.length);
  const equipped = pets.pets.filter(card => card.equippedSlot !== null);
  return best.reduce((sum, card) => sum + here(pets, card), 0) > equipped.reduce((sum, card) => sum + here(pets, card), 0);
}

/** The bag (docs/draft-ui-v2.md, U4): pets, ores and gear behind one set of tabs. */
export function BagSheet(props: Props) {
  const pets = useSyncExternalStore(props.session.pets.subscribe, props.session.pets.getSnapshot);
  const tabs: SheetTab<BagTab>[] = [
    { id: 'pets', label: tr("msg.pets"), icon: 'paw', badge: teamCanImprove(pets) ? '!' : undefined },
    { id: 'ores', label: tr("msg.ores"), icon: 'gem' },
    { id: 'gear', label: tr("msg.gear"), icon: 'pickaxe' },
  ];
  // The title names the open tab: “背包” is already the bag capacity, a shop counter and an item.
  const common = { title: { pets: tr("msg.pets"), ores: tr("msg.ores"), gear: tr("msg.gear") }[props.tab], tabs, tab: props.tab, onTab: props.onTab, onClose: props.onClose, className: `bag-sheet bag-tab-${props.tab}` };
  if (props.tab === 'ores') return <OresTab {...props} common={common} />;
  if (props.tab === 'gear') return <GearTab {...props} common={common} />;
  return <PetsTab {...props} pets={pets} common={common} />;
}
type Common = { title: string; tabs: SheetTab<BagTab>[]; tab: BagTab; onTab(tab: BagTab): void; onClose(): void; className: string };

/** A short line that pops up over the bottom of the sheet and goes (replaces the old status footer). */
function useToast() {
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2400); return () => clearTimeout(timer); }, [toast]);
  const show = (text: string) => setToast({ text, id: Date.now() });
  const view = toast && <output key={toast.id} className="ui-toast bag-toast ui-pop" role="status">{toast.text}</output>;
  return [show, view] as const;
}

function PetsTab({ session, pets, common, onClose }: Props & { pets: PetPanelSnapshot; common: Common }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot), slot = state.petSlot;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [toast, toastView] = useToast();
  // Equipped first, then the pets that count in this world, strongest first; other worlds' pets after them.
  const cards = [...pets.pets].sort((a, b) => Number(b.equippedSlot !== null) - Number(a.equippedSlot !== null) || here(pets, b) - here(pets, a) || b.bonusPct - a.bonusPct);
  const selected = cards.find(card => card.pet.id === selectedId) ?? cards[0] ?? null;
  const equipped = pets.slots.filter(id => id !== null).length;
  const better = teamCanImprove(pets);
  if (finding) return <EggFinder session={session} pets={pets} common={common} onBack={() => setFinding(false)} onClose={onClose} />;
  const buySlot = () => {
    const result = session.buyPetSlot(pets.slots.length);
    const text = result.status === 'bought' ? tr("msg.slot_slots_is_open_you_can_bring_one_more_pet", { slots: result.slots }) : result.status === 'insufficient' ? '' : result.status === 'locked' ? tr("msg.reach_unlockname_to_buy", { unlockName: slot!.unlockName }) : tr("msg.please_try_again_in_a_moment");
    if (text) toast(text);
  };
  const merge = (card: PetCardView) => {
    const result = session.pets.mergeGolden(card.pet.speciesId);
    if (result.status === 'merged') { setSelectedId(result.pet.id); toast(tr("msg.goldenneed_name_merged_into_a_golden_name2", { goldenNeed: pets.goldenNeed, name: card.name, name2: card.name })); }
    else toast(tr("msg.needs_goldenneed_identical_regular_name", { goldenNeed: pets.goldenNeed, name: card.name }));
  };
  const toggle = (card: PetCardView) => {
    if (card.equippedSlot !== null) { session.pets.unequip(card.pet.id); toast(tr("msg.unequipped_name", { name: card.name })); return; }
    const result = session.pets.equip(card.pet.id);
    toast(result.status === 'equipped' ? tr("msg.equipped_name", { name: card.name }) : result.status === 'full' ? tr("msg.slots_full_unequip_one_first_or_tap_equip_best") : tr("msg.this_pet_is_no_longer_in_your_bag"));
  };
  const byId = new Map(cards.map(card => [card.pet.id, card]));
  // A species ready for a golden merge is marked once, on its first card.
  const mergeMarked = new Set<string>();
  const team = <section className="bag-team" aria-label={tr("msg.your_team")}>
    <div className="bag-slots" role="list" aria-label={tr("msg.slots_equipped_slots", { equipped: equipped, slots: pets.slots.length })}>
      {pets.slots.map((id, i) => {
        const card = id ? byId.get(id) : undefined;
        return <GameButton key={i} role="listitem" className="bag-slot" data-rarity={card?.rarity} data-empty={card ? undefined : ''} blurAfterPress={false}
          aria-label={card ? tr("msg.slot_i_name", { i: i + 1, name: card.name }) : tr("msg.slot_i_empty", { i: i + 1 })}
          onPress={() => card ? setSelectedId(card.pet.id) : toast(tr("msg.pick_a_pet_then_tap_equip"))}>
          {card ? <PetArt speciesId={card.pet.speciesId} rarity={card.rarity} className="bag-slot-art" /> : <Icon kind="plus" />}
        </GameButton>;
      })}
      {slot && (slot.unlocked
        ? <PriceButton verb={tr("msg.slot_slot", { slot: slot.slot })} price={number(slot.price)} currency={currencyIcon(slot.currency)} size="s" disabled={!slot.canAfford} className="bag-buy-slot"
            aria-label={tr("msg.buy_slot_slot_price_currency", { slot: slot.slot, price: number(slot.price), currency: currencyName(slot.currency) })} onPress={buySlot} />
        : <GameButton className="bag-slot" data-locked="" aria-label={tr("msg.slot_slot_unlocks_at_unlockname", { slot: slot.slot, unlockName: slot.unlockName })} blurAfterPress={false}
            onPress={() => toast(tr("msg.reach_unlockname_to_unlock_slot_slot", { unlockName: slot.unlockName, slot: slot.slot }))}><Icon kind="lock" /></GameButton>)}
    </div>
    <div className="bag-totals" aria-label={tr("msg.team_total_bonus")}>
      <span><Icon kind={currencyIcon(pets.currency)} /><b className="ui-num">{bonusLabel(pets.bonus[pets.currency])}</b></span>
      <span><Icon kind="pickaxe" /><b className="ui-num">{tr("msg.mining_bonus", { bonus: bonusLabel(pets.bonus.mining) })}</b></span>
    </div>
    <span className="ui-grow" />
    <UiButton size="s" tone="white" disabled={!equipped} onPress={() => { session.pets.unequipAll(); toast(tr("msg.all_pets_unequipped")); }}>{tr("msg.unequip_all")}</UiButton>
    <UiButton size="s" tone="orange" className="bag-equip-best" data-better={better || undefined} onPress={() => { session.pets.equipBest(); toast(tr("msg.strongest_pets_equipped")); }}>
      {tr("msg.equip_best")}{better && <b className="ui-badge ui-outline">!</b>}
    </UiButton>
  </section>;
  return <Sheet {...common}>
    {team}
    <div className="bag-pets">
      <div className="ui-grid bag-pet-grid" role="list" aria-label={tr("msg.pets")}>
        {cards.map(card => {
          const ready = !card.golden && card.mergeable >= pets.goldenNeed && !mergeMarked.has(card.pet.speciesId);
          if (ready) mergeMarked.add(card.pet.speciesId);
          return <GameButton key={card.pet.id} role="listitem" className="ui-cell" data-rarity={card.rarity}
            data-equipped={card.equippedSlot !== null ? '' : undefined} data-golden={card.golden ? '' : undefined} aria-pressed={card.pet.id === selected?.pet.id} blurAfterPress={false}
            aria-label={tr("msg.name_income_mining_mining_state", { name: card.name, income: bonusLabel(card.bonusPct, card.currency), mining: bonusLabel(card.miningPct), state: card.equippedSlot === null ? tr("msg.not_equipped") : tr("msg.equipped_a68821c6") })}
            onPress={() => setSelectedId(card.pet.id)}>
            <PetArt speciesId={card.pet.speciesId} rarity={card.rarity} /><span className="ui-cell-name ui-outline">{card.name}</span>
            <span className="ui-cell-stat ui-outline"><Icon kind={currencyIcon(card.currency)} className="ui-icon ui-cell-currency" />{bonusLabel(card.bonusPct)}</span>
            {card.equippedSlot !== null && <i className="ui-cell-check">✓</i>}
            {ready && <i className="bag-merge-ready" aria-hidden="true">{pets.goldenNeed}/{pets.goldenNeed}</i>}
          </GameButton>;
        })}
        <GameButton className="ui-cell bag-get" aria-label={tr("msg.get_pets")} onPress={() => setFinding(true)}>
          <EggArt className="bag-get-art" /><span className="ui-cell-name">{tr("msg.get_pets")}</span><Icon kind="plus" className="ui-icon bag-get-plus" />
        </GameButton>
      </div>
      {selected ? <aside className="ui-detail bag-detail" data-rarity={selected.rarity} data-golden={selected.golden ? '' : undefined} aria-label={tr("msg.pet_details")}>
        <div className="bag-detail-head">
          <PetArt speciesId={selected.pet.speciesId} rarity={selected.rarity} className="bag-detail-art" />
          <div><RarityTag rarity={selected.rarity} /><h3 className="ui-outline">{selected.name}</h3></div>
        </div>
        <div className="ui-stat"><span><Icon kind={currencyIcon(selected.currency)} />{tr("msg.currency_income", { currency: currencyName(selected.currency) })}</span><b>{bonusLabel(selected.bonusPct)}</b></div>
        <div className="ui-stat"><span><Icon kind="pickaxe" />{tr("msg.mining_speed")}</span><b>{bonusLabel(selected.miningPct)}</b></div>
        {selected.currency !== pets.currency && <small className="bag-detail-note">{tr("msg.adds_income_in_world", { world: WORLD_OF[selected.currency].name })}</small>}
        {!selected.golden && (selected.mergeable >= pets.goldenNeed
          ? <UiButton size="s" tone="gold" className="bag-merge" aria-label={tr("msg.make_golden_name_have_mergeable_goldenneed", { name: selected.name, mergeable: selected.mergeable, goldenNeed: pets.goldenNeed })} onPress={() => merge(selected)}>{tr("msg.make_golden_n_n", { n: pets.goldenNeed })}</UiButton>
          : <div className="bag-golden" aria-label={tr("msg.golden_have_need", { have: selected.mergeable, need: pets.goldenNeed })}><Bar value={selected.mergeable} max={pets.goldenNeed} tone="gold" size="s">{tr("msg.golden_have_need", { have: selected.mergeable, need: pets.goldenNeed })}</Bar></div>)}
        <UiButton size="s" tone={selected.equippedSlot !== null ? 'white' : 'green'} className="bag-equip" onPress={() => toggle(selected)}>{selected.equippedSlot !== null ? tr("msg.unequip") : tr("msg.equip")}</UiButton>
      </aside> : <aside className="ui-detail bag-detail bag-detail-empty" aria-label={tr("msg.pet_details")}>
        <PetArt speciesId="moss-slime" className="bag-detail-art" /><h3 className="ui-outline">{tr("msg.no_pets_yet")}</h3>
        <small className="bag-detail-note">{tr("msg.hatch_eggs_at_the_stands_then_equip_pets_to_mine_together")}</small>
        <UiButton size="m" tone="green" icon="paw" className="bag-equip" onPress={() => setFinding(true)}>{tr("msg.hatch_eggs")}</UiButton>
      </aside>}
    </div>
    {toastView}
  </Sheet>;
}

/** Where to get pets: the eggs of one world at a time (the current one first), each with its price and a button that
 *  travels to its stand; a locked egg stays dark and says where it unlocks. */
function EggFinder({ session, pets, common, onBack, onClose }: { session: GameSession; pets: PetPanelSnapshot; common: Common; onBack(): void; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const open = state.worlds.filter(w => w.open);
  const [world, setWorld] = useState<CurrencyId>(pets.currency);
  const eggs = pets.eggs.filter(egg => egg.currency === world);
  return <Sheet {...common} className={`${common.className} bag-finder`}>
    <div className="bag-finder-bar">
      <UiButton size="s" tone="white" onPress={onBack}>{tr("msg.back_to_pets")}</UiButton>
      {open.length > 1 && <div className="ui-seg" role="group" aria-label={tr("msg.worlds")}>{open.map(w =>
        <button key={w.id} type="button" aria-pressed={w.currency === world} onClick={() => setWorld(w.currency)}>{w.name}</button>)}</div>}
      <span className="ui-hint ui-grow">{tr("msg.tap_go_to_teleport_to_a_stand_walk_up_to_see_the_odds_and_ha")}</span>
    </div>
    {/* The whole card is the button (it travels to the stand); a locked egg is a plain card saying where it unlocks. */}
    <div className="bag-eggs" data-count={eggs.length}>{eggs.map(egg => {
      const face = <>
        <EggArt className="bag-egg-art" eggId={egg.id} locked={!egg.unlocked} />
        <b className="bag-egg-name">{egg.unlocked ? egg.name : MYSTERY_EGG_NAME}</b>
        <span className="bag-egg-price"><Icon kind={currencyIcon(egg.currency)} /><b className="ui-num">{number(egg.price)}</b></span>
        <span className="bag-egg-go">{egg.unlocked ? tr("msg.go") : tr("msg.reach_unlockname", { unlockName: egg.unlockName ?? tr("msg.deeper_down") })}</span>
      </>;
      return egg.unlocked
        ? <GameButton key={egg.id} className="bag-egg" aria-label={tr("msg.go_to_the_name_stand", { name: egg.name })} onPress={() => { if (session.goTo({ egg: egg.id }) === 'travelling') onClose(); }}>{face}</GameButton>
        : <div key={egg.id} className="bag-egg" data-locked="" aria-label={tr("msg.mystery_egg_name_unlocks_at_unlockname", { MYSTERY_EGG_NAME: MYSTERY_EGG_NAME, unlockName: egg.unlockName ?? tr("msg.deeper_down") })}>{face}</div>;
    })}</div>
  </Sheet>;
}

function OresTab({ session, common, onClose }: Props & { common: Common }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const bag = state.inventory;
  const rows = Object.entries(bag.items).filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, count, item: itemDefinition(id) }))
    .sort((a, b) => b.item.price * b.count - a.item.price * a.count);
  const sale = state.sale.status === 'quoted' ? state.sale : null;
  // The ticket the stored minerals are for: the closed worlds that ask for them.
  const ticketWorlds = state.worlds.filter(w => !w.open && w.materials.some(m => state.materials.some(s => s.itemId === m.itemId)));
  return <Sheet {...common}>
    <div className="bag-sell">
      <div className="bag-capacity"><Bar value={bag.used} max={bag.capacity} tone={bag.isFull ? 'gold' : undefined}>{tr("msg.bag_used_capacity", { used: number(bag.used), capacity: number(bag.capacity) })}</Bar></div>
      <span className="bag-sell-value" aria-label={tr("msg.sells_for_coins_currency", { coins: sale ? number(sale.coins) : 0, currency: currencyName(state.currency) })}>{tr("msg.sells_for")}<Icon kind={currencyIcon(state.currency)} /><b className="ui-num">{sale ? number(sale.coins) : 0}</b></span>
      {state.inSellZone
        ? <UiButton size="s" tone="green" icon={currencyIcon(state.currency)} disabled={!sale?.count} onPress={() => { session.sellAvailable(); }}>{tr("msg.sell_all")}</UiButton>
        : <UiButton size="s" tone="green" icon={currencyIcon(state.currency)} disabled={!sale?.count} onPress={() => { if (session.goTo('sale') === 'travelling') onClose(); }}>{tr("msg.teleport_to_sell")}</UiButton>}
    </div>
    {/* Each mineral a ticket asks for, with its lock (the same as its cell's below): locked ones go into the store as
        they are dug (and what the bag holds of them moves in), never sold; unlocking puts them back in the bag to sell.
        Nothing is locked at first. */}
    {state.materials.length > 0 && <section className="bag-ticket" aria-label={tr("msg.material_store")}>
      <header><Icon kind="portal" /><b>{tr("msg.material_store")}</b><span>{tr("msg.for_the_worlds_ticket_locked_ones_are_never_sold_and_go_here", { worlds: ticketWorlds.map(w => w.name).join(tr("msg.label")) })}</span></header>
      <div className="bag-ticket-items">{state.materials.map(m => <GameButton key={m.itemId} className="bag-ticket-item" data-done={m.stored >= m.needed ? '' : undefined}
        aria-pressed={m.locked} aria-label={m.locked ? tr("msg.name_locked_stored_needed_tap_to_unlock_and_put_the_stored_o", { name: m.name, stored: m.stored, needed: m.needed })
          : tr("msg.name_not_locked_it_will_be_sold_tap_to_lock", { name: m.name })}
        onPress={() => { if (m.locked) session.unlockItem(m.itemId); else session.lockItem(m.itemId); }}>
        <Icon kind={m.locked ? 'lock' : 'unlock'} className="ui-icon bag-ticket-lock" />
        <OreIcon color={itemDefinition(m.itemId).color} className="bag-ticket-icon" /><span>{m.name}</span>
        <Bar value={m.stored} max={m.needed} size="s">{number(Math.min(m.stored, m.needed))}/{number(m.needed)}</Bar>
        {m.stored >= m.needed && <i className="ui-cell-check">✓</i>}
      </GameButton>)}</div>
    </section>}
    {/* Every cell is a lock toggle (2026-10-31: any ore, rock too): a locked kind stays in the bag when it sells. */}
    {rows.length > 0 && <small className="ui-hint bag-ores-hint">{tr("msg.tap_an_ore_to_lock_it_and_keep_it_when_you_sell")}</small>}
    {rows.length ? <div className="ui-grid bag-ores" aria-label={tr("msg.ores")}>{rows.map(row => {
      const locked = bag.locked.includes(row.id);
      return <GameButton key={row.id} className="ui-cell" aria-pressed={locked}
        aria-label={locked ? tr("msg.name_count_locked_kept_when_you_sell_tap_to_unlock", { name: row.item.name, count: row.count })
          : tr("msg.name_count_price_each_tap_to_lock", { name: row.item.name, count: row.count, price: row.item.price })}
        onPress={() => { if (locked) session.unlockItem(row.id); else session.lockItem(row.id); }}>
        <span className="ui-cell-name ui-outline">{resolveText(row.item.name)}</span><OreIcon color={row.item.color} className="bag-ore-art" />
        <Icon kind={locked ? 'lock' : 'unlock'} className="ui-icon bag-ore-lock" />
        <span className="bag-ore-volume">{tr("msg.block_capacity", { volume: number(row.item.volume) })}</span>
        <span className="bag-ore-price"><Icon kind={currencyIcon(state.currency)} />{number(row.item.price)}</span>
        <span className="ui-cell-stat ui-outline">×{number(row.count)}</span>
      </GameButton>;
    })}</div> : <div className="bag-empty"><Icon kind="pickaxe" className="ui-icon bag-empty-art" /><b>{tr("msg.your_bag_is_empty")}</b><span className="ui-hint">{tr("msg.go_mining_ore_goes_straight_into_your_bag")}</span></div>}
  </Sheet>;
}

function GearTab({ session, common, onShop }: Props & { common: Common }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const tools = state.shopCatalog.tools, bags = state.shopCatalog.backpacks;
  const tool = tools.find(item => item.level === state.pickaxe.level) ?? tools[0];
  const nextTool = tools.find(item => item.level === state.equipment.toolLevel + 1);
  const bag = bags.find(item => item.capacity === state.inventory.capacity) ?? bags[0];
  const nextBag = bags.find(item => item.capacity! > state.equipment.backpackCapacity);
  // Where the next item is sold: this world's surface shop, or the shop of its hall of layer 2 or 4 once reached; a
  // later world's in that world. Not open yet: the card says where instead of a button.
  const soldAt = (item: ShopItem) => {
    if (item.world !== state.currentWorld) return { open: false, place: WORLD_REQUIREMENTS[item.world - 1].name };
    const hall = item.shop ? state.destinations[item.shop - 1] : null;
    return { open: !hall || hall.unlocked, place: hall?.name ?? '' };
  };
  const card = (kind: 'tools' | 'backpacks') => {
    const current = kind === 'tools' ? tool : bag, next = kind === 'tools' ? nextTool : nextBag;
    return <div className="ui-card-tile bag-gear" data-kind={kind}>
      <div className="bag-gear-art"><Icon kind={kind === 'tools' ? 'pickaxe' : 'backpack'} /><span className="bag-gear-level ui-num">Lv.{current.level}<small>/{kind === 'tools' ? tools.length : bags.length}</small></span></div>
      <div className="bag-gear-info"><h4 className="ui-outline">{resolveText(current.name)}{kind === 'tools' && state.pickaxe.enhance ? ` +${state.pickaxe.enhance}` : ''}</h4>
        {kind === 'tools' ? <><div className="ui-stat"><span>{tr("msg.damage")}</span><b>+{number(state.pickaxe.basePower)}</b></div><div className="ui-stat"><span>{tr("msg.speed")}</span><b>{tr("msg.n_s", { n: current.speed! })}</b></div></>
          : <><div className="ui-stat"><span>{tr("msg.capacity")}</span><b>{number(current.capacity!)}</b></div><div className="ui-stat"><span>{tr("msg.carrying")}</span><b>{number(state.inventory.used)}</b></div></>}
        {next ? <div className="bag-gear-next"><small>{tr("msg.next")} <b>{resolveText(next.name)}</b> · {kind === 'tools' ? tr("msg.damage_power", { power: number(next.power!) }) : tr("msg.capacity_capacity", { capacity: number(next.capacity!) })}</small>
          {soldAt(next).open ? <PriceButton verb={tr("msg.to_shop")} price={number(next.price)} currency={currencyIcon(next.currency)} size="s" tone="orange" onPress={() => onShop(kind)} />
            : <span className="ui-hint bag-gear-where">{tr("msg.sold_at_the_place_shop", { place: soldAt(next).place })}</span>}</div>
          : <span className="ui-stamp">{tr("msg.already_the_best")}</span>}
      </div>
    </div>;
  };
  return <Sheet {...common}>
    <div className="bag-gears">{card('tools')}{card('backpacks')}</div>
    <span className="ui-hint">{tr("msg.gear_you_ve_bought_can_be_re_equipped_for_free_in_the_shop")}</span>
  </Sheet>;
}
