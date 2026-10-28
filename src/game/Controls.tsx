import { useEffect, useRef, type RefObject } from 'react';
import type { GameInput } from './GameInput.ts';
import { bindInput } from './bindInput.ts';
import { Icon } from './ui/kit/icons.tsx';
import { tr } from './i18n/i18n.ts';

export function Controls({ input, surface }: { input: GameInput; surface: RefObject<HTMLDivElement | null> }) {
  const touchTarget = useRef<HTMLDivElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const jump = useRef<HTMLButtonElement>(null);
  useEffect(() => bindInput(input, {
    touchTarget: touchTarget.current!, surface: surface.current!, stick: stick.current!, knob: knob.current!, jump: jump.current!,
  }), [input, surface]);
  return <>
    <div ref={touchTarget} className="touch-target" hidden aria-hidden="true" />
    <div className="touch-controls">
      <div ref={stick} className="joystick" role="group" aria-label={tr('移动摇杆')}>
        <span ref={knob} className="joystick-knob" />
      </div>
      <div className="action-buttons">
        <button ref={jump} className="jump-button" type="button" aria-label={tr('跳跃')} title={tr('跳跃')} aria-pressed="false"><Icon kind="jump" /></button>
      </div>
    </div>
    <div className="control-hint">
      <span className="desktop-hint">{tr('WASD 移动 · 空格跳跃 · 右键观察 · 鼠标指向 · 按住左键挖掘')}</span>
      <span className="touch-hint">{tr('左侧移动 · 拖动观察 · 点按敲击 · 长按挖掘')}</span>
    </div>
  </>;
}
