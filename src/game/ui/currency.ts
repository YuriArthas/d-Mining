import { currencyName } from '../presentation/currencyName.ts';
import type { CurrencyId } from '../content/economy.ts';
import type { IconKind } from './kit/icons.tsx';
/** How each world's currency shows in the UI: gold coins, tech coins, star crystals. */
const ICONS: Readonly<Record<CurrencyId, IconKind>> = { gold: 'coin', tech: 'tech', star: 'starcoin' };
export const currencyIcon = (id: CurrencyId): IconKind => ICONS[id];
export { currencyName };
