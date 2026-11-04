import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import type { WorldId } from '../../content/worldJourney.ts';
import { itemDefinition } from '../../application/items.ts';
import { formatDepth, formatNumber as number } from '../../presentation/formatNumber.ts';
import { OreIcon } from '../InventoryIcons.tsx';
import { PriceButton, UiButton } from '../kit/controls.tsx';
import { Icon } from '../kit/icons.tsx';
import { Bar, Sheet } from '../kit/panel.tsx';
import { currencyIcon, currencyName } from '../currency.ts';
import { tr } from '../../i18n/i18n.ts';
import './world.css';

/** Each layer card takes its theme's colour (themes.ts), whatever the language of its name. */
const LAYER_COLORS: Readonly<Record<string, string>> = {
  timber_mine: '#d79a5a', mushroom_cave: '#3fc0a0', crystal_cave: '#9b8cf5', buried_ruins: '#cdb06a',
  frozen_cave: '#5fc8ef', lava_cave: '#f07a52', fossil_cave: '#c9a07c', ancient_machine: '#3fb8b0', core_sanctum: '#e9b84a',
};
const FALLBACK = ['#62a8e8', '#9fb85c', '#e88aa8'];
const layerColor = (theme: string | undefined, index: number) => (theme && LAYER_COLORS[theme]) || FALLBACK[index % FALLBACK.length];
/** Each world's colour: world 1 meadow green, world 2 tech cyan, world 3 star violet. */
const WORLD_COLORS = ['#3fc93a', '#2fb4ff', '#9b6bff'];

/** A short line that pops up over the bottom of the sheet and goes. */
function useToast() {
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2600); return () => clearTimeout(timer); }, [toast]);
  return [(text: string) => setToast({ text, id: Date.now() }), toast && <output key={toast.id} className="ui-toast world-toast ui-pop" role="status">{toast.text}</output>] as const;
}

/** The world portal (docs/draft-ui-v2.md, U7): the three worlds side by side, each with its place name and the
 *  currency it pays in. Open worlds travel; the next world carries its ticket right on its card (the pickaxe level,
 *  minerals from earlier worlds, locked into the material store or still in the bag, and the previous world's money) and unlocks there, with
 *  one confirmation since it spends; worlds beyond it stay ???. */
export function PortalSheet({ session, onClose }: { session: GameSession; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [confirm, setConfirm] = useState(false);
  const [toast, toastView] = useToast();
  const next = state.worlds.find(w => w.known && !w.open);
  const ticket = next?.ticket ?? null;
  const ready = !!next && !!ticket && next.toolLevel >= ticket.toolLevel && next.materials.every(m => m.owned >= m.count) && next.ticketBalance >= ticket.price;
  const go = (id: WorldId) => {
    const r = session.travelWorld(id);
    if (r === 'travelling') onClose(); else toast(r === 'locked' ? tr("msg.this_world_isn_t_open_yet") : r === 'away' ? tr("msg.stand_at_the_portal_to_teleport") : tr("msg.can_t_teleport_right_now_try_again_in_a_moment"));
  };
  const unlock = () => {
    if (!next) return;
    const r = session.unlockWorld(next.id); setConfirm(false);
    toast(r.status === 'opened' ? tr("msg.name_is_open_you_can_teleport_there_now", { name: next.name }) : r.status === 'away' ? tr("msg.stand_at_the_portal_to_unlock")
      : r.status === 'insufficient-level' ? tr("msg.needs_named_pickaxe", { name: state.shopCatalog.tools[ticket!.toolLevel - 1].name }) : tr("msg.not_ready_yet_nothing_was_spent"));
  };
  return <Sheet title={tr("msg.world_portal")} onClose={onClose} className="portal-sheet">
    <div className="portal-worlds">{state.worlds.map((world, i) => {
      const here = world.id === state.currentWorld, isNext = world === next;
      const style = { '--c': world.known ? WORLD_COLORS[i] : 'var(--ui-mute)' } as CSSProperties;
      return <section key={world.id} className="portal-world" data-state={here ? 'here' : world.open ? 'open' : isNext ? 'next' : 'unknown'} style={style}
        aria-label={world.known ? `${world.name} ${world.title}` : '???'}>
        <header>
          <small>{world.name}</small>
          <b>{world.known ? world.title : '???'}</b>
          {world.known && <span className="portal-currency"><Icon kind={currencyIcon(world.currency)} />{currencyName(world.currency)}</span>}
        </header>
        {here ? <><Icon kind="globe" className="ui-icon portal-art" /><span className="ui-stamp portal-here">{tr("msg.you_are_here")}</span></>
          : world.open ? <><Icon kind="globe" className="ui-icon portal-art" />
            <UiButton size="m" tone="green" icon="portal" className="portal-go" aria-label={tr("msg.teleport_to_name", { name: world.name })} onPress={() => go(world.id)}>{tr("msg.teleport")}</UiButton></>
          : isNext && ticket ? <>
            <ul className="portal-ticket" aria-label={tr("msg.to_unlock_world_you_need", { world: world.name })}>
              <li className="portal-need portal-tool" data-done={world.toolLevel >= ticket.toolLevel || undefined}>
                <span className="portal-need-icon"><Icon kind="pickaxe" /></span>
                <span className="portal-need-label">{tr("msg.needs_named_pickaxe", { name: state.shopCatalog.tools[ticket.toolLevel - 1].name })}</span>
                {world.toolLevel >= ticket.toolLevel && <i className="portal-tick" aria-hidden="true">✓</i>}
              </li>
              {world.materials.map(m => <Need key={m.itemId} icon={<OreIcon color={itemDefinition(m.itemId).color} />} label={m.name} have={m.owned} need={m.count}
                text={`${number(Math.min(m.owned, m.count))}/${number(m.count)}`} />)}
              <Need icon={<Icon kind={currencyIcon(ticket.currency)} />} label={currencyName(ticket.currency)} have={world.ticketBalance} need={ticket.price}
                text={`${number(Math.min(world.ticketBalance, ticket.price))}/${number(ticket.price)}`} />
            </ul>
            {!confirm && <small className="portal-note">{tr("msg.lock_them_in_the_bag_s_material_store_and_they_are_kept_as_y")}</small>}
            {confirm
              ? <div className="portal-confirm"><span>{tr("msg.spend_the_ore_above_and_price_unit", { price: number(ticket.price), unit: currencyName(ticket.currency) })}</span>
                <UiButton size="s" tone="white" onPress={() => setConfirm(false)}>{tr("msg.cancel")}</UiButton><UiButton size="s" tone="orange" disabled={!ready} onPress={unlock}>{tr("msg.unlock")}</UiButton></div>
              : <PriceButton verb={tr("msg.unlock_70fba17f")} price={number(ticket.price)} currency={currencyIcon(ticket.currency)} tone="orange" className="portal-unlock" disabled={!ready}
                aria-label={tr("msg.unlock_world", { world: world.name })} onPress={() => setConfirm(true)} />}
          </>
          : <><span className="portal-art world-lock" aria-hidden="true"><Icon kind="lock" /></span><small className="portal-note">{tr("msg.unlock_the_previous_world_first")}</small></>}
      </section>;
    })}</div>
    {toastView}
  </Sheet>;
}

/** One line of a world's ticket: what it is, a bar, and how much of it the player has; a tick once it is met. */
function Need({ icon, label, have, need, text }: { icon: ReactNode; label: string; have: number; need: number; text: string }) {
  const done = have >= need;
  return <li className="portal-need" data-done={done || undefined} aria-label={`${label} ${text}`}>
    <span className="portal-need-icon">{icon}</span><span className="portal-need-label">{label}</span>
    <Bar value={Math.min(have, need)} max={need} size="s">{text}</Bar>
    {done && <i className="portal-tick" aria-hidden="true">✓</i>}
  </li>;
}

/** The teleport station on each world's surface (docs/draft-ui-v2.md, U7): the surface and the six rest layers in
 *  one row, deepest last. A layer reached is a button to its hall (its card says what the hall has: a sell ring,
 *  and every other layer an upgrade counter); the next layer to reach shows how far down it is; the ones after it
 *  stay locked. */
export function StationSheet({ session, onClose }: { session: GameSession; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const world = state.worlds.find(w => w.id === state.currentWorld)?.name ?? '';
  const [toast, toastView] = useToast();
  const surface = state.location !== 'mine' && state.location !== 'room';
  const here = state.location === 'room' ? state.destinations.filter(d => d.depth <= state.depth).sort((a, b) => b.depth - a.depth)[0]?.id : null;
  const nextId = state.destinations.filter(d => !d.unlocked).sort((a, b) => a.depth - b.depth)[0]?.id;
  const go = (id: string) => {
    const result = session.travelTo(id);
    if (result === 'travelling') onClose();
    else toast(result === 'locked' ? tr("msg.you_haven_t_unlocked_this_layer_yet") : tr("msg.can_t_teleport_right_now_try_again_in_a_moment"));
  };
  return <Sheet title={tr("msg.world_teleporter", { world })} subtitle={tr("msg.deepest_maxdepth", { maxDepth: formatDepth(state.maxDepth) })} onClose={onClose} className="station-sheet">
    <div className="station-layers">
      <div className="station-layer" data-state={surface ? 'here' : 'open'} style={{ '--c': WORLD_COLORS[(state.currentWorld - 1) % 3] } as CSSProperties}>
        <span className="station-num"><Icon kind="home" /></span>
        <b className="station-name">{tr("msg.surface_99f9669e")}</b>
        <small>{tr("msg.shops_egg_stands")}</small>
        {surface ? <span className="ui-stamp">{tr("msg.you_are_here")}</span>
          : <UiButton size="s" tone="blue" className="station-go" onPress={() => { session.returnToSurface(); onClose(); }}>{tr("msg.back")}</UiButton>}
      </div>
      {state.destinations.map((room, index) => {
        const state3 = room.id === here ? 'here' : room.unlocked ? 'open' : room.id === nextId ? 'next' : 'locked';
        return <div key={room.id} className="station-layer" data-state={state3} style={{ '--c': layerColor(room.theme, index) } as CSSProperties}>
          <span className="station-num ui-num">{index + 1}</span>
          <b className="station-name">{room.name}</b>
          <small>{tr("msg.depth_down", { depth: formatDepth(room.depth) })}</small>
          {room.unlocked && <span className="station-has" aria-label={room.hasShop ? tr("msg.sell_shop") : tr("msg.sell")}>
            <Icon kind={currencyIcon(state.currency)} />{room.hasShop && <Icon kind="chest" />}</span>}
          {state3 === 'here' ? <span className="ui-stamp">{tr("msg.you_are_here")}</span>
            : room.unlocked ? <UiButton size="s" tone="green" className="station-go" aria-label={tr("msg.teleport_to_name", { name: room.name })} onPress={() => go(room.id)}>{tr("msg.teleport")}</UiButton>
            : state3 === 'next' ? <span className="station-next"><em>{tr("msg.next_f5e9097e")}</em><Bar value={state.maxDepth} max={room.depth} size="s">
              {tr("msg.now_depth_m", { now: Math.floor(Math.min(state.maxDepth, room.depth)), depth: room.depth })}</Bar></span>
            : <span className="station-lock"><Icon kind="lock" /></span>}
        </div>;
      })}
    </div>
    <p className="ui-hint station-hint">{tr("msg.reaching_a_new_depth_unlocks_that_layer_for_good")}</p>
    {toastView}
  </Sheet>;
}
