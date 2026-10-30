import type { GameSession } from '../../application/GameSession.ts';
import { itemDefinition } from '../../application/items.ts';
import { MiningOverlay } from '../../presentation/MiningOverlay.ts';
import type { Coord } from '../../terrain/SparseWorld.ts';
import { currencyIcon } from '../currency.ts';
import { iconMarkup } from '../kit/icons.tsx';
import './mining.css';

import { tr } from '../../i18n/i18n.ts';
const oreMarkup = (color: string) => `<svg class="ore-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="m8 4 14 1 7 12-7 11-15-3L3 13Z" fill="${color}" stroke="#1b2340" stroke-width="1.8" stroke-linejoin="round"/><path d="m8 4 4 10 10-9M3 13l9 1-5 11m5-11 10 14m-10-14 17 3" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/></svg>`;

/** Hooks the mining overlay to the session: refusals (locked block, full bag) over the block under the pick, and
 *  each pickup flying to the bag, a ticket mineral saying how much of it the material store now holds. */
export function attachMiningOverlay(root: HTMLElement, session: GameSession, selected: () => Coord | null) {
  const overlay = new MiningOverlay(root, {
    currency: () => iconMarkup(currencyIcon(session.getSnapshot().currency)),
    lock: iconMarkup('lock'), bag: iconMarkup('backpack'), pickaxe: iconMarkup('pickaxe'), ore: oreMarkup,
  });
  const now = () => performance.now() / 1000;
  const detach = [
    session.onFeedback(event => { if (event.type === 'denied' && (event.reason === 'locked' || event.reason === 'full')) overlay.refuse(event.reason, selected(), now()); }),
    session.onOreCollected((batch, stored) => {
      const store = session.getSnapshot().materials, merged = new Map<string, number>();
      for (const { itemId, count } of batch) merged.set(itemId, (merged.get(itemId) ?? 0) + count);
      overlay.collected([...merged].map(([itemId, count]) => {
        const item = itemDefinition(itemId), kept = stored.some(s => s.itemId === itemId) ? store.find(m => m.itemId === itemId) : undefined;
        return { name: item.name, color: item.color, count, note: kept ? tr('材料仓 {stored}/{needed}', { stored: kept.stored, needed: kept.needed }) : null };
      }), now());
    }),
  ];
  return { root, overlay, dispose() { for (const off of detach) off(); overlay.dispose(); } };
}
