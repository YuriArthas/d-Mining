import type { Inventory } from '../logic/Inventory.ts';
import type { Wallet } from '../logic/Wallet.ts';

// Temporary progression values, kept outside Inventory/Wallet and presentation.
export const BACKPACK_TIERS = Object.freeze([
  Object.freeze({ id: 'bag-100', capacity: 100, price: 20 }),
  Object.freeze({ id: 'bag-200', capacity: 200, price: 50 }),
  Object.freeze({ id: 'bag-400', capacity: 400, price: 100 }),
]);
export function backpackOffer(capacity: number, coins: number) {
  const next = BACKPACK_TIERS.find(tier => tier.capacity > capacity) ?? null;
  return Object.freeze({ next, canAfford: next !== null && coins >= next.price });
}
export type UpgradeResult = { status: 'upgraded'; capacity: number; spent: number } | { status: 'max' | 'stale' | 'insufficient' };
export function upgradeBackpack(
  tierId: string,
  inventory: Pick<Inventory, 'getSnapshot' | 'setCapacity'>,
  wallet: Pick<Wallet, 'getBalance' | 'debit'>,
): UpgradeResult {
  const { next } = backpackOffer(inventory.getSnapshot().capacity, wallet.getBalance());
  if (!next) return { status: 'max' };
  // A repeat click on an old offer cannot buy that tier again or silently buy the next one.
  if (next.id !== tierId) return { status: 'stale' };
  if (!wallet.debit(next.price)) return { status: 'insufficient' };
  inventory.setCapacity(next.capacity);
  return { status: 'upgraded', capacity: next.capacity, spent: next.price };
}
