import { useEffect, useState, type RefObject, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import { selectDepthGoal } from '../application/OnboardingGuide.ts';
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
import { GuideCard, GuideMarker, DepthGoalCard } from './OnboardingUi.tsx';
import { CapsuleSheet, RewardsSheet, type RewardsTab } from './rewards/RewardsSheet.tsx';
import { ShopPanel } from './ShopPanel.tsx';
import { TargetHealth } from './TargetHealth.tsx';
import { WorldSheet, type WorldTab } from './world/WorldSheet.tsx';

type Modal =
  | { kind: 'bag'; tab: BagTab } | { kind: 'world'; tab: WorldTab } | { kind: 'rewards'; tab: RewardsTab }
  | { kind: 'egg' } | { kind: 'capsule' } | { kind: 'help' };

export function SessionUi({ shopView, session, input, surface, eggPrompt, guideMarker, system, blocked = false }: {
  shopView: ShopView; system: SystemControls; guideMarker: RefObject<HTMLDivElement | null>; blocked?: boolean;
  session: GameSession; input: GameInput; surface: RefObject<HTMLDivElement | null>; eggPrompt: RefObject<HTMLButtonElement | null>;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const pets = useSyncExternalStore(session.pets.subscribe, session.pets.getSnapshot);
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
  const shop = useSyncExternalStore(shopView.subscribe, shopView.getSnapshot);
  const shopOpen = !modal && state.shopId !== null && dismissedShop !== state.shopId;
  useEffect(() => { input.reset(); if (shopOpen) { if (!shopView.active) shopView.categories(); } else shopView.close(); }, [shopOpen, shopView, input]);

  const open = (next: Modal) => { input.reset(); setModal(next); };
  const close = () => { input.reset(); session.setAutoHatch(false); setModal(null); surface.current?.focus(); };
  const closeShop = () => { input.reset(); setDismissedShop(state.shopId); shopView.close(); surface.current?.focus(); };
  const openShop = () => { input.reset(); if (state.shopId) { setDismissedShop(null); shopView.categories(); } else session.goTo('shop'); };
  const lockedMine = !!state.atMineEntrance && state.worlds.some(w => w.id === state.atMineEntrance && !w.mineOpen);

  useEffect(() => {
    if (modal || shopOpen || (!state.eggStation && !state.atMachine && !lockedMine) || blocked || !focused) return;
    const press = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (!lockedMine && !state.atMachine && eggPrompt.current?.style.visibility !== 'visible') return;
      event.preventDefault(); open(lockedMine ? { kind: 'world', tab: 'progress' } : state.atMachine ? { kind: 'capsule' } : { kind: 'egg' });
    };
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  });

  const panel = modal?.kind ?? (shopOpen ? 'shop' : 'none');
  const guideHidden = !!modal || shopOpen || blocked || !focused;
  const objective = state.guide || state.guideCompletionPending
    ? <GuideCard session={session} state={state} hidden={guideHidden} />
    : !blocked && <DepthGoalCard goal={selectDepthGoal(state.maxDepth, state.destinations)} minedCount={state.onboarding.minedCount} showMiningTask={state.onboarding.longTaskIntroduced} />;
  const prompts = <>
    {lockedMine && <GameButton className="ui-btn" data-tone="orange" data-size="m" onPress={() => open({ kind: 'world', tab: 'progress' })}><Icon kind="globe" /><span className="ui-outline"><span className="desktop-hint">E · </span>查看矿区要求</span></GameButton>}
    {state.atMachine && <GameButton className="ui-btn capsule-world-prompt" data-tone="pink" data-size="m" onPress={() => open({ kind: 'capsule' })}><Icon kind="gift" /><span className="ui-outline"><span className="desktop-hint">E · </span>幸运扭蛋</span></GameButton>}
  </>;
  return <div className="session-ui" data-panel={panel} data-guide-egg={state.eggId === state.guideEggId} data-guide={!blocked && focused ? state.guide?.id : undefined}
    data-needs-equip={!blocked && focused && state.guide?.id === 'equip' && pets.pets.length > 0}>
    <GuideMarker session={session} state={state} marker={guideMarker} hidden={guideHidden} />
    {!modal && !shopOpen && <Hud session={session} system={system} objective={objective} prompts={prompts} target={<TargetHealth session={session} />}
      actions={{
        openPets: () => open({ kind: 'bag', tab: 'pets' }), openMinerals: () => open({ kind: 'bag', tab: 'ores' }), openShop,
        openRewards: () => open({ kind: 'rewards', tab: 'online' }), openWorlds: () => open({ kind: 'world', tab: 'travel' }), openHelp: () => open({ kind: 'help' }),
      }} />}
    {!modal && !shopOpen && <Controls input={input} surface={surface} />}
    {!modal && !shopOpen && state.eggStation && <button ref={eggPrompt} type="button" className="egg-world-prompt ui-btn" data-tone="orange" data-size="m" style={{ visibility: 'hidden' }} aria-label="查看宠物蛋" onClick={() => open({ kind: 'egg' })}>
      <Icon kind="paw" /><span className="ui-outline"><span className="desktop-hint">E · </span>查看宠物蛋</span>
    </button>}
    {modal?.kind === 'bag' && <BagSheet session={session} tab={modal.tab} onTab={tab => setModal({ kind: 'bag', tab })} onClose={close} />}
    {modal?.kind === 'world' && <WorldSheet session={session} tab={modal.tab} onTab={tab => setModal({ kind: 'world', tab })} onClose={close} />}
    {modal?.kind === 'rewards' && <RewardsSheet session={session} tab={modal.tab} onTab={tab => setModal({ kind: 'rewards', tab })} onClose={close} />}
    {modal?.kind === 'egg' && state.eggId && <EggSheet key={state.eggStation!.id} session={session} eggId={state.eggId} onOpenPets={() => open({ kind: 'bag', tab: 'pets' })} onClose={close} />}
    {modal?.kind === 'capsule' && <CapsuleSheet session={session} onClose={close} />}
    {modal?.kind === 'help' && <HelpSheet session={session} onClose={close} />}
    {shopOpen && shop.mode !== 'closed' && <ShopPanel session={session} view={shopView} onClose={closeShop} />}
  </div>;
}
