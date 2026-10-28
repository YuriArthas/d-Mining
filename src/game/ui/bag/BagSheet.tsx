import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import type { PetCardView, PetPanelSnapshot } from '../../application/PetUiAdapter.ts';
import { itemDefinition } from '../../application/items.ts';
import type { CurrencyId } from '../../content/economy.ts';
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

import { tr } from '../../i18n/i18n.ts';
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
    { id: 'pets', label: tr('宠物'), icon: 'paw', badge: teamCanImprove(pets) ? '!' : undefined },
    { id: 'ores', label: tr('矿物'), icon: 'gem' },
    { id: 'gear', label: tr('装备§gear'), icon: 'pickaxe' },
  ];
  // The title names the open tab: “背包” is already the bag capacity, a shop counter and an item.
  const common = { title: { pets: tr('宠物'), ores: tr('矿物'), gear: tr('装备§gear') }[props.tab], tabs, tab: props.tab, onTab: props.onTab, onClose: props.onClose, className: `bag-sheet bag-tab-${props.tab}` };
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
    const text = result.status === 'bought' ? tr('第 {slots} 格开放了，可以多带一只宠物', { slots: result.slots }) : result.status === 'insufficient' ? '' : result.status === 'locked' ? tr('到达{unlockName}后才能买', { unlockName: slot?.unlockName }) : tr('请稍后再试');
    if (text) toast(text);
  };
  const merge = (card: PetCardView) => {
    const result = session.pets.mergeGolden(card.pet.speciesId);
    if (result.status === 'merged') { setSelectedId(result.pet.id); toast(tr('{goldenNeed} 只{name}合成了金色{name2}！', { goldenNeed: pets.goldenNeed, name: card.name, name2: card.name })); }
    else toast(tr('需要 {goldenNeed} 只一样的普通{name}', { goldenNeed: pets.goldenNeed, name: card.name }));
  };
  const toggle = (card: PetCardView) => {
    if (card.equippedSlot !== null) { session.pets.unequip(card.pet.id); toast(tr('已卸下 {name}', { name: card.name })); return; }
    const result = session.pets.equip(card.pet.id);
    toast(result.status === 'equipped' ? tr('已装备 {name}', { name: card.name }) : result.status === 'full' ? tr('栏位满了：先卸下一只，或点一键最佳') : tr('这只宠物已不在背包里'));
  };
  const byId = new Map(cards.map(card => [card.pet.id, card]));
  // A species ready for a golden merge is marked once, on its first card.
  const mergeMarked = new Set<string>();
  const team = <section className="bag-team" aria-label={tr('出战队伍')}>
    <div className="bag-slots" role="list" aria-label={tr('栏位 {equipped} / {slots}', { equipped: equipped, slots: pets.slots.length })}>
      {pets.slots.map((id, i) => {
        const card = id ? byId.get(id) : undefined;
        return <GameButton key={i} role="listitem" className="bag-slot" data-rarity={card?.rarity} data-empty={card ? undefined : ''} blurAfterPress={false}
          aria-label={card ? tr('第 {i} 格：{name}', { i: i + 1, name: card.name }) : tr('第 {i} 格：空', { i: i + 1 })}
          onPress={() => card ? setSelectedId(card.pet.id) : toast(tr('选一只宠物，再点「装备」'))}>
          {card ? <PetArt speciesId={card.pet.speciesId} rarity={card.rarity} className="bag-slot-art" /> : <Icon kind="plus" />}
        </GameButton>;
      })}
      {slot && (slot.unlocked
        ? <PriceButton verb={tr('第 {slot} 格', { slot: slot.slot })} price={number(slot.price)} currency={currencyIcon(slot.currency)} size="s" disabled={!slot.canAfford} className="bag-buy-slot"
            aria-label={tr('购买第 {slot} 格，{price} {currency}', { slot: slot.slot, price: number(slot.price), currency: currencyName(slot.currency) })} onPress={buySlot} />
        : <GameButton className="bag-slot" data-locked="" aria-label={tr('第 {slot} 格，到达{unlockName}解锁', { slot: slot.slot, unlockName: slot.unlockName })} blurAfterPress={false}
            onPress={() => toast(tr('到达{unlockName}解锁第 {slot} 格', { unlockName: slot.unlockName, slot: slot.slot }))}><Icon kind="lock" /></GameButton>)}
    </div>
    <div className="bag-totals" aria-label={tr('队伍总加成')}>
      <span><Icon kind={currencyIcon(pets.currency)} /><b className="ui-num">{bonusLabel(pets.bonus[pets.currency])}</b></span>
      <span><Icon kind="pickaxe" /><b className="ui-num">{tr('挖矿 {bonus}', { bonus: bonusLabel(pets.bonus.mining) })}</b></span>
    </div>
    <span className="ui-grow" />
    <UiButton size="s" tone="white" disabled={!equipped} onPress={() => { session.pets.unequipAll(); toast(tr('已卸下全部宠物')); }}>{tr('全部卸下')}</UiButton>
    <UiButton size="s" tone="orange" className="bag-equip-best" data-better={better || undefined} onPress={() => { session.pets.equipBest(); toast(tr('已装备最强的宠物')); }}>
      {tr('一键最佳')}{better && <b className="ui-badge ui-outline">!</b>}
    </UiButton>
  </section>;
  return <Sheet {...common}>
    {team}
    <div className="bag-pets">
      <div className="ui-grid bag-pet-grid" role="list" aria-label={tr('宠物')}>
        {cards.map(card => {
          const ready = !card.golden && card.mergeable >= pets.goldenNeed && !mergeMarked.has(card.pet.speciesId);
          if (ready) mergeMarked.add(card.pet.speciesId);
          return <GameButton key={card.pet.id} role="listitem" className="ui-cell" data-rarity={card.rarity}
            data-equipped={card.equippedSlot !== null ? '' : undefined} data-golden={card.golden ? '' : undefined} aria-pressed={card.pet.id === selected?.pet.id} blurAfterPress={false}
            aria-label={tr('{name}，{income}，挖矿 {mining}，{state}', { name: card.name, income: bonusLabel(card.bonusPct, card.currency), mining: bonusLabel(card.miningPct), state: card.equippedSlot === null ? tr('未装备') : tr('已装备') })}
            onPress={() => setSelectedId(card.pet.id)}>
            <PetArt speciesId={card.pet.speciesId} rarity={card.rarity} /><span className="ui-cell-name ui-outline">{card.name}</span>
            <span className="ui-cell-stat ui-outline"><Icon kind={currencyIcon(card.currency)} className="ui-icon ui-cell-currency" />{bonusLabel(card.bonusPct)}</span>
            {card.equippedSlot !== null && <i className="ui-cell-check">✓</i>}
            {ready && <i className="bag-merge-ready" aria-hidden="true">{pets.goldenNeed}/{pets.goldenNeed}</i>}
          </GameButton>;
        })}
        <GameButton className="ui-cell bag-get" aria-label={tr('获取宠物')} onPress={() => setFinding(true)}>
          <EggArt className="bag-get-art" /><span className="ui-cell-name">{tr('获取宠物')}</span><Icon kind="plus" className="ui-icon bag-get-plus" />
        </GameButton>
      </div>
      {selected ? <aside className="ui-detail bag-detail" data-rarity={selected.rarity} data-golden={selected.golden ? '' : undefined} aria-label={tr('宠物详情')}>
        <div className="bag-detail-head">
          <PetArt speciesId={selected.pet.speciesId} rarity={selected.rarity} className="bag-detail-art" />
          <div><RarityTag rarity={selected.rarity} /><h3 className="ui-outline">{selected.name}</h3></div>
        </div>
        <div className="ui-stat"><span><Icon kind={currencyIcon(selected.currency)} />{tr('{currency}收入', { currency: currencyName(selected.currency) })}</span><b>{bonusLabel(selected.bonusPct)}</b></div>
        <div className="ui-stat"><span><Icon kind="pickaxe" />{tr('挖矿速度')}</span><b>{bonusLabel(selected.miningPct)}</b></div>
        {selected.currency !== pets.currency && <small className="bag-detail-note">{tr('在{world}加收入', { world: WORLD_OF[selected.currency].name })}</small>}
        {!selected.golden && (selected.mergeable >= pets.goldenNeed
          ? <UiButton size="s" tone="gold" className="bag-merge" aria-label={tr('合成金色{name}，已有 {mergeable} / {goldenNeed}', { name: selected.name, mergeable: selected.mergeable, goldenNeed: pets.goldenNeed })} onPress={() => merge(selected)}>{tr('合成金色 {n}/{n}', { n: pets.goldenNeed })}</UiButton>
          : <div className="bag-golden" aria-label={tr('金色合成 {mergeable} / {goldenNeed}', { mergeable: selected.mergeable, goldenNeed: pets.goldenNeed })}><Bar value={selected.mergeable} max={pets.goldenNeed} tone="gold" size="s">{tr('金色 {have}/{need}', { have: selected.mergeable, need: pets.goldenNeed })}</Bar></div>)}
        <UiButton size="s" tone={selected.equippedSlot !== null ? 'white' : 'green'} className="bag-equip" onPress={() => toggle(selected)}>{selected.equippedSlot !== null ? tr('卸下') : tr('装备')}</UiButton>
      </aside> : <aside className="ui-detail bag-detail bag-detail-empty" aria-label={tr('宠物详情')}>
        <PetArt speciesId="moss-slime" className="bag-detail-art" /><h3 className="ui-outline">{tr('还没有宠物')}</h3>
        <small className="bag-detail-note">{tr('去蛋台开蛋，装备后一起挖矿')}</small>
        <UiButton size="m" tone="green" icon="paw" className="bag-equip" onPress={() => setFinding(true)}>{tr('去开蛋')}</UiButton>
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
      <UiButton size="s" tone="white" onPress={onBack}>{tr('返回宠物')}</UiButton>
      {open.length > 1 && <div className="ui-seg" role="group" aria-label={tr('世界')}>{open.map(w =>
        <button key={w.id} type="button" aria-pressed={w.currency === world} onClick={() => setWorld(w.currency)}>{w.name}</button>)}</div>}
      <span className="ui-hint ui-grow">{tr('点「前往」传送到蛋台，靠近后看概率、开蛋')}</span>
    </div>
    {/* The whole card is the button (it travels to the stand); a locked egg is a plain card saying where it unlocks. */}
    <div className="bag-eggs" data-count={eggs.length}>{eggs.map(egg => {
      const face = <>
        <EggArt className="bag-egg-art" eggId={egg.id} locked={!egg.unlocked} />
        <b className="bag-egg-name">{egg.unlocked ? egg.name : MYSTERY_EGG_NAME}</b>
        <span className="bag-egg-price"><Icon kind={currencyIcon(egg.currency)} /><b className="ui-num">{number(egg.price)}</b></span>
        <span className="bag-egg-go">{egg.unlocked ? tr('前往') : tr('到达{unlockName}', { unlockName: egg.unlockName ?? tr('更深处') })}</span>
      </>;
      return egg.unlocked
        ? <GameButton key={egg.id} className="bag-egg" aria-label={tr('前往{name}蛋台', { name: egg.name })} onPress={() => { if (session.goTo({ egg: egg.id }) === 'travelling') onClose(); }}>{face}</GameButton>
        : <div key={egg.id} className="bag-egg" data-locked="" aria-label={tr('{MYSTERY_EGG_NAME}，到达{unlockName}解锁', { MYSTERY_EGG_NAME: MYSTERY_EGG_NAME, unlockName: egg.unlockName ?? tr('更深处') })}>{face}</div>;
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
      <div className="bag-capacity"><Bar value={bag.used} max={bag.capacity} tone={bag.isFull ? 'gold' : undefined}>{tr('背包 {used} / {capacity}', { used: number(bag.used), capacity: number(bag.capacity) })}</Bar></div>
      <span className="bag-sell-value" aria-label={tr('可卖 {coins} {currency}', { coins: sale ? number(sale.coins) : 0, currency: currencyName(state.currency) })}>{tr('可卖')}<Icon kind={currencyIcon(state.currency)} /><b className="ui-num">{sale ? number(sale.coins) : 0}</b></span>
      {state.inSellZone
        ? <UiButton size="s" tone="green" icon={currencyIcon(state.currency)} disabled={!sale?.count} onPress={() => { session.sellAvailable(); }}>{tr('全部出售')}</UiButton>
        : <UiButton size="s" tone="green" icon={currencyIcon(state.currency)} disabled={!bag.used} onPress={() => { if (session.goTo('sale') === 'travelling') onClose(); }}>{tr('传送出售')}</UiButton>}
    </div>
    {state.materials.length > 0 && <section className="bag-ticket" aria-label={tr('材料仓')}>
      <header><Icon kind="portal" /><b>{tr('材料仓')}</b><span>{tr('{worlds}门票要用 · 挖到自动存入，不占背包、不会卖掉', { worlds: ticketWorlds.map(w => w.name).join(tr('、')) })}</span></header>
      <div className="bag-ticket-items" role="list">{state.materials.map(m => <div key={m.itemId} role="listitem" className="bag-ticket-item" data-done={m.stored >= m.needed ? '' : undefined}
        aria-label={`${m.name} ${m.stored} / ${m.needed}`}>
        <OreIcon color={itemDefinition(m.itemId).color} className="bag-ticket-icon" /><span>{m.name}</span>
        <Bar value={m.stored} max={m.needed} size="s">{number(Math.min(m.stored, m.needed))}/{number(m.needed)}</Bar>
        {m.stored >= m.needed && <i className="ui-cell-check">✓</i>}
      </div>)}</div>
    </section>}
    {rows.length ? <div className="ui-grid bag-ores" role="list" aria-label={tr('矿物')}>{rows.map(row => <div key={row.id} role="listitem" className="ui-cell"
      aria-label={tr('{name} {count} 个，单价 {price}', { name: row.item.name, count: row.count, price: row.item.price })}>
      <span className="ui-cell-name ui-outline">{row.item.name}</span><OreIcon color={row.item.color} className="bag-ore-art" />
      <span className="bag-ore-price"><Icon kind={currencyIcon(state.currency)} />{number(row.item.price)}</span>
      <span className="ui-cell-stat ui-outline">×{number(row.count)}</span>
    </div>)}</div> : <div className="bag-empty"><Icon kind="pickaxe" className="ui-icon bag-empty-art" /><b>{tr('背包是空的')}</b><span className="ui-hint">{tr('下矿井挖矿，矿石会自动装进来')}</span></div>}
  </Sheet>;
}

function GearTab({ session, common, onShop }: Props & { common: Common }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const tools = state.shopCatalog.tools, bags = state.shopCatalog.backpacks;
  const tool = tools.find(item => item.level === state.pickaxe.level) ?? tools[0];
  const nextTool = tools.find(item => item.level === state.equipment.toolLevel + 1);
  const bag = bags.find(item => item.capacity === state.inventory.capacity) ?? bags[0];
  const nextBag = bags.find(item => item.capacity! > state.equipment.backpackCapacity);
  const card = (kind: 'tools' | 'backpacks') => {
    const current = kind === 'tools' ? tool : bag, next = kind === 'tools' ? nextTool : nextBag;
    return <div className="ui-card-tile bag-gear" data-kind={kind}>
      <div className="bag-gear-art"><Icon kind={kind === 'tools' ? 'pickaxe' : 'backpack'} /><span className="bag-gear-level ui-num">Lv.{current.level}<small>/{kind === 'tools' ? tools.length : bags.length}</small></span></div>
      <div className="bag-gear-info"><h4 className="ui-outline">{current.name}{kind === 'tools' && state.pickaxe.enhance ? ` +${state.pickaxe.enhance}` : ''}</h4>
        {kind === 'tools' ? <><div className="ui-stat"><span>{tr('伤害')}</span><b>+{number(state.pickaxe.basePower)}</b></div><div className="ui-stat"><span>{tr('攻速')}</span><b>{tr('{n} 次/秒', { n: current.speed })}</b></div></>
          : <><div className="ui-stat"><span>{tr('容量')}</span><b>{number(current.capacity!)}</b></div><div className="ui-stat"><span>{tr('已装')}</span><b>{number(state.inventory.used)}</b></div></>}
        {next ? <div className="bag-gear-next"><small>{tr('下一件')} <b>{next.name}</b> · {kind === 'tools' ? tr('伤害 +{power}', { power: number(next.power!) }) : tr('容量 {capacity}', { capacity: number(next.capacity!) })}</small>
          <PriceButton verb={tr('去商店')} price={number(next.price)} currency={currencyIcon(next.currency)} size="s" tone="orange" onPress={() => onShop(kind)} /></div>
          : <span className="ui-stamp">{tr('已经是最好的了')}</span>}
      </div>
    </div>;
  };
  return <Sheet {...common}>
    <div className="bag-gears">{card('tools')}{card('backpacks')}</div>
    <span className="ui-hint">{tr('买过的旧装备可以在商店免费换回。')}</span>
  </Sheet>;
}
