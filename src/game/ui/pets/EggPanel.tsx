import { useState, useSyncExternalStore } from 'react';
import type { PetUiApi } from '../../application/PetUiAdapter.ts';
import type { HatchResult } from '../../application/PetService.ts';
import { GameButton } from '../GameButton.tsx';
import { PetPortrait } from './PetPortrait.tsx';
import { PetDialog } from './PetDialog.tsx';
import { bonusLabel, RARITY_NAMES } from './petDisplay.ts';

export function EggPanel({ api, eggId, onClose, onOpenPets }: { api: PetUiApi; eggId: string; onClose(): void; onOpenPets(): void }) {
  const state = useSyncExternalStore(api.subscribe, api.getSnapshot);
  const [result, setResult] = useState<Extract<HatchResult, { status: 'hatched' }> | null>(null);
  const [message, setMessage] = useState('');
  const egg = state.eggs.find(offer => offer.id === eggId);
  const acquired = result && state.pets.find(card => card.pet.id === result.pet.id);
  return <PetDialog title={egg?.name ?? '宠物蛋'} onClose={onClose} className="pet-egg-panel">
    {acquired ? <div className="egg-reveal" data-rarity={acquired.rarity}>
      <span className="pet-rarity">{RARITY_NAMES[acquired.rarity]}</span><PetPortrait speciesId={acquired.pet.speciesId} /><h2>{acquired.name}</h2><strong>力量 {bonusLabel(acquired.powerBonusBps)}</strong>
      <div className="egg-result-actions"><GameButton className="pet-secondary" blurAfterPress={false} onPress={() => setResult(null)}>返回蛋台</GameButton>
        <GameButton className="pet-primary" blurAfterPress={false} onPress={onOpenPets}>去装备</GameButton></div>
    </div> : egg ? <>
      <div className="egg-preview-grid" aria-label="可能获得的宠物">{egg.outcomes.map(outcome => <div className="egg-preview-pet" key={outcome.speciesId} data-rarity={outcome.rarity}>
        <PetPortrait speciesId={outcome.speciesId} /><b>{outcome.name}</b>
        <span className="egg-probability">{Number((outcome.probability * 100).toFixed(2))}%</span>
      </div>)}</div>
      <GameButton blurAfterPress={false} className="pet-primary egg-buy" disabled={!egg.canAfford} onPress={() => {
        const settled = api.hatch(egg.id);
        if (settled.status === 'hatched') { setResult(settled); setMessage(''); }
        else setMessage(settled.status === 'insufficient-coins' ? '金币不足' : '这个蛋池暂不可用');
      }}>{egg.canAfford ? `${egg.price} 金币 · 开一个` : `还差 ${egg.price - state.coins} 金币`}</GameButton>
      {message && <output role="status" className="egg-message">{message}</output>}
    </> : <p>这个蛋池暂不可用</p>}
  </PetDialog>;
}
