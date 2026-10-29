import { useEffect, useRef, useState } from 'react';
import { sendPerformanceReport } from '../../presentation/PerformanceRecorder.ts';
import { GameButton } from '../GameButton.tsx';
import { Icon } from '../kit/icons.tsx';
import { tr } from '../../i18n/i18n.ts';

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; id: string } | { kind: 'failed' };

/** Bottom left: one press sends the last 30 seconds of frames, the device and where the player is to the public host
 *  (PerformanceRecorder). It then shows the report's short id for a few seconds, or that it failed (press again). */
export function PerformanceReportButton() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  // Locked at once: a second tap can land before React has re-rendered the button as disabled.
  const busy = useRef(false);
  useEffect(() => {
    if (state.kind !== 'sent' && state.kind !== 'failed') return;
    const timer = setTimeout(() => setState({ kind: 'idle' }), 8000);
    return () => clearTimeout(timer);
  }, [state]);
  const send = () => {
    if (busy.current) return;
    busy.current = true; setState({ kind: 'sending' });
    sendPerformanceReport().then(
      id => setState({ kind: 'sent', id: id.slice(0, 8) }),
      error => { console.warn('performance report failed', error); setState({ kind: 'failed' }); })
      .finally(() => { busy.current = false; });
  };
  const label = state.kind === 'sending' ? tr('正在上报…') : state.kind === 'sent' ? tr('已上报 · {id}', { id: state.id })
    : state.kind === 'failed' ? tr('上报失败，点按重试') : tr('上报性能');
  // Icon-only on touch screens while idle: the name stays on it for screen readers and as its tooltip.
  return <GameButton className="hud-perf" data-state={state.kind} disabled={state.kind === 'sending'} title={tr('上报最近 30 秒的性能和设备信息')} aria-label={label}
    onPress={send}><Icon kind="gauge" /><span>{label}</span></GameButton>;
}
