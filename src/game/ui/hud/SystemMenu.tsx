import { useEffect, useRef, useState } from 'react';
import { Tile, UiButton } from '../kit/controls.tsx';
import { Toggle } from '../kit/panel.tsx';

import { LANGUAGES, tr, type Lang } from '../../i18n/i18n.ts';
/** Shell-level settings and lifecycle actions, owned by App and rendered by the HUD. */
export type SystemControls = {
  shadows: boolean; toggleShadows(): void;
  music: boolean; toggleMusic(): void;
  sound: boolean; toggleSound(): void;
  language: Lang; setLanguage(lang: Lang): void;
  hosted: boolean;
  exit(): void;
};

/** One menu in the top-right corner: help, the settings as switches, and leaving the game. */
export function SystemMenu({ system, onHelp }: { system: SystemControls; onHelp(): void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!anchor.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', escape); };
  }, [open]);
  return <div ref={anchor} className="hud-system">
    <Tile icon="gear" label="" tone="white" className="hud-menu" aria-label={tr("msg.menu")} aria-expanded={open} aria-controls="hud-menu-panel" onPress={() => setOpen(value => !value)} />
    {open && <section id="hud-menu-panel" className="hud-menu-panel ui-panel ui-pop" aria-label={tr("msg.menu")}>
      <h2 className="ui-panel-title ui-outline">{tr("msg.menu")}</h2>
      <UiButton size="s" tone="blue" icon="question" className="hud-menu-help" aria-label={tr("msg.how_to_play_7a328466")} onPress={() => { setOpen(false); onHelp(); }}>{tr("msg.how_to_play_7a328466")}</UiButton>
      <div className="hud-menu-switches">
        <Toggle on={system.music} label={tr("msg.music")} onPress={system.toggleMusic} />
        <Toggle on={system.sound} label={tr("msg.sound")} onPress={system.toggleSound} />
        <Toggle on={system.shadows} label={tr("msg.shadows")} onPress={system.toggleShadows} />
      </div>
      <div className="ui-seg hud-menu-lang" role="group" aria-label={tr("msg.language")}>{LANGUAGES.map(l =>
        <button key={l.id} type="button" lang={l.id} aria-pressed={system.language === l.id} onClick={() => system.setLanguage(l.id)}>{l.label}</button>)}</div>
      <UiButton size="s" tone="white" icon="exit" className="hud-menu-exit" aria-label={system.hosted ? tr("msg.exit_the_game_and_return_to_the_game_list") : tr("msg.exit_game")} onPress={() => { setOpen(false); system.exit(); }}>{tr("msg.exit_game")}</UiButton>
    </section>}
  </div>;
}
