import { useRef, type ButtonHTMLAttributes } from 'react';

// Shared across buttons: a touch can replace its button with a new panel before
// the browser sends the compatibility click at the same screen position.
let lastTouch = -Infinity;

// Non-primary touch may not synthesize click. Handle its release once, and ignore
// the following compatibility click so a purchase never advances two tiers.
export function GameButton({ onPress, blurAfterPress = true, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onPointerDown' | 'onPointerUp' | 'onPointerCancel'> & { onPress: () => void; blurAfterPress?: boolean }) {
  const pointer = useRef<number | null>(null);
  return <button {...props} type={props.type ?? 'button'}
    onPointerDown={event => {
      if (event.pointerType !== 'mouse') { event.preventDefault(); pointer.current = event.pointerId; }
    }}
    onPointerCancel={() => { pointer.current = null; }}
    onPointerUp={event => {
      if (event.pointerType === 'mouse' || event.pointerId !== pointer.current) return;
      pointer.current = null; lastTouch = performance.now();
      if (!props.disabled && event.currentTarget.contains(document.elementFromPoint(event.clientX, event.clientY))) onPress();
    }}
    onClick={event => {
      if (event.detail !== 0 && performance.now() - lastTouch < 700) return;
      if (!props.disabled) onPress();
      if (blurAfterPress) event.currentTarget.blur();
    }} />;
}
