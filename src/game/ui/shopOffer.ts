import type { ShopCategory, ShopItem } from '../content/shopCatalog.ts';

type Snapshot = Readonly<{
  coins: number;
  pickaxe: Readonly<{ level: number }>;
  inventory: Readonly<{ capacity: number; used: number }>;
  equipment: Readonly<{ toolLevel: number; backpackCapacity: number }>;
  backpackUpgrade: Readonly<{ next?: Readonly<{ id: string }> | null }>;
}>;

export type OfferState = 'equipped' | 'owned' | 'next' | 'locked';
/** The step of the tier ladder an item sits on: 1-10 plain, 11-20 精工, 21-30 星辉. */
export type OfferTier = 'plain' | 'fine' | 'star';
export type OfferStat = Readonly<{ key: 'power' | 'speed' | 'capacity'; label: string; value: number; current: number; max: number; unit: string }>;

export const offerTier = (item: ShopItem): OfferTier => item.level <= 10 ? 'plain' : item.level <= 20 ? 'fine' : 'star';
export const TIER_LABEL: Readonly<Record<OfferTier, string>> = { plain: '普通', fine: '精工', star: '星辉' };

/** Where an item stands for the player: worn now, bought before, the next one to buy, or further up. */
export function offerState(category: ShopCategory, item: ShopItem, s: Snapshot): OfferState {
  const equipped = category === 'tools' ? item.level === s.pickaxe.level : item.capacity === s.inventory.capacity;
  if (equipped) return 'equipped';
  const owned = category === 'tools' ? item.level <= s.equipment.toolLevel : item.capacity! <= s.equipment.backpackCapacity;
  if (owned) return 'owned';
  const next = category === 'tools' ? item.level === s.equipment.toolLevel + 1 : item.id === s.backpackUpgrade.next?.id;
  return next ? 'next' : 'locked';
}

/** The item's numbers next to what the player carries now, and the best in the shop (for the bars). */
export function offerStats(category: ShopCategory, item: ShopItem, items: readonly ShopItem[], s: Snapshot): OfferStat[] {
  const last = items[items.length - 1];
  if (category === 'backpacks') return [{ key: 'capacity', label: '容量', value: item.capacity!, current: s.inventory.capacity, max: last.capacity!, unit: '' }];
  const worn = items.find(i => i.level === s.pickaxe.level) ?? items[0];
  return [
    { key: 'power', label: '力量', value: item.power!, current: worn.power!, max: last.power!, unit: '' },
    { key: 'speed', label: '攻速', value: item.speed!, current: worn.speed!, max: last.speed!, unit: '/秒' },
  ];
}

/** What the buy button says and whether it works. */
export function offerAction(category: ShopCategory, item: ShopItem, s: Snapshot, state = offerState(category, item, s)) {
  const tooSmall = category === 'backpacks' && item.capacity! < s.inventory.used;
  const affordable = s.coins >= item.price;
  if (state === 'equipped') return { label: '已装备', enabled: false, buy: false };
  if (state === 'owned') return tooSmall ? { label: '先卖掉矿石', enabled: false, buy: false } : { label: '装备', enabled: true, buy: false };
  if (state === 'locked') return { label: '先买上一件', enabled: false, buy: false };
  // Short of coins: the panel writes the missing amount in the game's number style.
  return affordable ? { label: '购买', enabled: true, buy: true } : { label: '还差', enabled: false, buy: false, short: item.price - s.coins };
}
