import { LAYER_ITEMS } from './journeyResources.ts';
import { ECONOMY } from './economy.ts';
// Stable logical identities: every layer's rock, dense rock and two ores (kinds 64 + 4 × layer + 0..3), with their
// health and price from economy.json. Every block takes one place in the bag. No renderer or layer dependency;
// kind 7 is reserved for protected terrain.
/** `requiredLevel`: the pickaxe an ore needs at all (its layer's gate). Rock and a layer's cap need none (2026-10-31:
 *  the levels gate only what pays; plain blocks are as slow as their health makes them). */
export type Resource = Readonly<{ kind: number; itemId: string; name: string; color: string; volume: number; maxHp: number; price: number; pattern: string; base: boolean; requiredLevel: number }>;
export const RESOURCES: readonly Resource[] = Object.freeze(LAYER_ITEMS.flatMap((items, i) => {
  const layer = ECONOMY.layers[i], kind = 64 + i * 4;
  const block = (look: typeof items.rock, numbers: { itemId: string; hp: number; price: number }, offset: number, base: boolean): Resource => {
    if (numbers.itemId !== look.itemId) throw Error(`economy.json 第 ${i} 层的方块对不上: ${numbers.itemId}`);
    return Object.freeze({ ...look, kind: kind + offset, volume: 1, maxHp: numbers.hp, price: numbers.price, base, requiredLevel: base ? 0 : layer.gate });
  };
  return [block(items.rock, layer.rock, 0, true), block(items.deep, layer.deep, 1, true), ...items.ores.map((ore, j) => block(ore, layer.ores[j], 2 + j, false))];
}));
const byKind = new Map(RESOURCES.map(r => [r.kind, r]));
const byId = new Map(RESOURCES.map(r => [r.itemId, r]));
export function resourceByKind(kind: number) { const r = byKind.get(kind); if (!r) throw new Error(`未知矿物配置 ${kind}`); return r; }
export function resourceById(id: string) { const r = byId.get(id); if (!r) throw new Error(`未知物品配置 ${id}`); return r; }
