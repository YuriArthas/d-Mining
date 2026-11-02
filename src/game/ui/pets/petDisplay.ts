import { currencyName } from '../../presentation/currencyName.ts';
import { formatNumber } from '../../presentation/formatNumber.ts';
import type { CurrencyId } from '../../content/economy.ts';

/** A pet's (or team's) income bonus: "+50%", or "+50% 金币" with its currency. */
export const bonusLabel = (pct: number, currency?: CurrencyId) => `+${formatNumber(pct)}%${currency ? ' ' + currencyName(currency) : ''}`;
