import { useEffect, useRef, type ReactNode } from 'react';
import { GameButton } from '../GameButton.tsx';
import './pets.css';

export function PetDialog({ title, onClose, children, className = '' }: {
  title: string; onClose(): void; children: ReactNode; className?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  return <div className="pet-backdrop">
    <section ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`pet-panel ${className}`}
      onKeyDown={event => {
        // Focus inside a pet panel must not also move or mine in the world.
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key !== 'Tab') return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length]?.focus();
      }}>
      <header className="pet-heading"><h1>{title}</h1>
        <GameButton className="pet-close" aria-label={`关闭${title}`} blurAfterPress={false} onPress={onClose}><svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg></GameButton>
      </header>
      {children}
    </section>
  </div>;
}
