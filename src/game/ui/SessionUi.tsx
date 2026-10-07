import { useEffect, useState, type RefObject, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { GameInput } from '../GameInput.ts';
import { Controls } from '../Controls.tsx';
import { InventoryHud } from './InventoryHud.tsx';
import { UpgradePanel } from './UpgradePanel.tsx';
import { TargetHealth } from './TargetHealth.tsx';
import { PetPanel } from './pets/PetPanel.tsx';
import { EggPanel } from './pets/EggPanel.tsx';
import { TravelPanel } from './TravelPanel.tsx';

export function SessionUi({ session, input, surface, eggPrompt }: {
  session: GameSession;
  input: GameInput;
  surface: RefObject<HTMLDivElement | null>;
  eggPrompt: RefObject<HTMLButtonElement | null>;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [modal, setModal] = useState<'upgrade' | 'travel' | 'pets' | 'egg' | null>(null);
  const [dismissedShop, setDismissedShop] = useState<string | null>(null);
  const [lastShop, setLastShop] = useState(state.shopId);
  if (lastShop !== state.shopId) { setLastShop(state.shopId); setDismissedShop(null); }
  const [lastEggStation, setLastEggStation] = useState(state.eggStation?.id);
  if (lastEggStation !== state.eggStation?.id) {
    setLastEggStation(state.eggStation?.id);
    if (modal === 'egg') setModal(null);
  }
  const openEgg = () => { input.reset(); setModal('egg'); };
  const openPets = () => { input.reset(); setModal('pets'); };
  const shopOpen = !modal && state.shopId !== null && dismissedShop !== state.shopId;
  const close = () => { input.reset(); setModal(null); surface.current?.focus(); };
  useEffect(() => {
    if (modal || !state.eggStation) return;
    const press = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (eggPrompt.current?.style.visibility !== 'visible') return;
      event.preventDefault(); input.reset(); setModal('egg');
    };
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  }, [modal, state.eggStation, input, eggPrompt]);
  return <>
    {!modal && !shopOpen && <TargetHealth session={session} />}
    <InventoryHud onOpenPets={openPets} session={session} onOpenUpgrade={() => { input.reset(); setModal('upgrade'); }} onOpenTravel={() => { input.reset(); setModal('travel'); }} />
    {!modal && <Controls input={input} surface={surface} />}
    {!modal && !shopOpen && state.eggStation && <button ref={eggPrompt} type="button" className="egg-world-prompt" style={{ visibility: 'hidden' }} aria-label="查看宠物蛋" onClick={openEgg}>
      <kbd>E</kbd><span>查看宠物蛋</span>
    </button>}
    {modal === 'upgrade' && <UpgradePanel session={session} onClose={close} />}
    {modal === 'pets' && <PetPanel api={session.pets} onClose={close} />}
    {modal === 'egg' && state.eggId && <EggPanel key={state.eggStation!.id} api={session.pets} eggId={state.eggId} onOpenPets={openPets} onClose={close} />}
    {modal === 'travel' && <TravelPanel session={session} onClose={close} />}
    {shopOpen && <UpgradePanel session={session} contextual onClose={() => { setDismissedShop(state.shopId); surface.current?.focus(); }} />}
  </>;
}
