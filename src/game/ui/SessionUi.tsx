import { useCallback, useEffect, useState, type RefObject, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { GameInput } from '../GameInput.ts';
import { Controls } from '../Controls.tsx';
import type { ShopView } from '../presentation/ShopView.ts';
import { BagSheet, type BagTab } from './bag/BagSheet.tsx';
import { EggSheet } from './eggs/EggSheet.tsx';
import { GameButton } from './GameButton.tsx';
import { HelpSheet } from './HelpSheet.tsx';
import { Hud } from './hud/Hud.tsx';
import type { SystemControls } from './hud/SystemMenu.tsx';
import { Icon } from './kit/icons.tsx';
import { DevUnlockPage } from './DevUnlock.tsx';
import { TipMarker } from './TipsUi.tsx';
import { CapsuleSheet, RewardsSheet, rewardsTabFor, type RewardsTab } from './rewards/RewardsSheet.tsx';
import { ShopPanel, showShopCategory } from './ShopPanel.tsx';
import type { ShopCategory } from '../content/shopCatalog.ts';
import { MYSTERY_EGG_NAME } from '../content/petAppearance.ts';
import { PortalSheet, StationSheet } from './world/WorldSheet.tsx';
import { RebirthCelebration, RebirthSheet } from './rebirth/RebirthSheet.tsx';

// The testing unlock page is a debug tool: its corner button shows only with ?debug=1.
const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';

type Modal =
  | { kind: 'bag'; tab: BagTab } | { kind: 'rewards'; tab: RewardsTab }
  | { kind: 'egg' } | { kind: 'capsule' } | { kind: 'help' } | { kind: 'rebirth' };

export function SessionUi({ shopView, session, input, surface, guideMarker, system, blocked = false }: {
  shopView: ShopView; system: SystemControls; guideMarker: RefObject<HTMLDivElement | null>; blocked?: boolean;
  session: GameSession; input: GameInput; surface: RefObject<HTMLDivElement | null>;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [focused, setFocused] = useState(() => document.hasFocus() && !document.hidden);
  useEffect(() => {
    const update = () => setFocused(document.hasFocus() && !document.hidden);
    window.addEventListener('focus', update); window.addEventListener('blur', update); document.addEventListener('visibilitychange', update);
    return () => { window.removeEventListener('focus', update); window.removeEventListener('blur', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  const [modal, setModal] = useState<Modal | null>(null);
  const [devUnlock, setDevUnlock] = useState(false);
  useEffect(() => { if (blocked || !focused || modal?.kind !== 'egg') session.setAutoHatch(false); }, [blocked, focused, modal, session]);

  // Leaving an egg stand closes its sheet; arriving at a new shop re-arms the auto-open.
  const [lastEggStation, setLastEggStation] = useState(state.eggStation?.id);
  if (lastEggStation !== state.eggStation?.id) { setLastEggStation(state.eggStation?.id); if (modal?.kind === 'egg') setModal(null); }
  // The teleport station opens its layer list on stepping onto the pad; closing it holds until the player steps off.
  const [stationDismissed, setStationDismissed] = useState(false);
  const [lastStation, setLastStation] = useState(state.atStation);
  if (lastStation !== state.atStation) { setLastStation(state.atStation); setStationDismissed(false); }
  const stationOpen = !!state.atStation && !stationDismissed && !modal;
  // The world portal works the same way: its world list opens on stepping in front of it.
  const [portalDismissed, setPortalDismissed] = useState(false);
  const [lastPortal, setLastPortal] = useState(state.atPortal);
  if (lastPortal !== state.atPortal) { setLastPortal(state.atPortal); setPortalDismissed(false); }
  const portalOpen = !!state.atPortal && !portalDismissed && !modal;
  const [dismissedShop, setDismissedShop] = useState<string | null>(null);
  const [lastShop, setLastShop] = useState(state.shopId);
  if (lastShop !== state.shopId) { setLastShop(state.shopId); setDismissedShop(null); }
  // The shop opens in place from the HUD (its counter chosen by the button), or on walking into a shop: the forge
  // opens on pickaxes, the pack shop on backpacks.
  const [shopRequest, setShopRequest] = useState<ShopCategory | null>(null);
  const [reborn, setReborn] = useState<{ count: number; multiplier: number } | null>(null);
  const endCelebration = useCallback(() => setReborn(null), []);
  const shop = useSyncExternalStore(shopView.subscribe, shopView.getSnapshot);
  const shopOpen = !modal && (shopRequest !== null || (state.shopId !== null && dismissedShop !== state.shopId));
  useEffect(() => { input.reset(); if (shopOpen) { if (!shopView.active) showShopCategory(shopView, session.getSnapshot(), shopRequest ?? state.shopCategory); } else shopView.close(); }, [shopOpen, shopRequest, shopView, session, input, state.shopCategory]);

  const open = (next: Modal) => { input.reset(); setModal(next); };
  const close = () => { input.reset(); session.setAutoHatch(false); setModal(null); surface.current?.focus(); };
  const closeShop = () => { input.reset(); setShopRequest(null); setDismissedShop(state.shopId); shopView.close(); surface.current?.focus(); };
  const openShop = (category: ShopCategory) => { input.reset(); setModal(null); setShopRequest(category); if (shopView.active) showShopCategory(shopView, state, category); };
  const pets = useSyncExternalStore(session.pets.subscribe, session.pets.getSnapshot);
  const standEgg = state.eggId ? pets.eggs.find(egg => egg.id === state.eggId) : undefined;
  const eggName = state.eggId ? standEgg ? standEgg.unlocked ? standEgg.name : MYSTERY_EGG_NAME : '宠物蛋' : null;

  useEffect(() => {
    if (modal || shopOpen || (!state.eggStation && !state.atMachine) || blocked || !focused) return;
    const press = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      event.preventDefault(); open(state.atMachine ? { kind: 'capsule' } : { kind: 'egg' });
    };
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  });

  const panel = modal?.kind ?? (shopOpen ? 'shop' : stationOpen ? 'station' : portalOpen ? 'portal' : 'none');
  const tipHidden = !!modal || shopOpen || stationOpen || portalOpen || blocked || !focused;
  useEffect(() => { if (stationOpen || portalOpen) input.reset(); }, [stationOpen, portalOpen, input]);
  const prompts = <>
    {state.atMachine && <GameButton className="ui-btn capsule-world-prompt" data-tone="purple" data-size="m" onPress={() => open({ kind: 'capsule' })}><Icon kind="gift" /><span className="ui-outline"><span className="desktop-hint">E · </span>幸运扭蛋</span></GameButton>}
    {state.eggStation && eggName && <GameButton className="ui-btn egg-world-prompt" data-tone="orange" data-size="m" aria-label={`查看${eggName}`} onPress={() => open({ kind: 'egg' })}><Icon kind="paw" /><span className="ui-outline"><span className="desktop-hint">E · </span>查看{eggName}</span></GameButton>}
  </>;
  return <div className="session-ui" data-panel={panel}>
    <TipMarker tip={state.tip} anchor={state.tipAnchor} marker={guideMarker} hidden={tipHidden} />
    {!modal && !shopOpen && <Hud session={session} system={system} prompts={prompts} tipHidden={blocked || !focused}
      actions={{
        openPets: () => { session.dismissTip('pets'); open({ kind: 'bag', tab: 'pets' }); }, openMinerals: () => open({ kind: 'bag', tab: 'ores' }),
        openShop: () => { session.dismissTip('shop'); openShop('tools'); }, openBackpacks: () => openShop('backpacks'),
        openRewards: () => open({ kind: 'rewards', tab: rewardsTabFor(state.rewards) }), openHelp: () => open({ kind: 'help' }),
        openRebirth: () => open({ kind: 'rebirth' }),
      }} />}
    {!modal && !shopOpen && <Controls input={input} surface={surface} />}
    {modal?.kind === 'bag' && <BagSheet session={session} tab={modal.tab} onTab={tab => setModal({ kind: 'bag', tab })} onClose={close} onShop={openShop} />}
    {stationOpen && <StationSheet session={session} onClose={() => { input.reset(); setStationDismissed(true); surface.current?.focus(); }} />}
    {portalOpen && !stationOpen && <PortalSheet session={session} onClose={() => { input.reset(); setPortalDismissed(true); surface.current?.focus(); }} />}
    {modal?.kind === 'rewards' && <RewardsSheet session={session} tab={modal.tab} onTab={tab => setModal({ kind: 'rewards', tab })} onClose={close} />}
    {modal?.kind === 'egg' && state.eggId && <EggSheet key={state.eggStation!.id} session={session} eggId={state.eggId} onClose={close} />}
    {modal?.kind === 'capsule' && <CapsuleSheet session={session} onClose={close} />}
    {modal?.kind === 'help' && <HelpSheet onClose={close} />}
    {modal?.kind === 'rebirth' && <RebirthSheet session={session} onClose={close} onReborn={(count, multiplier) => setReborn({ count, multiplier })} />}
    {reborn && <RebirthCelebration count={reborn.count} multiplier={reborn.multiplier} onDone={endCelebration} />}
    {shopOpen && shop.mode !== 'closed' && <ShopPanel session={session} view={shopView} onClose={closeShop} />}
    {DEBUG && !blocked && <button className="dev-unlock-button" onClick={() => { input.reset(); setDevUnlock(v => !v); }}>解锁</button>}
    {devUnlock && <DevUnlockPage session={session} onClose={() => { setDevUnlock(false); surface.current?.focus(); }} />}
  </div>;
}
