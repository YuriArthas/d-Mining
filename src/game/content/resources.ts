import { JOURNEY_RESOURCES } from './journeyResources.ts';
// Stable logical identities: the journey's blocks and ores (kinds 64+). No renderer or layer dependency;
// kind 7 is reserved for protected terrain.
export type Resource = Readonly<{ kind: number; itemId: string; name: string; color: string; volume: number; maxHp: number; price: number; pattern: string; base: boolean; requiredLevel?: number }>;
export const RESOURCES: readonly Resource[] = JOURNEY_RESOURCES;
const byKind = new Map(RESOURCES.map(r => [r.kind, r]));
const byId = new Map(RESOURCES.map(r => [r.itemId, r]));
export function resourceByKind(kind: number) { const r = byKind.get(kind); if (!r) throw new Error(`未知矿物配置 ${kind}`); return r; }
export function resourceById(id: string) { const r = byId.get(id); if (!r) throw new Error(`未知物品配置 ${id}`); return r; }
