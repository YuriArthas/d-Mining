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
      <div ref={stick} className="joystick" role="group" aria-label={tr("msg.move_stick")}>
        <span ref={knob} className="joystick-knob" />
      </div>
      <div className="action-buttons">
        <button ref={jump} className="jump-button" type="button" aria-label={tr("msg.jump")} title={tr("msg.jump")} aria-pressed="false"><Icon kind="jump" /></button>
      </div>
    </div>
    <div className="control-hint">
      <span className="desktop-hint">{tr("msg.wasd_move_space_jump_right_mouse_look_point_hold_left_mouse_")}</span>
      <span className="touch-hint">{tr("msg.left_side_move_drag_to_look_tap_to_strike_hold_to_dig")}</span>
    </div>
  </>;
}
