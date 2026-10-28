import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import type { HatchResult } from '../../application/PetService.ts';
import type { PetPanelSnapshot } from '../../application/PetUiAdapter.ts';
import type { CurrencyId } from '../../content/economy.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { GameButton } from '../GameButton.tsx';
import { PriceButton, UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Sheet, Toggle } from '../kit/panel.tsx';
import { EggArt } from '../pets/EggArt.tsx';
import { MYSTERY_EGG_NAME } from '../../content/petAppearance.ts';
import { PetArt } from '../pets/PetArt.tsx';
import { bonusLabel } from '../pets/petDisplay.ts';
import { currencyIcon, currencyName } from '../currency.ts';
import type { PetRarity } from '../../logic/pets/types.ts';
import { uiTimeScale } from '../../presentation/MiningOverlay.ts';
import './eggs.css';

type Hatched = Extract<HatchResult, { status: 'hatched' }>;
type Pets = PetPanelSnapshot;

/** What a pet adds in the current world: its income bonus if it is in this world's currency. */
const here = (pets: Pets, currency: CurrencyId, bonusPct: number) => currency === pets.currency ? bonusPct : 0;
/** The team member a stronger pet would replace: none while a slot is empty; else the one adding least here. */
function weakest(pets: Pets) {
  const team = pets.pets.filter(card => card.equippedSlot !== null);
  if (team.length < pets.slots.length) return null;
  return [...team].sort((a, b) => here(pets, a.currency, a.bonusPct) - here(pets, b.currency, b.bonusPct) || a.miningPct - b.miningPct)[0] ?? null;
}
/** True when a pet with these bonuses would make the team earn more in this world. */
function beatsTeam(pets: Pets, currency: CurrencyId, bonusPct: number) {
  if (currency !== pets.currency) return false;
  const worst = weakest(pets);
  return !worst || bonusPct > here(pets, worst.currency, worst.bonusPct);
}
const RIBBON: Record<PetRarity, string> = { common: '普通', rare: '稀有！', epic: '史诗！', legendary: '传说！！' };
/** How long the egg shakes before it breaks: longer and brighter for rarer pets. */
const HATCH_MS: Record<PetRarity, number> = { common: 1000, rare: 1400, epic: 2000, legendary: 2000 };

/** Egg stand (docs/draft-ui-v2.md, U5): the egg, its price and the open button on the left; every pet it holds with
 *  its real probability on the right, on one screen. A pet that would make the team earn more here is marked. */
export function EggSheet({ session, eggId, onClose }: { session: GameSession; eggId: string; onClose(): void }) {
  const pets = useSyncExternalStore(session.pets.subscribe, session.pets.getSnapshot);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [result, setResult] = useState<Hatched | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2200); return () => clearTimeout(timer); }, [toast]);
  const egg = pets.eggs.find(offer => offer.id === eggId);
  const owned = (speciesId: string) => pets.pets.filter(card => card.pet.speciesId === speciesId && !card.pet.golden).length;
  const hatch = () => {
    if (!egg) return;
    const settled = session.pets.hatch(egg.id);
    if (settled.status === 'hatched') setResult(settled);
  };
  if (!egg) return <Sheet title="宠物蛋" size="s" onClose={onClose}><p className="ui-hint">这个蛋台暂时不可用。</p></Sheet>;
  const autoHatch = state.rewards.permanent.autoHatch, auto = state.autoHatch === eggId;
  const lastAuto = state.lastAutoHatch?.eggId === eggId ? pets.pets.find(card => card.pet.id === state.lastAutoHatch?.pet.id) : null;
  const money = currencyIcon(egg.currency), balance = pets.balances[egg.currency], unit = currencyName(egg.currency);
  /** 立即装备: into an empty slot, or in place of the team's weakest pet. */
  const equipNow = (petId: string, name: string) => {
    const worst = weakest(session.pets.getSnapshot());
    if (worst) session.pets.unequip(worst.pet.id);
    const done = session.pets.equip(petId).status === 'equipped';
    setResult(null);
    setToast({ text: done ? (worst ? `${name} 替换了 ${worst.name}` : `已装备 ${name}`) : '没能装备，去宠物页看看', id: Date.now() });
  };
  return <>
    <Sheet title={egg.unlocked ? egg.name : MYSTERY_EGG_NAME} subtitle={egg.unlocked ? '每只宠物的真实概率' : '解锁后揭晓里面的宠物'} onClose={onClose}
      className="egg-sheet" label={egg.unlocked ? egg.name : MYSTERY_EGG_NAME}>
      <div className="egg-layout" data-locked={egg.unlocked ? undefined : ''}>
        <div className="egg-side">
          <EggArt className="egg-hero-art" eggId={egg.id} locked={!egg.unlocked} />
          <span className="egg-wallet">你有<Icon kind={money} /><b className="ui-num">{number(balance)}</b></span>
          {egg.unlocked
            ? <PriceButton verb="开蛋" price={number(egg.price)} currency={money} tone="orange" size="l" className="egg-buy" disabled={!egg.canAfford || auto}
                aria-label={`开蛋，${number(egg.price)} ${unit}`} onPress={hatch} />
            : <><span className="egg-wallet">价格<Icon kind={money} /><b className="ui-num">{number(egg.price)}</b></span>
              <UiButton size="m" className="egg-buy" icon="lock" disabled onPress={() => {}}>到达{egg.unlockName ?? '更深处'}解锁</UiButton></>}
          {egg.unlocked && autoHatch && <Toggle on={auto} label="自动开蛋" onPress={() => session.setAutoHatch(!auto)} />}
          {lastAuto && <div key={lastAuto.pet.id} className="egg-last ui-pop" data-rarity={lastAuto.rarity} role="status" aria-label={`刚开出 ${lastAuto.name}`}>
            <PetArt speciesId={lastAuto.pet.speciesId} rarity={lastAuto.rarity} className="egg-last-art" />
            <span><small>刚开出</small><b>{lastAuto.name}</b></span>
          </div>}
        </div>
        {/* Before it is unlocked nothing tells what the egg holds: only its price and where it unlocks. */}
        {!egg.unlocked ? <div className="egg-mystery"><strong>?</strong><span>到达{egg.unlockName ?? '更深处'}后揭晓</span><small>在宠物页「获取宠物」里可以前往能开的蛋</small></div>
          : <div className="egg-outcomes" role="list" aria-label="可能获得的宠物" style={{ '--n': egg.outcomes.length } as CSSProperties}>{egg.outcomes.map(outcome => {
            const count = owned(outcome.speciesId), better = beatsTeam(pets, outcome.currency, outcome.bonusPct);
            return <div key={outcome.speciesId} role="listitem" className="egg-outcome" data-rarity={outcome.rarity}
              aria-label={`${outcome.name}，${Number((outcome.probability * 100).toFixed(2))}%，${bonusLabel(outcome.bonusPct, outcome.currency)}，挖矿 ${bonusLabel(outcome.miningPct)}`}>
              <div className="egg-card">
                <strong className="egg-odds ui-outline ui-num">{Number((outcome.probability * 100).toFixed(2))}%</strong>
                <PetArt speciesId={outcome.speciesId} rarity={outcome.rarity} className="egg-card-art" />
                <span className="egg-card-name">{outcome.name}</span>
                <span className="egg-card-band ui-outline"><Icon kind={currencyIcon(outcome.currency)} />{bonusLabel(outcome.bonusPct)}</span>
              </div>
              <small className="egg-mining">挖矿 {bonusLabel(outcome.miningPct)}</small>
              <span className="egg-tags">
                {better && <span className="egg-tag egg-better ui-outline">↑ 比队伍强</span>}
                {!better && count > 0 && <span className="egg-tag egg-owned">已有 {count}</span>}
              </span>
            </div>;
          })}</div>}
      </div>
      {toast && <output key={toast.id} className="ui-toast egg-toast ui-pop" role="status">{toast.text}</output>}
    </Sheet>
    {result && <HatchReveal key={result.pet.id} result={result} eggId={egg.id} pets={pets} price={egg.price} money={money} canAgain={egg.canAfford}
      onDone={() => setResult(null)} onEquip={equipNow} onAgain={() => { setResult(null); hatch(); }} />}
  </>;
}

/** The hatch: the egg shakes (longer for rarer pets), cracks and bursts; the pet pops out on its rarity's colour.
 *  Its card shows both bonuses; a new pet is marked, a pet that beats the team offers 立即装备 (in place of the
 *  weakest), a duplicate shows its golden merge progress. A tap skips the animation. */
function HatchReveal({ result, eggId, pets, price, money, canAgain, onDone, onEquip, onAgain }: {
  result: Hatched; eggId: string; pets: Pets; price: number; money: ReturnType<typeof currencyIcon>; canAgain: boolean;
  onDone(): void; onEquip(petId: string, name: string): void; onAgain(): void;
}) {
  const speciesId = result.pet.speciesId;
  const card = pets.pets.find(c => c.pet.id === result.pet.id);
  const outcome = pets.eggs.flatMap(egg => egg.outcomes).find(o => o.speciesId === speciesId);
  const rarity: PetRarity = card?.rarity ?? outcome?.rarity ?? 'common';
  const name = card?.name ?? outcome?.name ?? '';
  const currency = card?.currency ?? outcome?.currency ?? pets.currency, bonusPct = card?.bonusPct ?? outcome?.bonusPct ?? 0, miningPct = card?.miningPct ?? outcome?.miningPct ?? 0;
  const same = pets.pets.filter(c => c.pet.speciesId === speciesId && !c.pet.golden).length;
  const first = same === 1 && !pets.pets.some(c => c.pet.speciesId === speciesId && c.pet.golden);
  const better = card?.equippedSlot === null && beatsTeam(pets, currency, bonusPct);
  const ms = HATCH_MS[rarity] * uiTimeScale();
  const [done, setDone] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setDone(true), ms); return () => clearTimeout(timer); }, [ms]);
  return <div className="hatch" data-rarity={rarity} data-done={done} role="dialog" aria-modal="true" aria-label={`开蛋结果：${name}`}
    style={{ '--hatch-ms': `${ms}ms` } as CSSProperties} onPointerDown={() => setDone(true)}>
    <div className="hatch-rays" />
    <div className="hatch-stage">
      <div className="hatch-egg"><EggArt className="hatch-egg-art" eggId={eggId} />
        <svg className="hatch-crack" viewBox="0 0 120 140" aria-hidden="true"><path d="M26 74 L44 60 L54 78 L68 62 L80 80 L96 68" /><path d="M44 60 L40 46M68 62 L72 48" /></svg></div>
      <div className="hatch-shells" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} style={{ '--k': i } as CSSProperties} />)}</div>
      <div className="hatch-result">
        <div className="hatch-ribbon ui-outline">{RIBBON[rarity]}</div>
        <PetArt speciesId={speciesId} rarity={rarity} className="hatch-pet" />
        <h2 className="ui-outline">{name}</h2>
        <div className="hatch-tags">
          <span className="hatch-chip"><Icon kind={currencyIcon(currency)} />{currencyName(currency)}收入 {bonusLabel(bonusPct)}</span>
          <span className="hatch-chip"><Icon kind="pickaxe" />挖矿 {bonusLabel(miningPct)}</span>
          {first && <span className="hatch-chip hatch-new ui-outline">新宠物</span>}
          {better && <span className="hatch-chip hatch-better ui-outline">↑ 比队伍强</span>}
          {!first && <span className="hatch-chip">已有 {same} 只 · 金色 {Math.min(same, pets.goldenNeed)}/{pets.goldenNeed}</span>}
        </div>
        <div className="hatch-actions">
          <UiButton size="m" tone="white" onPress={onDone}>完成</UiButton>
          {better && <UiButton size="m" tone="green" className="hatch-equip" onPress={() => onEquip(result.pet.id, name)}>立即装备</UiButton>}
          <PriceButton verb="再开一个" price={number(price)} currency={money} tone="orange" disabled={!canAgain} onPress={onAgain} />
        </div>
      </div>
    </div>
    {!done && <GameButton className="hatch-skip" aria-label="跳过动画" onPress={() => setDone(true)} />}
  </div>;
}
