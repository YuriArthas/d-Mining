import { CURRENCY_IDS, type CurrencyId } from '../content/economy.ts';
import type { Wallet } from '../logic/Wallet.ts';
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

export type SalePayout = Readonly<{ currency: CurrencyId; coins: number }>;
/** Partition before rounding: each ore pays its origin currency and that currency's pet bonus. */
export function quoteCurrencySale(items: Readonly<Record<string, number>>, unitPrice: UnitPrice,
  currencyOf: (id: string) => CurrencyId, multiplier: (currency: CurrencyId) => number) {
  const groups = new Map<CurrencyId, Record<string, number>>();
  for (const [id, quantity] of Object.entries(items)) {
    integer(quantity, '物品数量');
    const currency = currencyOf(id);
    if (!CURRENCY_IDS.includes(currency)) throw Error('无效出售货币');
    if (!quantity) continue;
    if (!groups.has(currency)) groups.set(currency, Object.create(null));
    groups.get(currency)![id] = quantity;
  }
  let count = 0;
  const payouts: SalePayout[] = [];
  for (const currency of CURRENCY_IDS) {
    const group = groups.get(currency);
    if (!group) continue;
    const quote = quoteSale(group, unitPrice, multiplier(currency));
    if (quote.status === 'overflow') return quote;
    count += quote.count;
    if (!Number.isSafeInteger(count)) return { status: 'overflow' } as const;
    payouts.push(Object.freeze({ currency, coins: quote.coins }));
  }
  return Object.freeze({ status: 'quoted' as const, count, payouts: Object.freeze(payouts) });
}
/** Validate every balance before removing any item; one refused currency cancels the whole sale. */
export function sellCurrencyItems(inventory: Pick<Inventory, 'getSnapshot' | 'remove'>,
  wallet: Pick<Wallet, 'canCredit' | 'credit'>, unitPrice: UnitPrice, currencyOf: (id: string) => CurrencyId,
  items: Readonly<Record<string, number>>, multiplier: (currency: CurrencyId) => number) {
  const quote = quoteCurrencySale(items, unitPrice, currencyOf, multiplier);
  if (quote.status === 'overflow') return quote;
  if (!quote.count) return { status: 'empty' } as const;
  if (quote.payouts.some(p => !wallet.canCredit(p.currency, p.coins))) return { status: 'overflow' } as const;
  if (!inventory.remove(Object.entries(items).map(([itemId, count]) => ({ itemId, count })))) throw Error('售卖库存发生意外变化');
  for (const p of quote.payouts) wallet.credit(p.currency, p.coins);
  return Object.freeze({ status: 'sold' as const, count: quote.count, payouts: quote.payouts });
}
