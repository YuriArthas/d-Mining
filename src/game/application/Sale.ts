import { integer } from '../logic/numbers.ts';
import type { Inventory } from '../logic/Inventory.ts';
type UnitPrice = (itemId: string) => number;
type Till = { canCredit(amount: number): boolean; credit(amount: number): void };
type SaleQuote = Readonly<{ status: 'quoted'; count: number; coins: number }> | Readonly<{ status: 'overflow' }>;
type SaleReceipt = Readonly<{ status: 'sold'; count: number; coins: number }> | Readonly<{ status: 'empty' | 'overflow' }>;
// Pricing knows item quantities, an external price lookup and the sale multiplier (pets, rebirth, boosts), never
// occupied capacity. The multiplied total is rounded once, so small prices still gain from every bonus.
export function quoteSale(items: Readonly<Record<string, number>>, unitPrice: UnitPrice, multiplier = 1): SaleQuote {
  if (!Number.isFinite(multiplier) || multiplier < 1) throw Error('出售倍率无效');
  let count = 0, base = 0;
  for (const [id, quantity] of Object.entries(items)) {
    integer(quantity, '物品数量');
    const price = integer(unitPrice(id), '售价');
    count += quantity; base += quantity * price;
    if (!Number.isSafeInteger(count) || !Number.isSafeInteger(base)) return { status: 'overflow' };
  }
  const coins = Math.round(base * multiplier);
  if (!Number.isSafeInteger(coins)) return { status: 'overflow' };
  return Object.freeze({ status: 'quoted', count, coins });
}
/** Sells `items` (by default the whole bag) at once into `till` (one currency of the wallet): every check precedes
 *  the transfer, so a refused sale changes neither the bag nor the wallet. */
export function sellItems(inventory: Pick<Inventory, 'getSnapshot' | 'remove'>, till: Till, unitPrice: UnitPrice, items: Readonly<Record<string, number>> = inventory.getSnapshot().items, multiplier = 1): SaleReceipt {
  const quote = quoteSale(items, unitPrice, multiplier);
  if (quote.status === 'overflow') return quote;
  if (!quote.count) return { status: 'empty' };
  if (!till.canCredit(quote.coins)) return { status: 'overflow' };
  if (!inventory.remove(Object.entries(items).map(([itemId, count]) => ({ itemId, count })))) throw new Error('售卖库存发生意外变化');
  till.credit(quote.coins);
  return { status: 'sold', count: quote.count, coins: quote.coins };
}
