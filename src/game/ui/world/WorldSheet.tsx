import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import type { WorldId } from '../../content/worldJourney.ts';
import { itemDefinition } from '../../application/items.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { GameButton } from '../GameButton.tsx';
import { OreIcon } from '../InventoryIcons.tsx';
import { UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Bar, Chip, Sheet, type SheetTab } from '../kit/panel.tsx';
import './world.css';

export type WorldTab = 'travel' | 'progress';
const LAYER_COLORS: readonly [RegExp, string, string][] = [
  [/老矿/, '#d79a5a', '#9a6332'], [/蘑菇|菇/, '#58c4a4', '#2c8b74'], [/水晶|晶/, '#9b8cf5', '#6551c7'], [/遗迹/, '#cdb58a', '#9a8458'],
  [/冰|雪|霜/, '#7fd3ef', '#3d97c4'], [/熔岩|火|焰/, '#f07a52', '#b8442a'], [/化石|骨/, '#c9a07c', '#94704f'], [/机械|齿轮/, '#5fc0b8', '#2f8a84'], [/地心|核/, '#e9c46a', '#b88a2a'],
];
const FALLBACK = [['#62a8e8', '#2f6fb4'], ['#9fb85c', '#6b8530'], ['#e88aa8', '#b4536f']] as const;
const layerColor = (name: string, index: number) => { const hit = LAYER_COLORS.find(([pattern]) => pattern.test(name)); return hit ? [hit[1], hit[2]] : FALLBACK[index % FALLBACK.length]; };

/** Places: teleport between unlocked layers, and the long-term gates to the next worlds. */
export function WorldSheet({ session, tab, onTab, onClose }: { session: GameSession; tab: WorldTab; onTab(tab: WorldTab): void; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const tabs: SheetTab<WorldTab>[] = [{ id: 'travel', label: '传送', icon: 'portal' }, ...(state.journey ? [{ id: 'progress' as const, label: '进度', icon: 'globe' as const }] : [])];
  const common = { title: '世界', tabs, tab, onTab, onClose };
  return tab === 'progress' && state.journey ? <ProgressTab session={session} common={common} /> : <TravelTab session={session} common={common} onClose={onClose} />;
}
type Common = { title: string; tabs: SheetTab<WorldTab>[]; tab: WorldTab; onTab(tab: WorldTab): void; onClose(): void };

function TravelTab({ session, common, onClose }: { session: GameSession; common: Common; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [message, setMessage] = useState('');
  const surface = state.location !== 'mine' && state.location !== 'room';
  const world = state.worlds.find(w => w.id === state.currentWorld)?.name ?? '地表';
  const go = (id: string) => {
    const result = session.travelTo(id);
    if (result === 'travelling') onClose();
    else setMessage(result === 'locked' ? '还没有解锁这一层' : '现在无法传送，请稍后再试');
  };
  return <Sheet {...common} footer={<span className="ui-hint" role="status">{message || '在哪都能传送。到达新深度会永久解锁那一层的传送和宠物蛋。'}</span>}>
    <div className="ui-row"><Chip icon="gem">历史最深 <b>{number(Math.floor(state.maxDepth))} 米</b></Chip><span className="ui-hint">{world}</span></div>
    <div className="ui-cards world-cards">
      <div className="ui-card-tile" style={{ '--c': '#62c96b', '--c-lo': '#2f9a3d' } as CSSProperties}>
        <Icon kind="home" className="ui-icon ui-card-art" /><h4 className="ui-outline">地表</h4><small>商店 · 蛋台</small>
        {surface ? <span className="ui-stamp">当前位置</span> : <UiButton size="s" tone="blue" onPress={() => { session.returnToSurface(); onClose(); }}>返回</UiButton>}
      </div>
      {state.destinations.map((room, index) => {
        const [c, lo] = layerColor(room.name, index);
        return <div key={room.id} className="ui-card-tile" data-locked={room.unlocked ? undefined : ''} style={{ '--c': c, '--c-lo': lo } as CSSProperties}>
          {room.unlocked ? <Icon kind="portal" className="ui-icon ui-card-art" /> : <span className="ui-card-art world-lock" aria-hidden="true"><LockIcon /></span>}
          <h4 className="ui-outline">{room.name}</h4><small>地下 {number(room.depth)} 米</small>
          {room.unlocked ? <UiButton size="s" tone="green" aria-label={`传送到${room.name}`} onPress={() => go(room.id)}>传送</UiButton>
            : <Bar value={state.maxDepth} max={room.depth} size="s">{Math.floor(Math.min(state.maxDepth, room.depth))} / {room.depth} 米</Bar>}
        </div>;
      })}
    </div>
  </Sheet>;
}

function ProgressTab({ session, common }: { session: GameSession; common: Common }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const gates = state.worlds.filter(w => w.id !== 1);
  const [selected, setSelected] = useState<WorldId>(() => gates.find(w => !w.mineOpen)?.id ?? gates[0]?.id ?? 2);
  const [confirm, setConfirm] = useState(false), [message, setMessage] = useState('');
  const world = state.worlds.find(w => w.id === selected) ?? gates[0];
  if (!world) return <Sheet {...common}><p className="ui-hint">没有更多世界。</p></Sheet>;
  const ready = world.areaOpen && world.materials.every(m => m.owned >= m.count) && state.coins >= world.coins;
  const atEntrance = state.atMineEntrance === world.id;
  const pay = () => {
    const result = session.unlockWorldMine(world.id); setConfirm(false);
    setMessage(result.status === 'opened' ? '矿区已永久开放，可以下矿了！' : result.status === 'away' ? `请走到${world.name}的矿口缴纳` : result.status === 'already-open' ? '矿区已经开放' : '条件还没满足，没有扣除任何东西');
  };
  const footer = confirm ? <><span className="ui-hint">确认后扣除材料和 {number(world.coins)} 金币，矿区永久开放。</span><span className="ui-grow" />
    <UiButton size="s" tone="steel" onPress={() => setConfirm(false)}>取消</UiButton><UiButton size="s" tone="orange" disabled={!ready} onPress={pay}>确认缴纳</UiButton></>
    : <><span className="ui-hint" role="status">{message || (world.mineOpen ? `${world.name}矿区已开放` : !world.areaOpen ? '继续挖矿累计挖掘量，外门会自动打开' : atEntrance ? '材料和金币够了就能缴纳' : `走到${world.name}的矿口缴纳`)}</span><span className="ui-grow" />
      {!world.mineOpen && <UiButton size="s" tone="purple" icon="gem" onPress={() => { session.reserveWorldMaterials(world.id); setMessage('已保留所需材料，之后挖到的也会自动补足'); }}>保留材料</UiButton>}
      {world.areaOpen && state.currentWorld !== world.id && <UiButton size="s" tone="blue" icon="portal" onPress={() => { const r = session.travelWorld(world.id); if (r !== 'travelling') setMessage('现在无法前往，请稍后再试'); }}>前往{world.name}</UiButton>}
      {!world.mineOpen && atEntrance && <UiButton size="s" tone="orange" disabled={!ready} onPress={() => setConfirm(true)}>缴纳并开放</UiButton>}</>;
  return <Sheet {...common} footer={footer}>
    <div className="ui-row"><div className="ui-seg" role="group" aria-label="选择世界">{gates.map(w => <GameButton key={w.id} aria-pressed={w.id === world.id} blurAfterPress={false} onPress={() => { setSelected(w.id); setConfirm(false); setMessage(''); }}>{w.name}</GameButton>)}</div>
      <span className="ui-grow" /><Chip>当前：{state.worlds.find(w => w.id === state.currentWorld)?.name}</Chip></div>
    <div className="world-gate">
      <div className="ui-card-tile world-door" style={{ '--c': '#4fc3ff', '--c-lo': '#1a86d8' } as CSSProperties}>
        <Icon kind="globe" className="ui-icon ui-card-art" /><h4 className="ui-outline">① 打开外门</h4>
        {world.areaOpen ? <span className="ui-stamp">外门已开</span> : <><Bar value={state.minedVolume} max={world.mined}>{number(state.minedVolume)} / {number(world.mined)}</Bar><small>累计挖掘量，出售不会减少</small></>}
      </div>
      <div className="ui-well world-mats">
        <b className="ui-outline">② 在矿口缴纳，永久开放矿区</b>
        {world.mineOpen ? <span className="ui-stamp">矿区已开放</span> : <>
          {world.materials.map(m => <div key={m.itemId} className="world-mat"><OreIcon color={itemDefinition(m.itemId).color} className="world-mat-icon" /><span>{m.name}</span>
            <Bar value={m.owned} max={m.count} size="s" /><b className="ui-outline">{number(Math.min(m.owned, m.count))}/{number(m.count)}</b></div>)}
          <div className="world-mat"><Icon kind="coin" className="ui-icon world-mat-icon" /><span>金币</span><Bar value={state.coins} max={world.coins} size="s" tone="gold" /><b className="ui-outline">{number(Math.min(state.coins, world.coins))}/{number(world.coins)}</b></div>
        </>}
      </div>
    </div>
  </Sheet>;
}

function LockIcon() {
  return <svg viewBox="0 0 48 48" className="ui-icon"><rect x="9" y="21" width="30" height="23" rx="5" fill="#ffd447" stroke="#13355d" strokeWidth="3.5" /><path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#13355d" strokeWidth="5" /><circle cx="24" cy="31" r="3.5" fill="#13355d" /></svg>;
}
