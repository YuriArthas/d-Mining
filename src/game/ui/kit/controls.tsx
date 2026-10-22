import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { GameButton } from '../GameButton.tsx';
import { Icon, type IconKind } from './icons.tsx';
import './tokens.css';
import './kit.css';

export type Tone = 'blue' | 'orange' | 'purple' | 'pink' | 'green' | 'gold' | 'red' | 'steel';
type PressProps = Omit<ComponentProps<typeof GameButton>, 'children'>;

/** Square action tile: icon on a chunky colored body, outlined label across the bottom. */
export function Tile({ icon, label, tone = 'blue', badge, className = '', ...props }: PressProps & { icon: IconKind; label: string; tone?: Tone; badge?: ReactNode }) {
  return <GameButton {...props} className={`ui-tile ${className}`} data-tone={tone}>
    <Icon kind={icon} />
    <span className="ui-tile-label ui-outline">{label}</span>
    {badge != null && <b className="ui-badge ui-outline">{badge}</b>}
  </GameButton>;
}

/** Rectangular call-to-action button. */
export function UiButton({ tone = 'blue', size = 'm', icon, children, className = '', ...props }: PressProps & { tone?: Tone; size?: 's' | 'm' | 'l'; icon?: IconKind; children: ReactNode }) {
  return <GameButton {...props} className={`ui-btn ${className}`} data-tone={tone} data-size={size}>
    {icon && <Icon kind={icon} />}<span className="ui-outline">{children}</span>
  </GameButton>;
}

export function CloseButton({ label, className = '', ...props }: PressProps & { label: string }) {
  return <GameButton {...props} className={`ui-close ${className}`} aria-label={label} title={label}><Icon kind="close" /></GameButton>;
}

/** Resource capsule. The icon overhangs the left end; `meter` paints a fill level. */
export function Pill({ icon, tone = 'blue', meter, state, children, onPress, pressLabel, plus, className = '' }: {
  icon: IconKind; tone?: Tone; meter?: number; state?: 'full'; children: ReactNode; className?: string;
  onPress?(): void; pressLabel?: string; plus?: { label: string; onPress(): void };
}) {
  return <div className={`ui-pill ${className}`} data-tone={tone} data-state={state}
    style={meter === undefined ? undefined : { '--meter': `${Math.round(Math.min(1, Math.max(0, meter)) * 1000) / 10}%` } as CSSProperties}>
    {meter !== undefined && <span className="ui-pill-meter" aria-hidden="true" />}
    {onPress && <GameButton className="ui-pill-hit" aria-label={pressLabel} title={pressLabel} onPress={onPress} />}
    <Icon kind={icon} className="ui-icon ui-pill-icon" />
    <span className="ui-pill-value ui-outline ui-num">{children}</span>
    {plus && <GameButton className="ui-pill-plus" aria-label={plus.label} title={plus.label} onPress={plus.onPress}><span className="ui-pill-plus-face"><Icon kind="plus" /></span></GameButton>}
  </div>;
}
