import { integer } from './numbers.ts';
export class Wallet {
  private coins: number;
  constructor(coins = 0) { this.coins = integer(coins, '金币'); }
  getBalance() { return this.coins; }
  canCredit(amount: number) { return Number.isSafeInteger(amount) && amount >= 0 && Number.isSafeInteger(this.coins + amount); }
  credit(amount: number) { integer(amount); this.coins = integer(this.coins + amount, '金币'); }
  debit(amount: number) { integer(amount); if (amount > this.coins) return false; this.coins -= amount; return true; }
}
