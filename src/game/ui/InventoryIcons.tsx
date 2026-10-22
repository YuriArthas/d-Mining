import type { CSSProperties } from 'react';

export function OreIcon({ color, className = '' }: { color: string; className?: string }) {
  return <svg aria-hidden="true" className={`ore-icon ${className}`} viewBox="0 0 32 32" style={{ '--ore-color': color } as CSSProperties}>
    <path d="m8 4 14 1 7 12-7 11-15-3L3 13Z" fill="var(--ore-color)" stroke="currentColor" strokeWidth="1.5" />
    <path d="m8 4 4 10 10-9M3 13l9 1-5 11m5-11 10 14m-10-14 17 3" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.5" />
  </svg>;
}
