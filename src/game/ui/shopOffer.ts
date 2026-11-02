import { formatNumber } from '../presentation/formatNumber.ts';
import type { ShopCategory, ShopItem } from '../content/shopCatalog.ts';
import type { CurrencyId } from '../content/economy.ts';
import { pickaxeStats } from '../logic/Pickaxe.ts';
import { ECONOMY } from '../content/economy.ts';
import { JOURNEY_WORLDS } from '../content/journeyWorlds.ts';

import { tr } from '../i18n/i18n.ts';
type Snapshot = Readonly<{
  balances: Readonly<Record<CurrencyId, number>>;
  pickaxe: Readonly<{ level: number }>;
  inventory: Readonly<{ capacity: number; used: number }>;
  equipment: Readonly<{ toolLevel: number; backpackCapacity: number; enhance?: number; tools?: readonly number[]; backpacks?: readonly number[] }>;
  backpackUpgrade: Readonly<{ next?: Readonly<{ id: string }> | null }>;
}>;

type OfferState = 'equipped' | 'owned' | 'next';
/** The world an item belongs to, which colours its name: 1-10 plain, 11-20 cyan, 21-30 gold. */
type OfferTier = 'plain' | 'fine' | 'star';
type OfferStat = Readonly<{ key: 'power' | 'speed' | 'capacity'; label: string; value: number; current: number; max: number; unit: string }>;

export const offerTier = (item: ShopItem): OfferTier => item.level <= 10 ? 'plain' : item.level <= 20 ? 'fine' : 'star';

/** Where an item stands for the player: worn now, bought before, the next one to buy, or further up. */
export function offerState(category: ShopCategory, item: ShopItem, s: Snapshot): OfferState {
  const equipped = category === 'tools' ? item.level === s.pickaxe.level : item.capacity === s.inventory.capacity;
  if (equipped) return 'equipped';
  const owned = category === 'tools' ? (s.equipment.tools?.includes(item.level) ?? item.level <= s.equipment.toolLevel) : (s.equipment.backpacks?.includes(item.capacity!) ?? item.capacity! <= s.equipment.backpackCapacity);
  if (owned) return 'owned';
  return 'next';
}

/** The item's numbers next to what the player carries now, and the best in the shop (for the bars). */
export function offerStats(category: ShopCategory, item: ShopItem, items: readonly ShopItem[], s: Snapshot): OfferStat[] {
  const last = items[items.length - 1];
  if (category === 'backpacks') return [{ key: 'capacity', label: tr("msg.capacity"), value: item.capacity!, current: s.inventory.capacity, max: last.capacity!, unit: '' }];
  const worn = items.find(i => i.level === s.pickaxe.level) ?? items[0];
  // The newest pickaxe counts with its enhancements (+1..+3); older ones were never enhanced.
  const power = (i: ShopItem) => i.level === s.equipment.toolLevel && s.equipment.enhance ? pickaxeStats(i.level, 1, s.equipment.enhance).power : i.power!;
  return [
    { key: 'power', label: tr("msg.damage"), value: power(item), current: power(worn), max: last.power!, unit: '' },
    { key: 'speed', label: tr("msg.speed"), value: item.speed!, current: worn.speed!, max: last.speed!, unit: tr("msg.s") },
  ];
}

/** The world a shop item belongs to: the world whose currency buys it. */
export const offerWorld = (item: ShopItem) => ({ gold: 1, tech: 2, star: 3 } as const)[item.currency];
/** How deep a pickaxe of this level digs in its own world: the deepest layer whose gate it meets. */
export function toolReach(level: number) {
  const world = level <= 10 ? 1 : level <= 20 ? 2 : 3, layers = JOURNEY_WORLDS[world - 1].layers;
  let reach = layers[0].name;
  layers.forEach((layer, local) => { if (ECONOMY.layers[(world - 1) * 7 + local].gate <= level) reach = layer.name; });
  return reach;
}
/** The gain over what the player carries, as the shop shows it: damage as a multiple (×1.5), speed and capacity
 *  as an increase (+0.5, +5); nothing for an item that is not better. */
export function offerGain(stat: Readonly<{ key: 'power' | 'speed' | 'capacity'; value: number; current: number }>) {
  if (!(stat.value > stat.current) || stat.current <= 0) return null;
  if (stat.key === 'power') { const r = stat.value / stat.current; return `×${r >= 10 ? Math.round(r) : Math.round(r * 10) / 10}`; }
  return `+${formatNumber(Math.round((stat.value - stat.current) * 100) / 100)}`;
}

/** What the buy button says and whether it works. */
export function offerAction(category: ShopCategory, item: ShopItem, s: Snapshot, state = offerState(category, item, s)) {
  const tooSmall = category === 'backpacks' && item.capacity! < s.inventory.used && item.capacity! < s.inventory.capacity;
  const balance = s.balances[item.currency], affordable = balance >= item.price;
  if (state === 'equipped') return { label: tr("msg.equipped_a68821c6"), enabled: false, buy: false };
  if (state === 'owned') return tooSmall ? { label: tr("msg.sell_your_ore_first"), enabled: false, buy: false } : { label: tr("msg.equip"), enabled: true, buy: false };
  if (tooSmall) return { label: tr("msg.sell_your_ore_first"), enabled: false, buy: false };
  // Short of coins: the same button with its price, greyed (never a missing amount).
  return { label: tr("msg.buy"), enabled: affordable, buy: affordable };
}
