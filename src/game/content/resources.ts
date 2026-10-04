// Stable logical identities. No renderer or layer dependency; kind 7 is reserved for protected terrain.
export type Resource = Readonly<{ kind: number; itemId: string; name: string; color: string; volume: number; maxHp: number; price: number; pattern: string; base: boolean }>;
export const RESOURCES: readonly Resource[] = Object.freeze([
  Object.freeze({ kind: 1, itemId: 'ore.stone', name: '岩石', color: '#929b91', volume: 1, maxHp: 10, price: 1, pattern: 'rock', base: true }),
  Object.freeze({ kind: 2, itemId: 'ore.deep_stone', name: '深层岩石', color: '#626e79', volume: 2, maxHp: 30, price: 4, pattern: 'strata', base: true }),
  Object.freeze({ kind: 3, itemId: 'ore.coal', name: '煤', color: '#303a3d', volume: 3, maxHp: 50, price: 8, pattern: 'chunk', base: false }),
  Object.freeze({ kind: 4, itemId: 'ore.copper', name: '铜', color: '#d88651', volume: 5, maxHp: 90, price: 16, pattern: 'vein', base: false }),
  Object.freeze({ kind: 5, itemId: 'ore.gold', name: '金', color: '#edbd4d', volume: 10, maxHp: 200, price: 40, pattern: 'chunk', base: false }),
  Object.freeze({ kind: 6, itemId: 'ore.crystal', name: '水晶', color: '#76e0e7', volume: 15, maxHp: 350, price: 80, pattern: 'crystal', base: false }),
  Object.freeze({ kind: 8, itemId: 'ore.soil', name: '泥土', color: '#ad8161', volume: 1, maxHp: 10, price: 1, pattern: 'soil', base: true }),
  Object.freeze({ kind: 9, itemId: 'ore.granite', name: '花岗岩', color: '#868f95', volume: 3, maxHp: 45, price: 7, pattern: 'rock', base: true }),
  Object.freeze({ kind: 10, itemId: 'ore.sandstone', name: '砂岩', color: '#c7a274', volume: 5, maxHp: 75, price: 23, pattern: 'strata', base: true }),
  Object.freeze({ kind: 11, itemId: 'ore.ice_rock', name: '冰岩', color: '#83b5c4', volume: 6, maxHp: 110, price: 26, pattern: 'ice', base: true }),
  Object.freeze({ kind: 12, itemId: 'ore.basalt', name: '玄武岩', color: '#50535a', volume: 7, maxHp: 135, price: 29, pattern: 'strata', base: true }),
  Object.freeze({ kind: 13, itemId: 'ore.fossil_rock', name: '化石岩', color: '#a16b58', volume: 8, maxHp: 155, price: 35, pattern: 'fossil', base: true }),
  Object.freeze({ kind: 14, itemId: 'ore.alloy_rock', name: '合金岩', color: '#70838b', volume: 9, maxHp: 180, price: 42, pattern: 'metal', base: true }),
  Object.freeze({ kind: 15, itemId: 'ore.core_rock', name: '地心岩', color: '#5c647c', volume: 10, maxHp: 210, price: 52, pattern: 'core', base: true }),
  Object.freeze({ kind: 16, itemId: 'ore.iron', name: '铁', color: '#99a9ae', volume: 4, maxHp: 65, price: 12, pattern: 'vein', base: false }),
  Object.freeze({ kind: 17, itemId: 'ore.silver', name: '银', color: '#d0e1e5', volume: 7, maxHp: 125, price: 26, pattern: 'vein', base: false }),
  Object.freeze({ kind: 18, itemId: 'ore.emerald', name: '翡翠', color: '#5ed494', volume: 12, maxHp: 270, price: 65, pattern: 'chunk', base: false }),
  Object.freeze({ kind: 19, itemId: 'ore.amethyst', name: '紫水晶', color: '#b092e1', volume: 13, maxHp: 300, price: 73, pattern: 'crystal', base: false }),
  Object.freeze({ kind: 20, itemId: 'ore.sapphire', name: '蓝宝石', color: '#648dea', volume: 14, maxHp: 325, price: 79, pattern: 'gem', base: false }),
  Object.freeze({ kind: 21, itemId: 'ore.ruby', name: '红宝石', color: '#e76c7b', volume: 15, maxHp: 365, price: 92, pattern: 'gem', base: false }),
  Object.freeze({ kind: 22, itemId: 'ore.diamond', name: '钻石', color: '#b9f3ed', volume: 18, maxHp: 440, price: 126, pattern: 'gem', base: false }),
  Object.freeze({ kind: 23, itemId: 'ore.sulfur', name: '硫磺', color: '#e3da67', volume: 9, maxHp: 190, price: 42, pattern: 'chunk', base: false }),
  Object.freeze({ kind: 24, itemId: 'ore.obsidian', name: '黑曜石', color: '#75688b', volume: 16, maxHp: 390, price: 105, pattern: 'strata', base: false }),
  Object.freeze({ kind: 25, itemId: 'ore.amber', name: '琥珀', color: '#e4a251', volume: 11, maxHp: 240, price: 59, pattern: 'amber', base: false }),
  Object.freeze({ kind: 26, itemId: 'ore.fossil_fragment', name: '化石碎片', color: '#e9dcc1', volume: 17, maxHp: 420, price: 120, pattern: 'fossil', base: false }),
  Object.freeze({ kind: 27, itemId: 'ore.cobalt', name: '钴', color: '#6b93b8', volume: 16, maxHp: 400, price: 112, pattern: 'vein', base: false }),
  Object.freeze({ kind: 28, itemId: 'ore.titanium', name: '钛', color: '#b9c8cf', volume: 19, maxHp: 475, price: 140, pattern: 'metal', base: false }),
  Object.freeze({ kind: 29, itemId: 'ore.energy_crystal', name: '能源晶石', color: '#61d9cb', volume: 20, maxHp: 510, price: 160, pattern: 'crystal', base: false }),
  Object.freeze({ kind: 30, itemId: 'ore.star_crystal', name: '星辉晶石', color: '#ba9dea', volume: 23, maxHp: 600, price: 205, pattern: 'star', base: false }),
  Object.freeze({ kind: 31, itemId: 'ore.core_crystal', name: '地心晶石', color: '#f4d78c', volume: 26, maxHp: 720, price: 265, pattern: 'star', base: false }),
]);
const byKind = new Map(RESOURCES.map(r => [r.kind, r]));
const byId = new Map(RESOURCES.map(r => [r.itemId, r]));
export function resourceByKind(kind: number) { const r = byKind.get(kind); if (!r) throw new Error(`未知矿物配置 ${kind}`); return r; }
export function resourceById(id: string) { const r = byId.get(id); if (!r) throw new Error(`未知物品配置 ${id}`); return r; }
