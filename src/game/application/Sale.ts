import { integer } from '../logic/numbers.ts';
import type { Inventory } from '../logic/Inventory.ts';
import type { Wallet } from '../logic/Wallet.ts';
type UnitPrice = (itemId: string) => number;
type SaleQuote = Readonly<{ status: 'quoted'; count: number; coins: number }> | Readonly<{ status: 'overflow' }>;
type SaleReceipt = Readonly<{ status: 'sold'; count: number; coins: number }> | Readonly<{ status: 'empty' | 'overflow' }>;
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
/** Sells `items` (by default the whole bag) at once: every check precedes the transfer, so a refused
 *  sale changes neither the bag nor the wallet. */
export function sellItems(inventory: Pick<Inventory, 'getSnapshot' | 'remove'>, wallet: Pick<Wallet, 'canCredit' | 'credit'>, unitPrice: UnitPrice, items: Readonly<Record<string, number>> = inventory.getSnapshot().items): SaleReceipt {
  const quote = quoteSale(items, unitPrice);
  if (quote.status === 'overflow') return quote;
  if (!quote.count) return { status: 'empty' };
  if (!wallet.canCredit(quote.coins)) return { status: 'overflow' };
  if (!inventory.remove(Object.entries(items).map(([itemId, count]) => ({ itemId, count })))) throw new Error('售卖库存发生意外变化');
  wallet.credit(quote.coins);
  return { status: 'sold', count: quote.count, coins: quote.coins };
}
