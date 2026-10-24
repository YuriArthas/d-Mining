import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import type { WorldId } from '../../content/worldJourney.ts';
import { itemDefinition } from '../../application/items.ts';
import { formatDepth, formatNumber as number } from '../../presentation/formatNumber.ts';
import { OreIcon } from '../InventoryIcons.tsx';
import { UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Bar, Sheet } from '../kit/panel.tsx';
import './world.css';

const LAYER_COLORS: readonly [RegExp, string, string][] = [
  [/老矿/, '#d79a5a', '#9a6332'], [/蘑菇|菇/, '#58c4a4', '#2c8b74'], [/水晶|晶/, '#9b8cf5', '#6551c7'], [/遗迹/, '#cdb58a', '#9a8458'],
  [/冰|雪|霜/, '#7fd3ef', '#3d97c4'], [/熔岩|火|焰/, '#f07a52', '#b8442a'], [/化石|骨/, '#c9a07c', '#94704f'], [/机械|齿轮/, '#5fc0b8', '#2f8a84'], [/地心|核/, '#e9c46a', '#b88a2a'],
];
const FALLBACK = [['#62a8e8', '#2f6fb4'], ['#9fb85c', '#6b8530'], ['#e88aa8', '#b4536f']] as const;
const layerColor = (name: string, index: number) => { const hit = LAYER_COLORS.find(([pattern]) => pattern.test(name)); return hit ? [hit[1], hit[2]] : FALLBACK[index % FALLBACK.length]; };

const WORLD_COLORS = [['#62c96b', '#2f9a3d'], ['#5fc0b8', '#2f8a84'], ['#e9c46a', '#b88a2a']] as const;

/** The world portal: every world as a card. Open worlds travel; the next one shows its price (minerals from the
 *  world before it, and coins) and unlocks here; worlds beyond it stay ??? with no name or price. */
export function PortalSheet({ session, onClose }: { session: GameSession; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [confirm, setConfirm] = useState(false), [message, setMessage] = useState('');
  const next = state.worlds.find(w => w.known && !w.open);
  const ready = !!next && next.materials.every(m => m.owned >= m.count) && state.coins >= next.coins;
  const go = (id: WorldId) => { const r = session.travelWorld(id); if (r === 'travelling') onClose(); else setMessage(r === 'locked' ? '这个世界还没开放' : r === 'away' ? '站到传送门前才能传送' : '现在无法传送，请稍后再试'); };
  const unlock = () => {
    if (!next) return;
    const r = session.unlockWorld(next.id); setConfirm(false);
    setMessage(r.status === 'opened' ? `${next.name}已开放，可以传送过去了！` : r.status === 'away' ? '站到传送门前才能解锁' : '条件还没满足，没有扣除任何东西');
  };
  const footer = confirm && next ? <><span className="ui-hint">确认后扣除下面的矿物和 {number(next.coins)} 金币，{next.name}永久开放。</span><span className="ui-grow" />
    <UiButton size="s" tone="steel" onPress={() => setConfirm(false)}>取消</UiButton><UiButton size="s" tone="orange" disabled={!ready} onPress={unlock}>确认解锁</UiButton></>
    : <><span className="ui-hint" role="status">{message || (next ? (ready ? `条件都满足了，可以解锁${next.name}` : `集齐矿物和金币即可解锁${next.name}`) : '所有世界都已开放')}</span><span className="ui-grow" />
      {next && <UiButton size="s" tone="purple" icon="gem" onPress={() => { session.reserveWorldMaterials(next.id); setMessage('已保留所需矿物，之后挖到的也会自动补足，不会被卖掉'); }}>保留矿物</UiButton>}
      {next && <UiButton size="s" tone="orange" disabled={!ready} onPress={() => setConfirm(true)}>解锁{next.name}</UiButton>}</>;
  return <Sheet title="世界传送门" size="m" onClose={onClose} className="portal-sheet" footer={footer}>
    <div className="ui-cards world-cards">{state.worlds.map((world, i) => {
      const [c, lo] = world.known ? WORLD_COLORS[i % WORLD_COLORS.length] : ['#8a93a3', '#5b6372'], here = world.id === state.currentWorld;
      return <div key={world.id} className="ui-card-tile" data-locked={world.open ? undefined : ''} style={{ '--c': c, '--c-lo': lo } as CSSProperties}>
        {world.open ? <Icon kind="globe" className="ui-icon ui-card-art" /> : <span className="ui-card-art world-lock" aria-hidden="true"><LockIcon /></span>}
        <h4 className="ui-outline">{world.known ? world.name : '???'}</h4>
        {here ? <span className="ui-stamp">当前所在</span>
          : world.open ? <UiButton size="s" tone="green" icon="portal" aria-label={`传送到${world.name}`} onPress={() => go(world.id)}>传送</UiButton>
          : world.known ? <small>解锁条件见下方</small> : <small>先解锁上一个世界</small>}
      </div>;
    })}</div>
    {next && <div className="ui-well world-mats">
      <b className="ui-outline">解锁{next.name}需要</b>
      {next.materials.map(m => <div key={m.itemId} className="world-mat"><OreIcon color={itemDefinition(m.itemId).color} className="world-mat-icon" /><span>{m.name}</span>
        <Bar value={m.owned} max={m.count} size="s" /><b className="ui-outline">{number(Math.min(m.owned, m.count))}/{number(m.count)}</b></div>)}
      <div className="world-mat"><Icon kind="coin" className="ui-icon world-mat-icon" /><span>金币</span><Bar value={state.coins} max={next.coins} size="s" tone="gold" /><b className="ui-outline">{number(Math.min(state.coins, next.coins))}/{number(next.coins)}</b></div>
    </div>}
  </Sheet>;
}

/** The teleport station: this world's surface and its layers. */
export function StationSheet({ session, onClose }: { session: GameSession; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const world = state.worlds.find(w => w.id === state.currentWorld)?.name ?? '';
  return <Sheet title={`${world}传送站`} subtitle={`历史最深 ${formatDepth(state.maxDepth)}`} size="m" onClose={onClose} className="station-sheet"
    footer={<span className="ui-hint">到达新深度会永久解锁那一层。</span>}>
    <LayerCards session={session} onClose={onClose} />
  </Sheet>;
}

function LayerCards({ session, onClose }: { session: GameSession; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [message, setMessage] = useState('');
  const surface = state.location !== 'mine' && state.location !== 'room';
  const go = (id: string) => {
    const result = session.travelTo(id);
    if (result === 'travelling') onClose();
    else setMessage(result === 'locked' ? '还没有解锁这一层' : '现在无法传送，请稍后再试');
  };
  return <>
    <div className="ui-cards world-cards">
      <div className="ui-card-tile" style={{ '--c': '#62c96b', '--c-lo': '#2f9a3d' } as CSSProperties}>
        <Icon kind="home" className="ui-icon ui-card-art" /><h4 className="ui-outline">地表</h4><small>商店 · 蛋台</small>
        {surface ? <span className="ui-stamp">当前位置</span> : <UiButton size="s" tone="blue" onPress={() => { session.returnToSurface(); onClose(); }}>返回</UiButton>}
      </div>
      {state.destinations.map((room, index) => {
        const [c, lo] = layerColor(room.name, index);
        return <div key={room.id} className="ui-card-tile" data-locked={room.unlocked ? undefined : ''} style={{ '--c': c, '--c-lo': lo } as CSSProperties}>
          {room.unlocked ? <Icon kind="portal" className="ui-icon ui-card-art" /> : <span className="ui-card-art world-lock" aria-hidden="true"><LockIcon /></span>}
          <h4 className="ui-outline">{room.name}</h4><small>地下 {formatDepth(room.depth)}</small>
          {room.unlocked ? <UiButton size="s" tone="green" aria-label={`传送到${room.name}`} onPress={() => go(room.id)}>传送</UiButton>
            : <Bar value={state.maxDepth} max={room.depth} size="s">{Math.floor(Math.min(state.maxDepth, room.depth))} / {room.depth} 米</Bar>}
        </div>;
      })}
    </div>
    {message && <p className="ui-hint" role="status">{message}</p>}
  </>;
}

function LockIcon() {
  return <svg viewBox="0 0 48 48" className="ui-icon"><rect x="9" y="21" width="30" height="23" rx="5" fill="#ffd447" stroke="#13355d" strokeWidth="3.5" /><path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#13355d" strokeWidth="5" /><circle cx="24" cy="31" r="3.5" fill="#13355d" /></svg>;
}
