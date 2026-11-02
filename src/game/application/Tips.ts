import type { TipId } from '../logic/Onboarding.ts';

/** Where a tip points: the mine on the map, the first block to dig, or a HUD control. */
type TipAnchor = 'mine' | 'dig' | 'sell' | 'shop' | 'pets' | 'station' | 'portal';
export type Tip = Readonly<{ id: TipId; anchor: TipAnchor }>;
export type TipState = Readonly<{
  seen: (id: TipId) => boolean;
  location: 'surface' | 'mine' | 'room' | null;
  atMine: boolean;
  minedOnce: boolean;
  soldOnce: boolean;
  full: boolean;
  items: number;
  coins: number;
  level: number;
  upgradePrice: number;
  pets: number;
  eggPrice: number | null;
  layerUnlocked: boolean;
  atStation: boolean;
  atPortal: boolean;
  highestWorld: number;
  readyWorld: 2 | 3 | null;
}>;

/** Seconds a HUD tip stays before it counts as seen anyway. The first-dig tip waits for the first block. */
export const TIP_SECONDS: Readonly<Record<TipId, number>> = { dig: Infinity, sell: 12, shop: 12, pets: 20, station: 20, portal: 20, world2: 25, world3: 25 };
/** Quiet seconds after a tip, so tips never chain into a checklist. */
export const TIP_GAP = 6;

/** The player already did it, so the tip has nothing left to teach. */
export function tipLearned(id: TipId, s: TipState) {
  switch (id) {
    case 'dig': return s.minedOnce;
    case 'sell': return s.soldOnce;
    case 'shop': return s.level >= 2;
    case 'pets': return s.pets > 0;
    case 'station': return s.atStation;
    case 'portal': return s.atPortal || s.highestWorld >= 2;
    case 'world2': return s.highestWorld >= 2;
    case 'world3': return s.highestWorld >= 3;
  }
}

/** The moment a tip becomes worth showing: when the player first needs it, not before. */
export function tipRelevant(id: TipId, s: TipState) {
  switch (id) {
    case 'dig': return s.location !== null;
    case 'sell': return s.full && s.items > 0;
    case 'shop': return s.soldOnce && s.coins >= s.upgradePrice;
    case 'pets': return s.soldOnce && s.eggPrice !== null && s.coins >= s.eggPrice && (s.level >= 2 || s.seen('shop'));
    case 'station': return s.layerUnlocked && s.location === 'surface';
    case 'portal': return s.layerUnlocked && s.readyWorld === null;
    case 'world2': return s.readyWorld === 2;
    case 'world3': return s.readyWorld === 3;
  }
}

export function nextTip(s: TipState): TipId | null {
  if (s.location === null) return null;
  // Full bags need selling first. An affordable world ticket takes priority over spending on upgrades or eggs.
  const order: readonly TipId[] = s.full ? ['sell'] : ['dig', 'world2', 'world3', 'shop', 'pets', 'station', 'portal'];
  return order.find(id => !s.seen(id) && !tipLearned(id, s) && tipRelevant(id, s)) ?? null;
}

export function tipView(id: TipId, s: TipState): Tip {
  return { id, anchor: id === 'dig' ? (s.location === 'surface' && !s.atMine ? 'mine' : 'dig') : id === 'world2' || id === 'world3' ? 'portal' : id };
}

export type DepthGoal = Readonly<{ id: string; name: string; depth: number; currentDepth: number; remainingDepth: number }>;
export function selectDepthGoal(maxDepth: number, destinations: readonly { id: string; name: string; depth: number; unlocked: boolean }[]): DepthGoal | null {
  // The nearest depth not reached yet, independent of content table ordering or the current floor.
  const next = destinations.filter(d => !d.unlocked && d.depth > maxDepth).sort((a, b) => a.depth - b.depth)[0];
  return next ? Object.freeze({ id: next.id, name: next.name, depth: next.depth, currentDepth: maxDepth, remainingDepth: next.depth - maxDepth }) : null;
}
