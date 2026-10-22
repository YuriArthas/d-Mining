import { useRef, type ButtonHTMLAttributes, type MouseEvent, type PointerEvent } from 'react';
import { gameAudio } from '../audio/GameAudio.ts';

// Shared across buttons: a touch can replace its button with a new panel before
// the browser sends the compatibility click at the same screen position.
let lastTouch = -Infinity;

// Capture on the game shell as well: a touch can remove a dialog before the
// compatibility click arrives on a native <summary> or button behind it.
// A fresh finger press must still be able to use those native controls at once.
export function beginGameTouch(event: PointerEvent) {
  if (event.pointerType !== 'mouse') lastTouch = -Infinity;
}
export function blockGameCompatibilityClick(event: MouseEvent) {
  if (event.detail !== 0 && performance.now() - lastTouch < 700) {
    event.preventDefault(); event.stopPropagation();
  }
}

// Non-primary touch may not synthesize click. Handle its release once, and ignore
// the following compatibility click so a purchase never advances two tiers.
export function GameButton({ onPress, blurAfterPress = true, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onPointerDown' | 'onPointerUp' | 'onPointerCancel'> & { onPress: () => void; blurAfterPress?: boolean }) {
  const pointer = useRef<number | null>(null);
  // Every UI press gets the same soft click, before the action (which may play its own cue).
  const press = () => { gameAudio.play({ type: 'ui' }); onPress(); };
  return <button {...props} type={props.type ?? 'button'}
    onPointerDown={event => {
      if (event.pointerType !== 'mouse') { event.preventDefault(); pointer.current = event.pointerId; }
    }}
    onPointerCancel={() => { pointer.current = null; }}
    onPointerUp={event => {
      if (event.pointerType === 'mouse' || event.pointerId !== pointer.current) return;
      pointer.current = null; lastTouch = performance.now();
      if (!props.disabled && event.currentTarget.contains(document.elementFromPoint(event.clientX, event.clientY))) press();
    }}
    onClick={event => {
      if (event.detail !== 0 && performance.now() - lastTouch < 700) return;
      if (!props.disabled) press();
      if (blurAfterPress) event.currentTarget.blur();
    }} />;
}
