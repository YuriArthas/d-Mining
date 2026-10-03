import { integer } from '../logic/numbers.ts';
import type { Inventory } from '../logic/Inventory.ts';
import type { Wallet } from '../logic/Wallet.ts';
export type UnitPrice = (itemId: string) => number;
export type SaleQuote = Readonly<{ status: 'quoted'; count: number; coins: number }> | Readonly<{ status: 'overflow' }>;
export type SaleReceipt = Readonly<{ status: 'sold'; count: number; coins: number }> | Readonly<{ status: 'empty' | 'overflow' }>;
// Pricing knows item quantities and an external price lookup, never occupied capacity.
export function quoteSale(items: Readonly<Record<string, number>>, unitPrice: UnitPrice): SaleQuote {
  let count = 0, coins = 0;
  for (const [id, quantity] of Object.entries(items)) {
    integer(quantity, '物品数量');
    const price = integer(unitPrice(id), '售价');
    count += quantity; coins += quantity * price;
    if (!Number.isSafeInteger(count) || !Number.isSafeInteger(coins)) return { status: 'overflow' };
  }
  return Object.freeze({ status: 'quoted', count, coins });
}
export function sellAll(inventory: Pick<Inventory, 'getSnapshot' | 'remove'>, wallet: Pick<Wallet, 'canCredit' | 'credit'>, unitPrice: UnitPrice): SaleReceipt {
  const state = inventory.getSnapshot(), quote = quoteSale(state.items, unitPrice);
  if (quote.status === 'overflow') return quote;
  if (!quote.count) return { status: 'empty' };
  if (!wallet.canCredit(quote.coins)) return { status: 'overflow' };
  const items = Object.entries(state.items).map(([itemId, count]) => ({ itemId, count }));
  if (!inventory.remove(items)) throw new Error('售卖库存发生意外变化');
  wallet.credit(quote.coins);
  return { status: 'sold', count: quote.count, coins: quote.coins };
}
