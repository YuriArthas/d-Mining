import { useState, useSyncExternalStore, type RefObject } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { GameInput } from '../GameInput.ts';
import { Controls } from '../Controls.tsx';
import { InventoryHud } from './InventoryHud.tsx';
import { UpgradePanel } from './UpgradePanel.tsx';
import { TargetHealth } from './TargetHealth.tsx';
import { TravelPanel } from './TravelPanel.tsx';
export function SessionUi({ session, input, surface }: { session: GameSession; input: GameInput; surface: RefObject<HTMLDivElement | null> }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [modal, setModal] = useState<'upgrade' | 'travel' | null>(null);
  const [dismissedShop, setDismissedShop] = useState<string | null>(null);
  // Clear the dismissal when leaving, so stepping back into a shop opens it again.
  const [lastShop, setLastShop] = useState(state.shopId);
  if (lastShop !== state.shopId) { setLastShop(state.shopId); setDismissedShop(null); }
  const shopOpen = !modal && state.shopId !== null && dismissedShop !== state.shopId;
  const close = () => { input.reset(); setModal(null); surface.current?.focus(); };
  return <>
    {!modal && !shopOpen && <TargetHealth session={session} />}
    <InventoryHud session={session} onOpenUpgrade={() => { input.reset(); setModal('upgrade'); }} onOpenTravel={() => { input.reset(); setModal('travel'); }} />
    {!modal && <Controls input={input} surface={surface} />}
    {modal === 'upgrade' && <UpgradePanel session={session} onClose={close} />}
    {modal === 'travel' && <TravelPanel session={session} onClose={close} />}
    {shopOpen && <UpgradePanel session={session} contextual onClose={() => { setDismissedShop(state.shopId); surface.current?.focus(); }} />}
  </>;
}
