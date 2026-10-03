// Temporary values: relative price growth > HP growth > volume growth.
// Definitions stay immutable throughout a session; geometry size is unchanged.
export const ORE_ITEMS = Object.freeze([
  Object.freeze({ kind: 1, volume: 1, maxHp: 10, price: 1, itemId: 'ore.stone', name: '岩石', color: '#87918c' }),
  Object.freeze({ kind: 2, volume: 2, maxHp: 30, price: 4, itemId: 'ore.deep_stone', name: '深层岩石', color: '#465773' }),
  Object.freeze({ kind: 3, volume: 3, maxHp: 50, price: 8, itemId: 'ore.coal', name: '煤', color: '#292d34' }),
  Object.freeze({ kind: 4, volume: 5, maxHp: 90, price: 16, itemId: 'ore.copper', name: '铜', color: '#d67d42' }),
  Object.freeze({ kind: 5, volume: 10, maxHp: 200, price: 40, itemId: 'ore.gold', name: '金', color: '#f1c653' }),
  Object.freeze({ kind: 6, volume: 15, maxHp: 350, price: 80, itemId: 'ore.crystal', name: '水晶', color: '#58d7e8' }),
]);
export function itemDefinition(itemId: string) {
  const item = ORE_ITEMS.find(item => item.itemId === itemId);
  if (!item) throw new Error(`未知物品配置 ${itemId}`);
  return item;
}
export const itemVolume = (itemId: string) => itemDefinition(itemId).volume;
export const itemPrice = (itemId: string) => itemDefinition(itemId).price;
export function oreDrops(resources: readonly { kind: number }[]) {
  return resources.map(({ kind }) => {
    const item = ORE_ITEMS.find(item => item.kind === kind);
    if (!item) throw new Error(`未知掉落配置 ${kind}`);
    return { itemId: item.itemId, count: 1 };
  });
}
// On the existing permanent spawn platform (top y=2), away from its ramp and walls.
export const SELL_ZONE = Object.freeze({ x: 2, y: 2, z: 18, radius: 1.7, heightTolerance: 0.25, hysteresis: 0.25 });
export const SURFACE_RETURN = [-2, 2.1, 14] as const;

export function oreDefinition(kind: number) {
  const item = ORE_ITEMS.find(item => item.kind === kind);
  if (!item) throw new Error(`未知矿物配置 ${kind}`);
  return item;
}
