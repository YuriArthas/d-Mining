import { pickaxeStats, type Pickaxe } from '../logic/Pickaxe.ts';
import type { Wallet } from '../logic/Wallet.ts';
export const PICKAXE_PRICES = Object.freeze({ first: 5, perLevel: 2 });
export function pickaxeOffer(level: number, coins: number) {
  // No gameplay level cap; only refuse values outside JavaScript safe integers.
  const price = PICKAXE_PRICES.first + (level - 1) * PICKAXE_PRICES.perLevel;
  let next: ReturnType<typeof pickaxeStats> | null = null;
  if (Number.isSafeInteger(price)) {
    try { next = pickaxeStats(level + 1); } catch { /* Numeric representation limit. */ }
  }
  return Object.freeze({ next, price, canAfford: next !== null && coins >= price });
}
export function upgradePickaxe(expectedLevel: number, pickaxe: Pick<Pickaxe, 'getSnapshot' | 'setLevel'>, wallet: Pick<Wallet, 'getBalance' | 'debit'>) {
  const { level } = pickaxe.getSnapshot();
  if (level !== expectedLevel) return { status: 'stale' } as const;
  const offer = pickaxeOffer(level, wallet.getBalance());
  if (!offer.next) return { status: 'limit' } as const;
  if (!wallet.debit(offer.price)) return { status: 'insufficient' } as const;
  pickaxe.setLevel(offer.next.level);
  return { status: 'upgraded', level: offer.next.level, spent: offer.price } as const;
}
