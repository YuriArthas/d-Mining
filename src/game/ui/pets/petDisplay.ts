import { formatNumber } from '../../presentation/formatNumber.ts';

export const bonusLabel = (bps: number) => `+${formatNumber(bps / 100)}%`;
