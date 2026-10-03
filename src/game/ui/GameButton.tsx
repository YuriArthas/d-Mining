import { useRef, type ButtonHTMLAttributes } from 'react';

// Non-primary touch may not synthesize click. Handle its release once, and ignore
// the following compatibility click so a purchase never advances two tiers.
export function GameButton({ onPress, blurAfterPress = true, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onPointerDown' | 'onPointerUp' | 'onPointerCancel'> & { onPress: () => void; blurAfterPress?: boolean }) {
  const pointer = useRef<number | null>(null), lastTouch = useRef(-Infinity);
  return <button {...props} type={props.type ?? 'button'}
    onPointerDown={event => {
      if (event.pointerType !== 'mouse') { event.preventDefault(); pointer.current = event.pointerId; }
    }}
    onPointerCancel={() => { pointer.current = null; }}
    onPointerUp={event => {
      if (event.pointerType === 'mouse' || event.pointerId !== pointer.current) return;
      pointer.current = null; lastTouch.current = performance.now();
      if (!props.disabled && event.currentTarget.contains(document.elementFromPoint(event.clientX, event.clientY))) onPress();
    }}
    onClick={event => {
      if (event.detail !== 0 && performance.now() - lastTouch.current < 700) return;
      if (!props.disabled) onPress();
      if (blurAfterPress) event.currentTarget.blur();
    }} />;
}
