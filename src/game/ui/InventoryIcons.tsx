import type { CSSProperties } from 'react';

export function OreIcon({ color, className = '' }: { color: string; className?: string }) {
  return <svg aria-hidden="true" className={`ore-icon ${className}`} viewBox="0 0 32 32" style={{ '--ore-color': color } as CSSProperties}>
    <path d="m8 4 14 1 7 12-7 11-15-3L3 13Z" fill="var(--ore-color)" stroke="currentColor" strokeWidth="1.5" />
    <path d="m8 4 4 10 10-9M3 13l9 1-5 11m5-11 10 14m-10-14 17 3" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.5" />
  </svg>;
}

export function EquipmentIcon({ kind }: { kind: 'pickaxe' | 'backpack' | 'pet' | 'egg' }) {
  return <svg aria-hidden="true" className="equipment-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'pickaxe' ? <><path d="m8 27 13-16-4-3L4 23Z" fill="#bd9869" /><path d="M6 6C13 1 25 5 28 15L20 10 6 6Z" fill="#d9e6e4" /></> : kind === 'backpack' ? <><path d="M11 8V5h10v3M8 8h16l3 5v16H5V13Z" fill="#79c0c7" /><path d="M10 18h12v7H10ZM8 12h16" /></> : kind === 'pet' ? <><ellipse cx="9" cy="9" rx="3" ry="4" fill="currentColor" /><ellipse cx="23" cy="9" rx="3" ry="4" fill="currentColor" /><ellipse cx="4" cy="16" rx="2.5" ry="3.5" fill="currentColor" /><ellipse cx="28" cy="16" rx="2.5" ry="3.5" fill="currentColor" /><path d="M8 25c0-5 5-11 8-11s8 6 8 11c0 6-6 2-8 2s-8 4-8-2Z" fill="currentColor" /></> : <><path d="M16 3C11 3 5 15 5 21a11 9 0 0 0 22 0C27 15 21 3 16 3Z" fill="#f0d899" /><path d="m6 19 7-4 6 5 6-5" /></>}
  </svg>;
}
