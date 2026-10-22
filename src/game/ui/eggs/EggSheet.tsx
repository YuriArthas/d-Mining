import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import type { HatchResult } from '../../application/PetService.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { GameButton } from '../GameButton.tsx';
import { UiButton } from '../kit/controls.tsx';
import { Chip, RarityTag, Sheet, Toggle } from '../kit/panel.tsx';
import { EggArt } from '../pets/EggArt.tsx';
import { PetArt } from '../pets/PetArt.tsx';
import { bonusLabel } from '../pets/petDisplay.ts';
import './eggs.css';

type Hatched = Extract<HatchResult, { status: 'hatched' }>;

/** Egg stand: every outcome with its real probability, then a full-screen hatch reveal. */
export function EggSheet({ session, eggId, onClose, onOpenPets }: { session: GameSession; eggId: string; onClose(): void; onOpenPets(): void }) {
  const pets = useSyncExternalStore(session.pets.subscribe, session.pets.getSnapshot);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [result, setResult] = useState<Hatched | null>(null);
  const [message, setMessage] = useState('');
  const egg = pets.eggs.find(offer => offer.id === eggId);
  const owned = (speciesId: string) => pets.pets.filter(card => card.pet.speciesId === speciesId).length;
  const hatch = () => {
    if (!egg) return;
    const settled = session.pets.hatch(egg.id);
    if (settled.status === 'hatched') { setResult(settled); setMessage(''); }
    else setMessage(settled.status === 'insufficient-coins' ? '金币不足' : '这个蛋台暂时不可用');
  };
  if (!egg) return <Sheet title="宠物蛋" size="s" onClose={onClose}><p className="ui-hint">这个蛋台暂时不可用。</p></Sheet>;
  const autoHatch = state.rewards.permanent.autoHatch;
  const lastAuto = state.lastAutoHatch?.eggId === eggId ? pets.pets.find(card => card.pet.id === state.lastAutoHatch?.pet.id) : null;
  const buyLabel = !egg.unlocked ? `到达${egg.unlockName ?? '更深处'}解锁` : egg.canAfford ? `开一个 · ${number(egg.price)}` : `还差 ${number(egg.price - pets.coins)} 金币`;
  return <>
    <Sheet title={egg.name} subtitle="每只宠物的真实概率" size="m" onClose={onClose} className="egg-sheet" footer={<>
      <Chip icon="coin"><b>{number(pets.coins)}</b></Chip>
      {autoHatch && <Toggle on={state.autoHatch === eggId} label="自动孵蛋" onPress={() => session.setAutoHatch(state.autoHatch !== eggId)} />}
      <span className="ui-hint egg-status" role="status">{message || (lastAuto ? `刚获得：${lastAuto.name} ${bonusLabel(lastAuto.powerBonusBps)}` : state.autoHatch ? '自动孵蛋中，每次照常付蛋价' : '')}</span>
      <span className="ui-grow" />
      <UiButton size="m" tone="orange" icon={egg.unlocked && egg.canAfford ? 'coin' : undefined} disabled={!egg.canAfford || !!state.autoHatch} className="egg-buy" onPress={hatch}>{buyLabel}</UiButton>
    </>}>
      <div className="egg-layout">
        <div className="egg-hero"><EggArt className="egg-hero-art" spotSpecies={egg.outcomes.at(-1)?.speciesId} /><Chip icon="coin"><b>{number(egg.price)}</b></Chip></div>
        <div className="egg-outcomes" aria-label="可能获得的宠物">{egg.outcomes.map(outcome => <div key={outcome.speciesId} className="egg-outcome" data-rarity={outcome.rarity}>
          <div className="ui-cell" data-rarity={outcome.rarity}><PetArt speciesId={outcome.speciesId} rarity={outcome.rarity} />
            <span className="ui-cell-name ui-outline">{outcome.name}</span><span className="ui-cell-stat ui-outline">{bonusLabel(outcome.powerBonusBps)}</span></div>
          <strong className="ui-outline egg-odds">{Number((outcome.probability * 100).toFixed(2))}%</strong>
          <RarityTag rarity={outcome.rarity} />
          {owned(outcome.speciesId) > 0 && <small className="egg-owned">已有 {owned(outcome.speciesId)}</small>}
        </div>)}</div>
      </div>
    </Sheet>
    {result && <HatchReveal key={result.pet.id} speciesId={result.pet.speciesId} pets={pets} price={egg.price} canAgain={egg.canAfford}
      onDone={() => setResult(null)} onEquip={() => { setResult(null); onOpenPets(); }} onAgain={() => { setResult(null); hatch(); }} />}
  </>;
}

function HatchReveal({ speciesId, pets, price, canAgain, onDone, onEquip, onAgain }: {
  speciesId: string; pets: ReturnType<GameSession['pets']['getSnapshot']>; price: number; canAgain: boolean; onDone(): void; onEquip(): void; onAgain(): void;
}) {
  const outcome = pets.eggs.flatMap(egg => egg.outcomes).find(o => o.speciesId === speciesId);
  const [skipped, setSkipped] = useState(false);
  const first = pets.pets.filter(card => card.pet.speciesId === speciesId).length === 1;
  useEffect(() => { const timer = setTimeout(() => setSkipped(true), 1400); return () => clearTimeout(timer); }, []);
  const rarity = outcome?.rarity ?? 'common';
  return <div className="hatch" data-rarity={rarity} data-done={skipped} role="dialog" aria-modal="true" aria-label={`开蛋结果：${outcome?.name ?? ''}`}
    onPointerDown={() => setSkipped(true)}>
    <div className="hatch-rays" />
    <div className="hatch-stage">
      <EggArt className="hatch-egg" spotSpecies={speciesId} />
      <div className="hatch-flash" />
      <div className="hatch-result">
        <div className="hatch-ribbon ui-outline">{{ common: '普通', rare: '稀有！', epic: '史诗！', legendary: '传说！！' }[rarity]}</div>
        <PetArt speciesId={speciesId} rarity={rarity} className="hatch-pet" />
        <h2 className="ui-outline">{outcome?.name}</h2>
        <div className="ui-row hatch-tags"><Chip>挖矿力量 <b>{bonusLabel(outcome?.powerBonusBps ?? 0)}</b></Chip>{first && <span className="ui-stamp hatch-new">新宠物</span>}</div>
        <div className="ui-row hatch-actions">
          <UiButton size="m" tone="steel" onPress={onDone}>完成</UiButton>
          <UiButton size="m" tone="purple" icon="paw" onPress={onEquip}>去装备</UiButton>
          <UiButton size="m" tone="orange" icon="coin" disabled={!canAgain} onPress={onAgain}>再开一个 · {number(price)}</UiButton>
        </div>
      </div>
    </div>
    {!skipped && <GameButton className="hatch-skip" aria-label="跳过动画" onPress={() => setSkipped(true)} />}
  </div>;
}
