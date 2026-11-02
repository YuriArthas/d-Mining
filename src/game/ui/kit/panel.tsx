import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { GameButton } from '../GameButton.tsx';
import { CloseButton } from './controls.tsx';
import { Icon, type IconKind } from './icons.tsx';
import type { PetRarity } from '../../logic/pets/types.ts';
import './panel.css';

import { tr } from '../../i18n/i18n.ts';
export type SheetTab<T extends string> = { id: T; label: string; icon: IconKind | ReactNode; badge?: ReactNode };
const FOCUSABLE = 'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])';

/** The one dialog container. Keys stay inside the sheet so typing never moves the miner. */
export function Sheet<T extends string>({ title, subtitle, size = 'l', tabs, tab, onTab, onClose, footer, children, className = '', label }: {
  title: string; subtitle?: ReactNode; size?: 'l' | 'm' | 's'; tabs?: readonly SheetTab<T>[]; tab?: T; onTab?(id: T): void;
  onClose?(): void; footer?: ReactNode; children: ReactNode; className?: string; label?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, [title]);
  const keys = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape' && onClose) { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(e => e.getClientRects().length > 0);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    items[event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index + 1) % items.length]?.focus();
  };
  return <div className="ui-sheet-backdrop">
    <section ref={panel} role="dialog" aria-modal="true" aria-label={label ?? title} tabIndex={-1} onKeyDown={keys}
      className={`ui-sheet ui-panel ${className}`} data-size={size} data-tabs={!!tabs}>
      <h1 className="ui-sheet-title ui-outline">{title}</h1>
      {subtitle && <p className="ui-sheet-sub">{subtitle}</p>}
      {onClose && <CloseButton className="ui-sheet-close" label={tr("msg.close_label", { label: label ?? title })} onPress={onClose} />}
      {tabs && <nav className="ui-tabs" role="tablist" aria-label={tr("msg.title_categories", { title: title })}>{tabs.map(item =>
        <GameButton key={item.id} role="tab" className="ui-tab" data-long={item.label.length > 7 || undefined} aria-selected={item.id === tab} blurAfterPress={false} onPress={() => onTab?.(item.id)}>
          {typeof item.icon === 'string' ? <Icon kind={item.icon as IconKind} /> : item.icon}
          <span className="ui-outline">{item.label}</span>
          {item.badge != null && <b className="ui-badge ui-outline">{item.badge}</b>}
        </GameButton>)}</nav>}
      <div className="ui-sheet-body">{children}</div>
      {footer && <footer className="ui-sheet-footer">{footer}</footer>}
    </section>
  </div>;
}

export function Chip({ icon, children, label }: { icon?: IconKind | ReactNode; children: ReactNode; label?: string }) {
  return <span className="ui-chip" aria-label={label}>{typeof icon === 'string' ? <Icon kind={icon as IconKind} /> : icon}{children}</span>;
}

export function Bar({ value, max, children, tone, size }: { value: number; max: number; children?: ReactNode; tone?: 'gold'; size?: 's' }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return <div className="ui-bar" data-tone={tone} data-size={size} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}
    style={{ '--v': `${Math.round(ratio * 1000) / 10}%` } as CSSProperties}><i />{children != null && <span>{children}</span>}</div>;
}

export function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress(): void }) {
  return <GameButton className="ui-toggle" aria-pressed={on} blurAfterPress={false} onPress={onPress}><i aria-hidden="true" /><span className="ui-outline">{label}</span></GameButton>;
}

const RARITY_LABEL: Record<PetRarity, string> = { common: tr("msg.common"), rare: tr("msg.rare"), epic: tr("msg.epic"), legendary: tr("msg.legendary") };
export function RarityTag({ rarity }: { rarity: PetRarity }) {
  return <span className="ui-rarity" data-rarity={rarity}>{RARITY_LABEL[rarity]}</span>;
}
