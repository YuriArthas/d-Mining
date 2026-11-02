import { currencyText, type CurrencyId } from '../content/economy.ts';
import { resolveText } from '../i18n/i18n.ts';
export const currencyName = (id: CurrencyId) => resolveText(currencyText(id));
