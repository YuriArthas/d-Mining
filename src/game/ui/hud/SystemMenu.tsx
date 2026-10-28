import { useEffect, useRef, useState } from 'react';
import type { RenderRate } from '../../movement.ts';
import { Tile, UiButton } from '../kit/controls.tsx';
import { Toggle } from '../kit/panel.tsx';

/** Shell-level settings and lifecycle actions, owned by App and rendered by the HUD. */
export type SystemControls = {
  renderRate: RenderRate; toggleRenderRate(): void;
  shadows: boolean; toggleShadows(): void;
  music: boolean; toggleMusic(): void;
  sound: boolean; toggleSound(): void;
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
    <Tile icon="gear" label="" tone="white" className="hud-menu" aria-label="菜单" aria-expanded={open} aria-controls="hud-menu-panel" onPress={() => setOpen(value => !value)} />
    {open && <section id="hud-menu-panel" className="hud-menu-panel ui-panel ui-pop" aria-label="菜单">
      <h2 className="ui-panel-title ui-outline">菜单</h2>
      <UiButton size="s" tone="blue" icon="question" className="hud-menu-help" aria-label="操作帮助" onPress={() => { setOpen(false); onHelp(); }}>操作帮助</UiButton>
      <div className="hud-menu-switches">
        <Toggle on={system.music} label="音乐" onPress={system.toggleMusic} />
        <Toggle on={system.sound} label="音效" onPress={system.toggleSound} />
        <Toggle on={system.shadows} label="阴影" onPress={system.toggleShadows} />
        <Toggle on={system.renderRate === '60'} label="限 60 帧" onPress={system.toggleRenderRate} />
      </div>
      <UiButton size="s" tone="white" icon="exit" className="hud-menu-exit" aria-label={system.hosted ? '退出游戏，返回游戏列表' : '退出游戏'} onPress={() => { setOpen(false); system.exit(); }}>退出游戏</UiButton>
    </section>}
  </div>;
}
