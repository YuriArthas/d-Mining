import { useEffect, useRef, useState } from 'react';
import type { RenderRate } from '../../movement.ts';
import type { SurfaceTime } from '../../world/SceneLighting.ts';
import { Tile, UiButton } from '../kit/controls.tsx';

/** Shell-level settings and lifecycle actions, owned by App and rendered by the HUD. */
export type SystemControls = {
  renderRate: RenderRate; toggleRenderRate(): void;
  shadows: boolean; toggleShadows(): void;
  stylized: boolean; toggleStylized(): void;
  timeOfDay: SurfaceTime | 'auto'; toggleTimeOfDay(): void; autoTimeOfDay(): void;
  debug: boolean; hosted: boolean;
  exit(): void;
};

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
  return <div className="hud-system">
    <Tile icon="question" label="帮助" aria-label="操作帮助" onPress={() => { setOpen(false); onHelp(); }} />
    <div ref={anchor} className="hud-settings">
      <Tile icon="gear" label="设置" aria-label="设置" aria-expanded={open} aria-controls="hud-settings-panel" onPress={() => setOpen(value => !value)} />
      {open && <section id="hud-settings-panel" className="hud-settings-panel ui-panel" aria-label="设置">
        <h2 className="ui-panel-title ui-outline">设置</h2>
        <UiButton size="s" tone="steel" aria-pressed={system.renderRate === '60'} onPress={system.toggleRenderRate}>帧率上限：{system.renderRate === '60' ? '60' : '跟随屏幕'}</UiButton>
        <UiButton size="s" tone="steel" aria-pressed={system.shadows} onPress={system.toggleShadows}>阴影：{system.shadows ? '开' : '关'}</UiButton>
        {system.debug && <>
          <UiButton size="s" tone="steel" aria-pressed={system.stylized} onPress={system.toggleStylized}>画面：{system.stylized ? '风格化' : '原始'}</UiButton>
          <UiButton size="s" tone="steel" onPress={system.toggleTimeOfDay}>{system.timeOfDay === 'auto' ? '昼夜：自动' : system.timeOfDay === 'day' ? '昼夜：白天' : '昼夜：夜晚'}</UiButton>
          {system.timeOfDay !== 'auto' && <UiButton size="s" tone="steel" onPress={system.autoTimeOfDay}>恢复自动昼夜</UiButton>}
        </>}
        <UiButton size="s" tone="red" icon="exit" aria-label={system.hosted ? '退出游戏，返回游戏列表' : '退出游戏'} onPress={() => { setOpen(false); system.exit(); }}>退出游戏</UiButton>
      </section>}
    </div>
  </div>;
}
