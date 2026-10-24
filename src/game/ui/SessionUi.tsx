import { useEffect, useState, type RefObject, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import { selectDepthGoal } from '../application/Tips.ts';
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
import { DepthGoalCard, TipMarker } from './TipsUi.tsx';
import { CapsuleSheet, RewardsSheet, rewardsTabFor, type RewardsTab } from './rewards/RewardsSheet.tsx';
import { ShopPanel, showShopCategory } from './ShopPanel.tsx';
import type { ShopCategory } from '../content/shopCatalog.ts';
import { MYSTERY_EGG_NAME } from '../content/petAppearance.ts';
import { TargetHealth } from './TargetHealth.tsx';
import { WorldSheet, type WorldTab } from './world/WorldSheet.tsx';

type Modal =
  | { kind: 'bag'; tab: BagTab } | { kind: 'world'; tab: WorldTab } | { kind: 'rewards'; tab: RewardsTab }
  | { kind: 'egg' } | { kind: 'capsule' } | { kind: 'help' };

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
  useEffect(() => { if (blocked || !focused || modal?.kind !== 'egg') session.setAutoHatch(false); }, [blocked, focused, modal, session]);

  // Leaving an egg stand closes its sheet; arriving at a new shop re-arms the auto-open.
  const [lastEggStation, setLastEggStation] = useState(state.eggStation?.id);
  if (lastEggStation !== state.eggStation?.id) { setLastEggStation(state.eggStation?.id); if (modal?.kind === 'egg') setModal(null); }
  const [dismissedShop, setDismissedShop] = useState<string | null>(null);
  const [lastShop, setLastShop] = useState(state.shopId);
  if (lastShop !== state.shopId) { setLastShop(state.shopId); setDismissedShop(null); }
  // The shop opens in place from the HUD (its counter chosen by the button), or on walking into a shop: the forge
  // opens on pickaxes, the pack shop on backpacks.
  const [shopRequest, setShopRequest] = useState<ShopCategory | null>(null);
  const shop = useSyncExternalStore(shopView.subscribe, shopView.getSnapshot);
  const shopOpen = !modal && (shopRequest !== null || (state.shopId !== null && dismissedShop !== state.shopId));
  useEffect(() => { input.reset(); if (shopOpen) { if (!shopView.active) showShopCategory(shopView, session.getSnapshot(), shopRequest ?? state.shopCategory); } else shopView.close(); }, [shopOpen, shopRequest, shopView, session, input, state.shopCategory]);

  const open = (next: Modal) => { input.reset(); setModal(next); };
  const close = () => { input.reset(); session.setAutoHatch(false); setModal(null); surface.current?.focus(); };
  const closeShop = () => { input.reset(); setShopRequest(null); setDismissedShop(state.shopId); shopView.close(); surface.current?.focus(); };
  const openShop = (category: ShopCategory) => { input.reset(); setModal(null); setShopRequest(category); if (shopView.active) showShopCategory(shopView, state, category); };
  const lockedMine = !!state.atMineEntrance && state.worlds.some(w => w.id === state.atMineEntrance && !w.mineOpen);
  const pets = useSyncExternalStore(session.pets.subscribe, session.pets.getSnapshot);
  const standEgg = state.eggId ? pets.eggs.find(egg => egg.id === state.eggId) : undefined;
  const eggName = state.eggId ? standEgg ? standEgg.unlocked ? standEgg.name : MYSTERY_EGG_NAME : '宠物蛋' : null;

  useEffect(() => {
    if (modal || shopOpen || (!state.eggStation && !state.atMachine && !lockedMine) || blocked || !focused) return;
    const press = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      event.preventDefault(); open(lockedMine ? { kind: 'world', tab: 'progress' } : state.atMachine ? { kind: 'capsule' } : { kind: 'egg' });
    };
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  });

  const panel = modal?.kind ?? (shopOpen ? 'shop' : 'none');
  const tipHidden = !!modal || shopOpen || blocked || !focused;
  const objective = !blocked && <DepthGoalCard goal={selectDepthGoal(state.maxDepth, state.destinations)} />;
  const prompts = <>
    {lockedMine && <GameButton className="ui-btn" data-tone="orange" data-size="m" onPress={() => open({ kind: 'world', tab: 'progress' })}><Icon kind="globe" /><span className="ui-outline"><span className="desktop-hint">E · </span>查看矿区要求</span></GameButton>}
    {state.atMachine && <GameButton className="ui-btn capsule-world-prompt" data-tone="pink" data-size="m" onPress={() => open({ kind: 'capsule' })}><Icon kind="gift" /><span className="ui-outline"><span className="desktop-hint">E · </span>幸运扭蛋</span></GameButton>}
    {state.eggStation && eggName && <GameButton className="ui-btn egg-world-prompt" data-tone="orange" data-size="m" aria-label={`查看${eggName}`} onPress={() => open({ kind: 'egg' })}><Icon kind="paw" /><span className="ui-outline"><span className="desktop-hint">E · </span>查看{eggName}</span></GameButton>}
  </>;
  return <div className="session-ui" data-panel={panel}>
    <TipMarker tip={state.tip} anchor={state.tipAnchor} marker={guideMarker} hidden={tipHidden} />
    {!modal && !shopOpen && <Hud session={session} system={system} objective={objective} prompts={prompts} target={<TargetHealth session={session} />} tipHidden={blocked || !focused}
      actions={{
        openPets: () => { session.dismissTip('pets'); open({ kind: 'bag', tab: 'pets' }); }, openMinerals: () => open({ kind: 'bag', tab: 'ores' }),
        openShop: () => { session.dismissTip('shop'); openShop('tools'); }, openBackpacks: () => openShop('backpacks'),
        openRewards: () => open({ kind: 'rewards', tab: rewardsTabFor(state.rewards) }), openWorlds: () => open({ kind: 'world', tab: 'travel' }), openHelp: () => open({ kind: 'help' }),
      }} />}
    {!modal && !shopOpen && <Controls input={input} surface={surface} />}
    {modal?.kind === 'bag' && <BagSheet session={session} tab={modal.tab} onTab={tab => setModal({ kind: 'bag', tab })} onClose={close} onShop={openShop} />}
    {modal?.kind === 'world' && <WorldSheet session={session} tab={modal.tab} onTab={tab => setModal({ kind: 'world', tab })} onClose={close} />}
    {modal?.kind === 'rewards' && <RewardsSheet session={session} tab={modal.tab} onTab={tab => setModal({ kind: 'rewards', tab })} onClose={close} />}
    {modal?.kind === 'egg' && state.eggId && <EggSheet key={state.eggStation!.id} session={session} eggId={state.eggId} onOpenPets={() => open({ kind: 'bag', tab: 'pets' })} onClose={close} />}
    {modal?.kind === 'capsule' && <CapsuleSheet session={session} onClose={close} />}
    {modal?.kind === 'help' && <HelpSheet session={session} onClose={close} />}
    {shopOpen && shop.mode !== 'closed' && <ShopPanel session={session} view={shopView} onClose={closeShop} />}
  </div>;
}
