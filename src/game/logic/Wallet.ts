import { record } from './data.ts';
import { integer } from './numbers.ts';
import { CURRENCY_IDS, type CurrencyId } from '../content/economy.ts';
export type WalletData = { version: 2; balances: Record<CurrencyId, number> };
/** One balance per world currency (gold, tech coins, star crystals). */
export class Wallet {
  private balances: Record<CurrencyId, number>;
  constructor(balances: Partial<Record<CurrencyId, number>> = {}) {
    this.balances = Object.fromEntries(CURRENCY_IDS.map(id => [id, integer(balances[id] ?? 0, '货币')])) as Record<CurrencyId, number>;
  }
  exportData(): WalletData { return { version: 2, balances: { ...this.balances } }; }
  static fromData(value: unknown) {
    const data = record(value);
    if (data.version !== 2) throw Error('不支持的钱包版本');
    return new Wallet(record(data.balances) as Partial<Record<CurrencyId, number>>);
  }
  getBalance(currency: CurrencyId) { return this.balances[currency]; }
  getBalances(): Readonly<Record<CurrencyId, number>> { return { ...this.balances }; }
  canCredit(currency: CurrencyId, amount: number) { return Number.isSafeInteger(amount) && amount >= 0 && Number.isSafeInteger(this.balances[currency] + amount); }
  credit(currency: CurrencyId, amount: number) { integer(amount); this.balances[currency] = integer(this.balances[currency] + amount, '货币'); }
  debit(currency: CurrencyId, amount: number) { integer(amount); if (amount > this.balances[currency]) return false; this.balances[currency] -= amount; return true; }
  /** Rebirth: every currency back to zero. */
  clear() { for (const id of CURRENCY_IDS) this.balances[id] = 0; }
}
