import { useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import type { PetCardView, PetPanelSnapshot } from '../../application/PetUiAdapter.ts';
import { itemDefinition } from '../../application/items.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { GameButton } from '../GameButton.tsx';
import { OreIcon } from '../InventoryIcons.tsx';
import { UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Bar, Chip, RarityTag, Sheet, type SheetTab } from '../kit/panel.tsx';
import { EggArt } from '../pets/EggArt.tsx';
import { MYSTERY_EGG_NAME } from '../../content/petAppearance.ts';
import { PetArt } from '../pets/PetArt.tsx';
import { bonusLabel } from '../pets/petDisplay.ts';
import './bag.css';
import { currencyIcon, currencyName } from '../currency.ts';
import { WORLD_REQUIREMENTS } from '../../content/worldJourney.ts';

const WORLD_NAMES = Object.fromEntries(WORLD_REQUIREMENTS.map(w => [w.currency, w.name]));

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

export function BagSheet(props: Props) {
  const pets = useSyncExternalStore(props.session.pets.subscribe, props.session.pets.getSnapshot);
  const tabs: SheetTab<BagTab>[] = [
    { id: 'pets', label: '宠物', icon: 'paw', badge: teamCanImprove(pets) ? '!' : undefined },
    { id: 'ores', label: '矿物', icon: <OreIcon color="#76e0e7" className="ui-icon" /> },
    { id: 'gear', label: '装备', icon: 'pickaxe' },
  ];
  // The title names the open tab: “背包” is already the bag capacity, a shop counter and an item.
  const common = { title: { pets: '宠物', ores: '矿物', gear: '装备' }[props.tab], tabs, tab: props.tab, onTab: props.onTab, onClose: props.onClose };
  if (props.tab === 'ores') return <OresTab {...props} common={common} />;
  if (props.tab === 'gear') return <GearTab {...props} common={common} />;
  return <PetsTab {...props} pets={pets} common={common} />;
}
type Common = { title: string; tabs: SheetTab<BagTab>[]; tab: BagTab; onTab(tab: BagTab): void; onClose(): void };

function PetsTab({ session, pets, common, onClose }: Props & { pets: PetPanelSnapshot; common: Common }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot), slot = state.petSlot;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [finding, setFinding] = useState(false);
  // Equipped first, then the pets that count in this world, strongest first; other worlds' pets after them.
  const cards = [...pets.pets].sort((a, b) => Number(b.equippedSlot !== null) - Number(a.equippedSlot !== null) || here(pets, b) - here(pets, a) || b.bonusPct - a.bonusPct);
  const selected = cards.find(card => card.pet.id === selectedId) ?? cards[0] ?? null;
  const equipped = pets.slots.filter(id => id !== null).length;
  if (finding) return <Sheet {...common} footer={<><UiButton size="s" tone="steel" onPress={() => setFinding(false)}>返回宠物</UiButton><span className="ui-hint">点「前往」直接传送到蛋台，靠近后查看概率并开蛋。</span></>}>
    <div className="bag-eggs">{pets.eggs.map(egg => <div key={egg.id} className="ui-card-tile bag-egg" data-locked={egg.unlocked ? undefined : ''}>
      <EggArt className="bag-egg-art" eggId={egg.id} locked={!egg.unlocked} />
      <h4 className="ui-outline">{egg.unlocked ? egg.name : MYSTERY_EGG_NAME}</h4>
      <Chip icon={currencyIcon(egg.currency)}><b>{number(egg.price)}</b></Chip>
      {egg.unlocked ? <UiButton size="s" tone="orange" aria-label={`前往${egg.name}蛋台`} onPress={() => { if (session.goTo({ egg: egg.id }) === 'travelling') onClose(); }}>前往</UiButton>
        : <small>到达{egg.unlockName ?? '更深处'}解锁</small>}
    </div>)}</div>
  </Sheet>;
  const buySlot = () => {
    const result = session.buyPetSlot(pets.slots.length);
    setMessage(result.status === 'bought' ? `第 ${result.slots} 格开放了，可以多带一只宠物` : result.status === 'insufficient' ? '钱还不够' : result.status === 'locked' ? `到达${slot?.unlockName}后才能买` : '请稍后再试');
  };
  const merge = (card: PetCardView) => {
    const result = session.pets.mergeGolden(card.pet.speciesId);
    if (result.status === 'merged') { setSelectedId(result.pet.id); setMessage(`${pets.goldenNeed} 只${card.name}合成了金色${card.name}！`); }
    else setMessage(`需要 ${pets.goldenNeed} 只一样的普通${card.name}`);
  };
  const toggle = (card: PetCardView) => {
    if (card.equippedSlot !== null) { session.pets.unequip(card.pet.id); setMessage(`已卸下 ${card.name}`); return; }
    const result = session.pets.equip(card.pet.id);
    setMessage(result.status === 'equipped' ? `已装备 ${card.name}` : result.status === 'full' ? '装备位已满：先卸下一只，或点一键最佳' : '这只宠物已不在背包里');
  };
  // With no pets yet, the body explains where to get one; the footer offers only that.
  return <Sheet {...common} footer={<>
    <UiButton size="s" tone="green" icon="paw" onPress={() => setFinding(true)}>获取宠物</UiButton>
    {cards.length > 0 && <>
      <span className="ui-hint bag-message" role="status">{message || `本世界宠物加${currencyName(pets.currency)}收入，所有宠物加挖矿速度`}</span>
      <span className="ui-grow" />
      {selected && <UiButton size="s" tone={selected.equippedSlot !== null ? 'steel' : 'purple'} className="bag-compact-equip" onPress={() => toggle(selected)}>{selected.equippedSlot !== null ? '卸下' : '装备'}</UiButton>}
      <UiButton size="s" tone="steel" disabled={!equipped} onPress={() => { session.pets.unequipAll(); setMessage('已卸下全部宠物'); }}>全部卸下</UiButton>
      <UiButton size="s" tone="orange" className="bag-equip-best" onPress={() => { session.pets.equipBest(); setMessage('已装备最强的宠物'); }}>一键最佳</UiButton>
    </>}
  </>}>
    {cards.length ? <div className="bag-pets">
      <div className="bag-pets-main"><div className="ui-row"><Chip icon="paw">已装备 <b>{equipped} / {pets.slots.length}</b></Chip><Chip icon={currencyIcon(pets.currency)}>总加成 <b>{bonusLabel(pets.bonus[pets.currency])}</b></Chip><Chip icon="pickaxe">挖矿 <b>{bonusLabel(pets.bonus.mining)}</b></Chip>
        {slot && (slot.unlocked
          ? <UiButton size="s" tone={slot.canAfford ? 'green' : 'steel'} icon={currencyIcon(slot.currency)} className="bag-buy-slot" disabled={!slot.canAfford} aria-label={`购买第 ${slot.slot} 格，${number(slot.price)} ${currencyName(slot.currency)}`} onPress={buySlot}>+1 格 · {number(slot.price)}</UiButton>
          : <Chip label={`到达${slot.unlockName}解锁第 ${slot.slot} 格`}>第 {slot.slot} 格 · 🔒</Chip>)}<span className="ui-grow" /><Chip>{cards.length} 只</Chip></div>
      <div className="ui-grid" role="list" aria-label="宠物">{cards.map(card => <GameButton key={card.pet.id} role="listitem" className="ui-cell" data-rarity={card.rarity}
        data-equipped={card.equippedSlot !== null ? '' : undefined} data-golden={card.golden ? '' : undefined} aria-pressed={card.pet.id === selected?.pet.id} blurAfterPress={false}
        aria-label={`${card.name}，${bonusLabel(card.bonusPct, card.currency)}，挖矿 ${bonusLabel(card.miningPct)}，${card.equippedSlot === null ? '未装备' : '已装备'}`}
        onPress={() => { setSelectedId(card.pet.id); setMessage(''); }}>
        <PetArt speciesId={card.pet.speciesId} rarity={card.rarity} /><span className="ui-cell-name ui-outline">{card.name}</span>
        <span className="ui-cell-stat ui-outline"><Icon kind={currencyIcon(card.currency)} className="ui-icon ui-cell-currency" />{bonusLabel(card.bonusPct)}</span>{card.equippedSlot !== null && <i className="ui-cell-check">✓</i>}
      </GameButton>)}</div></div>
      {selected && <aside className="ui-detail bag-detail" data-rarity={selected.rarity} aria-label="宠物详情">
        <RarityTag rarity={selected.rarity} /><PetArt speciesId={selected.pet.speciesId} rarity={selected.rarity} className="bag-detail-art" />
        <h3 className="ui-outline">{selected.name}</h3>
        <div className="ui-stat"><span>{currencyName(selected.currency)}收入</span><b>{bonusLabel(selected.bonusPct)}</b></div>
        <div className="ui-stat"><span>挖矿速度</span><b>{bonusLabel(selected.miningPct)}</b></div>
        {selected.currency !== pets.currency && <small className="bag-detail-note">{WORLD_NAMES[selected.currency]}才加收入</small>}
        {!selected.golden && <UiButton size="s" tone={selected.mergeable >= pets.goldenNeed ? 'orange' : 'steel'} className="bag-merge" disabled={selected.mergeable < pets.goldenNeed}
          aria-label={`合成金色${selected.name}，已有 ${selected.mergeable} / ${pets.goldenNeed}`} onPress={() => merge(selected)}>金色合成 {Math.min(selected.mergeable, pets.goldenNeed)}/{pets.goldenNeed}</UiButton>}
        <UiButton size="s" tone={selected.equippedSlot !== null ? 'steel' : 'purple'} onPress={() => toggle(selected)}>{selected.equippedSlot !== null ? '卸下' : '装备'}</UiButton>
      </aside>}
    </div> : <div className="bag-empty ui-well"><PetArt speciesId="moss-slime" className="bag-empty-art" /><b className="ui-outline">还没有宠物</b><span className="ui-hint">点「获取宠物」去蛋台开蛋，装备后一起挖矿</span></div>}
  </Sheet>;
}

function OresTab({ session, common, onClose }: Props & { common: Common }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const bag = state.inventory;
  const rows = Object.entries(bag.items).filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, count, item: itemDefinition(id), reservation: state.mineralReservations[id] }))
    .sort((a, b) => b.item.price - a.item.price);
  const selected = rows.find(row => row.id === selectedId) ?? null;
  const needed = (id: string) => state.worlds.some(w => w.known && !w.open && w.materials.some(m => m.itemId === id));
  const sale = state.sale.status === 'quoted' ? state.sale : null;
  return <Sheet {...common} footer={<>
    {selected ? <div className="bag-reserve"><b className="ui-outline">{selected.item.name}</b>
      <div className="ui-seg" role="group" aria-label={`${selected.item.name}保留方式`}>
        {([['none', '不保留'], ...(needed(selected.id) ? [['needed', '保留所需']] : []), ['all', '全部保留']] as [ 'none' | 'needed' | 'all', string][]).map(([mode, label]) =>
          <GameButton key={mode} aria-pressed={selected.reservation?.mode === mode} blurAfterPress={false} onPress={() => session.reserveMineral(selected.id, mode)}>{label}</GameButton>)}
      </div></div>
      : <span className="ui-hint">点矿物可以设为「保留」：解锁下一个世界需要的矿物就不会被卖掉。</span>}
    <span className="ui-grow" />
    {state.inSellZone
      ? <UiButton size="s" tone="green" icon={currencyIcon(state.currency)} disabled={!sale?.count} onPress={() => { session.sellAvailable(); }}>出售可售矿物</UiButton>
      : <UiButton size="s" tone="green" icon={currencyIcon(state.currency)} disabled={!bag.used} onPress={() => { if (session.goTo('sale') === 'travelling') onClose(); }}>传送出售</UiButton>}
  </>}>
    <div className="ui-row"><div className="bag-capacity"><Bar value={bag.used} max={bag.capacity} tone={bag.isFull ? 'gold' : undefined}>容量 {number(bag.used)} / {number(bag.capacity)}</Bar></div>
      <Chip icon={currencyIcon(state.currency)}>可售 {sale ? number(sale.count) : 0} 件 · 约 <b>{sale ? number(sale.coins) : 0}</b></Chip></div>
    {rows.length ? <div className="ui-grid bag-ores" role="list" aria-label="矿物">{rows.map(row => <GameButton key={row.id} role="listitem" className="ui-cell" aria-pressed={row.id === selected?.id} blurAfterPress={false}
      aria-label={`${row.item.name} ${row.count} 个，单价 ${row.item.price}`} onPress={() => setSelectedId(row.id === selectedId ? null : row.id)}>
      <span className="ui-cell-name ui-outline">{row.item.name}</span><OreIcon color={row.item.color} className="bag-ore-art" />
      <span className="ui-cell-stat ui-outline">×{number(row.count)}</span><span className="ui-cell-note ui-outline">{number(row.item.price)}</span>
      {!!row.reservation?.reserved && <span className="ui-stamp bag-kept">保留 {number(row.reservation.reserved)}</span>}
    </GameButton>)}</div> : <div className="bag-empty ui-well"><Icon kind="pickaxe" className="ui-icon bag-empty-art" /><b className="ui-outline">背包是空的</b><span className="ui-hint">下矿井挖矿，矿石会自动装进来</span></div>}
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
      <div className="bag-gear-art"><Icon kind={kind === 'tools' ? 'pickaxe' : 'backpack'} /><span className="ui-rarity" data-rarity="common">Lv.{current.level} / {kind === 'tools' ? tools.length : bags.length}</span></div>
      <div className="bag-gear-info"><h4 className="ui-outline">{current.name}{kind === 'tools' && state.pickaxe.enhance ? ` +${state.pickaxe.enhance}` : ''}</h4>
        {kind === 'tools' ? <><div className="ui-stat"><span>力量</span><b>+{number(state.pickaxe.basePower)}</b></div><div className="ui-stat"><span>攻速</span><b>{current.speed} 次/秒</b></div></>
          : <><div className="ui-stat"><span>容量</span><b>{number(current.capacity!)}</b></div><div className="ui-stat"><span>已装</span><b>{number(state.inventory.used)}</b></div></>}
        <div className="ui-well bag-gear-next">{next ? <><small>下一件</small><b className="ui-outline">{next.name} · {kind === 'tools' ? `力量 +${number(next.power!)}` : `容量 ${number(next.capacity!)}`}</b><Chip icon={currencyIcon(next.currency)}><b>{number(next.price)}</b></Chip></>
          : <b className="ui-outline">已经是最好的了</b>}</div>
      </div>
    </div>;
  };
  return <Sheet {...common} footer={<><span className="ui-hint">在商店换更强的镐子和更大的背包；买过的旧装备可以免费换回。</span><span className="ui-grow" />
    <UiButton size="s" tone="orange" icon="chest" onPress={() => onShop('tools')}>打开商店</UiButton></>}>
    <div className="bag-gears">{card('tools')}{card('backpacks')}</div>
  </Sheet>;
}
