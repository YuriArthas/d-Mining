import { GuideCard, GuideMarker, OnboardingHelp, DepthGoalCard } from './OnboardingUi.tsx';
import { selectDepthGoal } from '../application/OnboardingGuide.ts';
import { RewardsPanel, CapsulePanel } from './RewardsPanel.tsx';
import { GameButton } from './GameButton.tsx';
import './feedback.css';
import { useEffect, useState, type RefObject, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { GameInput } from '../GameInput.ts';
import { Controls } from '../Controls.tsx';
import { Hud } from './hud/Hud.tsx';
import type { SystemControls } from './hud/SystemMenu.tsx';
import { ShopPanel } from './ShopPanel.tsx';
import type { ShopView } from '../presentation/ShopView.ts';
import { TargetHealth } from './TargetHealth.tsx';
import { PetPanel } from './pets/PetPanel.tsx';
import { EggPanel } from './pets/EggPanel.tsx';
import { TravelPanel } from './TravelPanel.tsx';
import { WorldPanel, MineralPanel } from './JourneyPanel.tsx';

export function SessionUi({ shopView, session, input, surface, eggPrompt, guideMarker, system, blocked = false }: {
  shopView: ShopView;
  system: SystemControls;
  guideMarker: RefObject<HTMLDivElement | null>;
  blocked?: boolean;
  session: GameSession;
  input: GameInput;
  surface: RefObject<HTMLDivElement | null>;
  eggPrompt: RefObject<HTMLButtonElement | null>;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const pets = useSyncExternalStore(session.pets.subscribe, session.pets.getSnapshot);
  const [focused,setFocused]=useState(()=>document.hasFocus()&&!document.hidden);
  useEffect(()=>{const update=()=>setFocused(document.hasFocus()&&!document.hidden);window.addEventListener('focus',update);window.addEventListener('blur',update);document.addEventListener('visibilitychange',update);return ()=>{window.removeEventListener('focus',update);window.removeEventListener('blur',update);document.removeEventListener('visibilitychange',update);};},[]);
  const [modal, setModal] = useState<'travel' | 'pets' | 'egg' | 'help' | 'rewards' | 'capsule' | 'worlds' | 'minerals' | null>(null);
  useEffect(()=>{if(blocked||!focused||modal!=='egg')session.setAutoHatch(false);},[blocked,focused,modal,session]);
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
  const shop = useSyncExternalStore(shopView.subscribe, shopView.getSnapshot);
  const shopOpen = !modal && state.shopId !== null && dismissedShop !== state.shopId;
  useEffect(() => {
    input.reset();
    if (shopOpen) { if (!shopView.active) shopView.categories(); }
    else shopView.close();
  }, [shopOpen, shopView, input]);
  const closeShop = () => { input.reset(); setDismissedShop(state.shopId); shopView.close(); surface.current?.focus(); };
  const openShop = () => { input.reset(); if (state.shopId) { setDismissedShop(null); shopView.categories(); } else session.guideToShop(); };
  const close = () => { input.reset(); session.setAutoHatch(false); setModal(null); surface.current?.focus(); };
  useEffect(() => {
    if (modal || shopOpen || (!state.eggStation&&!state.atMachine&&!state.atMineEntrance) || blocked || !focused) return;
    const press = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const lockedMine=state.atMineEntrance&&state.worlds.some(w=>w.id===state.atMineEntrance&&!w.mineOpen);
      if (!lockedMine&&!state.atMachine&&eggPrompt.current?.style.visibility !== 'visible') return;
      event.preventDefault(); input.reset(); setModal(lockedMine?'worlds':state.atMachine?'capsule':'egg');
    };
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  }, [modal, shopOpen, state.eggStation, state.atMachine, state.atMineEntrance, state.worlds, input, eggPrompt, blocked, focused]);
  const panel=modal??(shopOpen?'shop':'none');
  const open = (next: NonNullable<typeof modal>) => () => { input.reset(); setModal(next); };
  const lockedMine=!!state.atMineEntrance&&state.worlds.some(w=>w.id===state.atMineEntrance&&!w.mineOpen);
  const guideHidden=!!modal||shopOpen||blocked||!focused;
  const objective=state.guide||state.guideCompletionPending
    ? <GuideCard session={session} state={state} hidden={guideHidden} />
    : !blocked&&<DepthGoalCard goal={selectDepthGoal(state.maxDepth,state.destinations)} minedCount={state.onboarding.minedCount} showMiningTask={state.onboarding.longTaskIntroduced}/>;
  const prompts=<>
    {lockedMine&&<GameButton className="journey-mine-prompt ui-btn" data-tone="orange" data-size="m" onPress={open('worlds')}><span className="ui-outline"><span className="desktop-hint">E · </span>查看矿区缴纳要求</span></GameButton>}
    {state.atMachine&&<GameButton className="capsule-world-prompt ui-btn" data-tone="pink" data-size="m" onPress={open('capsule')}><span className="ui-outline"><span className="desktop-hint">E · </span>幸运扭蛋</span></GameButton>}
  </>;
  return <div className="session-ui" data-panel={panel} data-guide-egg={state.eggId===state.guideEggId} data-guide={!blocked&&focused?state.guide?.id:undefined} data-needs-equip={!blocked&&focused&&state.guide?.id==='equip'&&pets.pets.length>0}>
    <GuideMarker session={session} state={state} marker={guideMarker} hidden={guideHidden} />
    {modal==='help'&&<OnboardingHelp session={session} onClose={close} />}
    {!modal && !shopOpen && <Hud session={session} system={system} objective={objective} prompts={prompts} target={<TargetHealth session={session} />}
      actions={{ openPets, openShop, openHelp: open('help'), openTravel: open('travel'), openWorlds: open('worlds'), openMinerals: open('minerals'), openRewards: open('rewards') }} />}
    {modal==='worlds'&&<WorldPanel session={session} onClose={close}/>}
    {modal==='minerals'&&<MineralPanel session={session} onClose={close}/>}
    {!modal && !shopOpen && <Controls input={input} surface={surface} />}
    {!modal && !shopOpen && state.eggStation && <button ref={eggPrompt} type="button" className="egg-world-prompt" style={{ visibility: 'hidden' }} aria-label="查看宠物蛋" onClick={openEgg}>
      <kbd>E</kbd><span>查看宠物蛋</span>
    </button>}
    {modal === 'pets' && <PetPanel api={session.pets} onFindEgg={id=>{close();session.guideToEgg(id);}} onClose={close} />}
    {modal === 'egg' && state.eggId && <EggPanel key={state.eggStation!.id} session={session} api={session.pets} eggId={state.eggId} onOpenPets={openPets} onClose={close} />}
    {modal === 'rewards' && <RewardsPanel session={session} onClose={close}/>}
    {modal === 'capsule' && <CapsulePanel session={session} onClose={close}/>}
    {modal === 'travel' && <TravelPanel session={session} onClose={close} />}
    {shopOpen && shop.mode !== 'closed' && <ShopPanel session={session} view={shopView} onClose={closeShop} />}
  </div>;
}
