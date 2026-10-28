import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import type { WorldId } from '../../content/worldJourney.ts';
import { itemDefinition } from '../../application/items.ts';
import { formatDepth, formatNumber as number } from '../../presentation/formatNumber.ts';
import { OreIcon } from '../InventoryIcons.tsx';
import { UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Bar, Sheet } from '../kit/panel.tsx';
import { currencyIcon, currencyName } from '../currency.ts';
import './world.css';

import { tr } from '../../i18n/i18n.ts';
/** Each layer card takes its theme's colour (themes.ts), whatever the language of its name. */
const LAYER_COLORS: Readonly<Record<string, readonly [string, string]>> = {
  timber_mine: ['#d79a5a', '#9a6332'], mushroom_cave: ['#58c4a4', '#2c8b74'], crystal_cave: ['#9b8cf5', '#6551c7'], buried_ruins: ['#cdb58a', '#9a8458'],
  frozen_cave: ['#7fd3ef', '#3d97c4'], lava_cave: ['#f07a52', '#b8442a'], fossil_cave: ['#c9a07c', '#94704f'], ancient_machine: ['#5fc0b8', '#2f8a84'], core_sanctum: ['#e9c46a', '#b88a2a'],
};
const FALLBACK = [['#62a8e8', '#2f6fb4'], ['#9fb85c', '#6b8530'], ['#e88aa8', '#b4536f']] as const;
const layerColor = (theme: string | undefined, index: number) => (theme && LAYER_COLORS[theme]) || FALLBACK[index % FALLBACK.length];

const WORLD_COLORS = [['#62c96b', '#2f9a3d'], ['#5fc0b8', '#2f8a84'], ['#e9c46a', '#b88a2a']] as const;

/** The world portal: every world as a card. Open worlds travel; the next one shows its ticket (a pickaxe level,
 *  minerals of earlier worlds and the previous world's currency) and unlocks here; worlds beyond it stay ???. */
export function PortalSheet({ session, onClose }: { session: GameSession; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [confirm, setConfirm] = useState(false), [message, setMessage] = useState('');
  const next = state.worlds.find(w => w.known && !w.open);
  const ticket = next?.ticket ?? null, unit = ticket ? currencyName(ticket.currency) : '';
  const levelOk = !!ticket && next!.toolLevel >= ticket.toolLevel;
  const ready = !!next && !!ticket && levelOk && next.materials.every(m => m.owned >= m.count) && next.ticketBalance >= ticket.price;
  const go = (id: WorldId) => { const r = session.travelWorld(id); if (r === 'travelling') onClose(); else setMessage(r === 'locked' ? tr('这个世界还没开放') : r === 'away' ? tr('站到传送门前才能传送') : tr('现在无法传送，请稍后再试')); };
  const unlock = () => {
    if (!next) return;
    const r = session.unlockWorld(next.id); setConfirm(false);
    setMessage(r.status === 'opened' ? tr('{name}已开放，可以传送过去了！', { name: next.name }) : r.status === 'away' ? tr('站到传送门前才能解锁')
      : r.status === 'insufficient-level' ? tr('需要 Lv.{toolLevel} 镐子', { toolLevel: ticket?.toolLevel }) : tr('条件还没满足，没有扣除任何东西'));
  };
  const footer = confirm && next ? <><span className="ui-hint">{tr('确认后扣除下面的矿物和 {price} {unit}，{world}永久开放。', { price: number(ticket?.price ?? 0), unit, world: next.name })}</span><span className="ui-grow" />
    <UiButton size="s" tone="steel" onPress={() => setConfirm(false)}>{tr('取消')}</UiButton><UiButton size="s" tone="orange" disabled={!ready} onPress={unlock}>{tr('确认解锁')}</UiButton></>
    : <><span className="ui-hint" role="status">{message || (next ? (ready ? tr('条件都满足了，可以解锁{name}', { name: next.name }) : tr('镐子达到 Lv.{toolLevel}、集齐矿物和{unit}即可解锁{name}', { toolLevel: ticket?.toolLevel, unit: unit, name: next.name })) : tr('所有世界都已开放'))}</span><span className="ui-grow" />
      {next && <UiButton size="s" tone="orange" disabled={!ready} onPress={() => setConfirm(true)}>{tr('解锁{world}', { world: next.name })}</UiButton>}</>;
  return <Sheet title={tr('世界传送门')} size="m" onClose={onClose} className="portal-sheet" footer={footer}>
    <div className="ui-cards world-cards">{state.worlds.map((world, i) => {
      const [c, lo] = world.known ? WORLD_COLORS[i % WORLD_COLORS.length] : ['#8a93a3', '#5b6372'], here = world.id === state.currentWorld;
      return <div key={world.id} className="ui-card-tile" data-locked={world.open ? undefined : ''} style={{ '--c': c, '--c-lo': lo } as CSSProperties}>
        {world.open ? <Icon kind="globe" className="ui-icon ui-card-art" /> : <span className="ui-card-art world-lock" aria-hidden="true"><LockIcon /></span>}
        <h4 className="ui-outline">{world.known ? world.name : '???'}</h4>
        {here ? <span className="ui-stamp">{tr('当前所在')}</span>
          : world.open ? <UiButton size="s" tone="green" icon="portal" aria-label={tr('传送到{name}', { name: world.name })} onPress={() => go(world.id)}>{tr('传送')}</UiButton>
          : world.known ? <small>{tr('解锁条件见下方')}</small> : <small>{tr('先解锁上一个世界')}</small>}
      </div>;
    })}</div>
    {next && <div className="ui-well world-mats">
      <b className="ui-outline">{tr('解锁{world}需要', { world: next.name })}<small>{tr('（矿物挖到后自动进材料仓）')}</small></b>
      {next.materials.map(m => <div key={m.itemId} className="world-mat"><OreIcon color={itemDefinition(m.itemId).color} className="world-mat-icon" /><span>{m.name}</span>
        <Bar value={m.owned} max={m.count} size="s" /><b className="ui-outline">{number(Math.min(m.owned, m.count))}/{number(m.count)}</b></div>)}
      {ticket && <div className="world-mat"><Icon kind="pickaxe" className="ui-icon world-mat-icon" /><span>{tr('镐子等级')}</span>
        <Bar value={Math.min(next.toolLevel, ticket.toolLevel)} max={ticket.toolLevel} size="s" /><b className="ui-outline">Lv.{next.toolLevel}/{ticket.toolLevel}</b></div>}
      {ticket && <div className="world-mat"><Icon kind={currencyIcon(ticket.currency)} className="ui-icon world-mat-icon" /><span>{unit}</span>
        <Bar value={next.ticketBalance} max={ticket.price} size="s" tone="gold" /><b className="ui-outline">{number(Math.min(next.ticketBalance, ticket.price))}/{number(ticket.price)}</b></div>}
    </div>}
  </Sheet>;
}

/** The teleport station: this world's surface and its layers. */
export function StationSheet({ session, onClose }: { session: GameSession; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const world = state.worlds.find(w => w.id === state.currentWorld)?.name ?? '';
  return <Sheet title={tr('{world}传送站', { world: world })} subtitle={tr('历史最深 {maxDepth}', { maxDepth: formatDepth(state.maxDepth) })} size="m" onClose={onClose} className="station-sheet"
    footer={<span className="ui-hint">{tr('到达新深度会永久解锁那一层。')}</span>}>
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
    else setMessage(result === 'locked' ? tr('还没有解锁这一层') : tr('现在无法传送，请稍后再试'));
  };
  return <>
    <div className="ui-cards world-cards">
      <div className="ui-card-tile" style={{ '--c': '#62c96b', '--c-lo': '#2f9a3d' } as CSSProperties}>
        <Icon kind="home" className="ui-icon ui-card-art" /><h4 className="ui-outline">{tr('地表')}</h4><small>{tr('商店 · 蛋台')}</small>
        {surface ? <span className="ui-stamp">{tr('当前位置')}</span> : <UiButton size="s" tone="blue" onPress={() => { session.returnToSurface(); onClose(); }}>{tr('返回')}</UiButton>}
      </div>
      {state.destinations.map((room, index) => {
        const [c, lo] = layerColor(room.theme, index);
        return <div key={room.id} className="ui-card-tile" data-locked={room.unlocked ? undefined : ''} style={{ '--c': c, '--c-lo': lo } as CSSProperties}>
          {room.unlocked ? <Icon kind="portal" className="ui-icon ui-card-art" /> : <span className="ui-card-art world-lock" aria-hidden="true"><LockIcon /></span>}
          <h4 className="ui-outline">{room.name}</h4><small>{tr('地下 {depth}', { depth: formatDepth(room.depth) })}</small>
          {room.unlocked ? <UiButton size="s" tone="green" aria-label={tr('传送到{name}', { name: room.name })} onPress={() => go(room.id)}>{tr('传送')}</UiButton>
            : <Bar value={state.maxDepth} max={room.depth} size="s">{tr('{now} / {depth} 米', { now: Math.floor(Math.min(state.maxDepth, room.depth)), depth: room.depth })}</Bar>}
        </div>;
      })}
    </div>
    {message && <p className="ui-hint" role="status">{message}</p>}
  </>;
}

function LockIcon() {
  return <svg viewBox="0 0 48 48" className="ui-icon"><rect x="9" y="21" width="30" height="23" rx="5" fill="#ffd447" stroke="#13355d" strokeWidth="3.5" /><path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#13355d" strokeWidth="5" /><circle cx="24" cy="31" r="3.5" fill="#13355d" /></svg>;
}
