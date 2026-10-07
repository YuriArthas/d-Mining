import { useState, useSyncExternalStore } from 'react';
import type { PetUiApi } from '../../application/PetUiAdapter.ts';
import { GameButton } from '../GameButton.tsx';
import { PetPortrait } from './PetPortrait.tsx';
import { PetDialog } from './PetDialog.tsx';
import { RARITY_NAMES, bonusLabel } from './petDisplay.ts';

const PAGE_SIZE = 24;
export function PetPanel({ api, onClose }: { api: PetUiApi; onClose(): void }) {
  const state = useSyncExternalStore(api.subscribe, api.getSnapshot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const selected = state.pets.find(card => card.pet.id === selectedId) ?? state.pets[0] ?? null;
  const lastPage = Math.max(0, Math.ceil(state.pets.length / PAGE_SIZE) - 1), currentPage = Math.min(page, lastPage);
  const visible = state.pets.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const equipped = state.slots.filter(id => id !== null).length;
  return <PetDialog title="我的宠物" onClose={onClose}>
    <div className="pet-summary"><span>已装备 <b>{equipped}/{state.slots.length}</b></span><span>力量加成 <strong>{bonusLabel(state.bonus.powerBonusBps)}</strong></span><span>挖矿力量 <b>{state.baseStats.power} → {state.effectiveStats.power}</b></span></div>
    <div className="pet-slots" aria-label="宠物装备槽">
      {state.slots.map((id, slot) => {
        const card = id === null ? null : state.pets.find(pet => pet.pet.id === id)!;
        return <GameButton key={slot} className="pet-slot" data-rarity={card?.rarity} disabled={!card} blurAfterPress={false}
          onPress={() => { setSelectedId(id); if (card) setPage(Math.floor(state.pets.indexOf(card) / PAGE_SIZE)); }}>
          <small>槽位 {slot + 1}</small><b>{card?.name ?? '空闲'}</b><span>{card ? bonusLabel(card.powerBonusBps) : '选择一只宠物'}</span>
        </GameButton>;
      })}
    </div>
    <div className="pet-workspace">
      <div className="pet-collection"><div className="pet-collection-title"><h2>宠物收藏</h2><span>{state.pets.length} 只</span></div>
        {visible.length ? <div className="pet-grid">{visible.map(card => <GameButton key={card.pet.id} className="pet-card" data-rarity={card.rarity}
          aria-pressed={card.pet.id === selected?.pet.id} aria-label={`${card.name} ${card.pet.id} ${card.equippedSlot === null ? '未装备' : '已装备'}`}
          blurAfterPress={false} onPress={() => { setSelectedId(card.pet.id); setMessage(''); }}>
          <span className="pet-card-top"><small>{RARITY_NAMES[card.rarity]}</small><small>{card.equippedSlot === null ? 'Lv.1' : '✓ 已装备'}</small></span>
          <PetPortrait speciesId={card.pet.speciesId} /><span className="pet-name-art">{card.name}</span><strong>{bonusLabel(card.powerBonusBps)}</strong>
        </GameButton>)}</div> : <div className="pet-empty"><b>还没有宠物</b><p>去蛋台开一个吧！</p></div>}
        {lastPage > 0 && <div className="pet-pagination"><GameButton blurAfterPress={false} disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)}>上一页</GameButton><span>{currentPage + 1} / {lastPage + 1}</span><GameButton blurAfterPress={false} disabled={currentPage === lastPage} onPress={() => setPage(currentPage + 1)}>下一页</GameButton></div>}
      </div>
      <aside className="pet-detail" data-rarity={selected?.rarity} aria-label="宠物详情">
        {selected ? <><span className="pet-rarity">{RARITY_NAMES[selected.rarity]} · Lv.{selected.pet.level}</span><div className="pet-detail-art"><PetPortrait speciesId={selected.pet.speciesId} /><b>{selected.name}</b></div>
          <div className="pet-detail-stat"><span>挖矿力量</span><strong>{bonusLabel(selected.powerBonusBps)}</strong></div>
          <GameButton blurAfterPress={false} className="pet-primary" onPress={() => {
            if (selected.equippedSlot !== null) { api.unequip(selected.pet.id); setMessage(`已卸下${selected.name}`); return; }
            const result = api.equip(selected.pet.id);
            setMessage(result.status === 'equipped' ? `已装备${selected.name}` : result.status === 'full' ? '装备位已满，先卸下一只，或使用一键最佳' : result.status === 'not-owned' ? '这只宠物已不在库存中' : '这只宠物已经装备');
          }}>{selected.equippedSlot !== null ? '卸下宠物' : '装备宠物'}</GameButton>
        </> : <div className="pet-empty-detail">选择宠物</div>}
      </aside>
    </div>
    <footer className="pet-footer"><output role="status">{message}</output><div>
      <GameButton blurAfterPress={false} className="pet-secondary" disabled={!equipped} onPress={() => { api.unequipAll(); setMessage('已卸下全部宠物'); }}>全部卸下</GameButton>
      <GameButton blurAfterPress={false} className="pet-primary" disabled={!state.pets.length} onPress={() => { api.equipBest(); setMessage('已装备力量加成最高的宠物'); }}>一键最佳</GameButton>
    </div></footer>
  </PetDialog>;
}
