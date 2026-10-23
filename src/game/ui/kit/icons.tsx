import type { ReactNode } from 'react';

/** Chunky two-tone vector icons with navy outlines, drawn on a 48 × 48 grid. */
export type IconKind =
  | 'backpack' | 'coin' | 'paw' | 'chest' | 'gift' | 'grid' | 'globe' | 'portal' | 'gem'
  | 'question' | 'gear' | 'home' | 'jump' | 'plus' | 'bolt' | 'clover' | 'exit' | 'close' | 'pickaxe' | 'luck';

const INK = '#13355d';
const line = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const ICONS: Record<IconKind, ReactNode> = {
  backpack: <>
    <path d="M18 11V9a6 6 0 0 1 12 0v2" fill="none" {...line} />
    <path d="M10 18c0-4 3-7 7-7h14c4 0 7 3 7 7v19c0 3-2 5-5 5H15c-3 0-5-2-5-5Z" fill="#ec5a40" {...line} />
    <path d="M10 22h28" {...line} />
    <path d="M17 28h14v7a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3Z" fill="#ff9a45" {...line} />
    <path d="M15 15h6" stroke="#ffc0a6" strokeWidth="3" strokeLinecap="round" />
  </>,
  coin: <>
    <circle cx="25.5" cy="26" r="17" fill="#c9840f" {...line} />
    <circle cx="22.5" cy="23" r="17" fill="#ffcf3d" {...line} />
    <circle cx="22.5" cy="23" r="11.5" fill="#ffdd66" stroke="#e39a12" strokeWidth="2.5" />
    <path d="m22.5 15 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" fill="#fff6c4" stroke="#e39a12" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 16a12 12 0 0 1 6-6" stroke="#fff8d8" strokeWidth="3" strokeLinecap="round" fill="none" />
  </>,
  // Lucky coin (rewards and the capsule machine): pink with a four-leaf clover, never mistaken for gold.
  luck: <>
    <circle cx="25.5" cy="26" r="17" fill="#c2367a" {...line} />
    <circle cx="22.5" cy="23" r="17" fill="#ff6fb1" {...line} />
    <circle cx="22.5" cy="23" r="11.5" fill="#ff9ccb" stroke="#e0458f" strokeWidth="2.5" />
    <g fill="#5fd36a" stroke="#227a3c" strokeWidth="1.6"><circle cx="18.6" cy="19.3" r="4.2" /><circle cx="26.4" cy="19.3" r="4.2" /><circle cx="18.6" cy="27" r="4.2" /><circle cx="26.4" cy="27" r="4.2" /></g>
    <path d="M22.5 23.2c1.5 3 2.6 5.6 3.3 8.6" stroke="#227a3c" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M12 16a12 12 0 0 1 6-6" stroke="#ffd9ec" strokeWidth="3" strokeLinecap="round" fill="none" />
  </>,
  paw: <>
    <ellipse cx="11.5" cy="20" rx="4.6" ry="5.6" fill="#ffd24d" {...line} />
    <ellipse cx="19.5" cy="11.5" rx="4.6" ry="5.6" fill="#ffd24d" {...line} />
    <ellipse cx="28.5" cy="11.5" rx="4.6" ry="5.6" fill="#ffd24d" {...line} />
    <ellipse cx="36.5" cy="20" rx="4.6" ry="5.6" fill="#ffd24d" {...line} />
    <path d="M24 22c-6 0-12.5 8-12.5 13.5 0 5 5 6 8.5 5 2-.6 2.8-1 4-1s2 .4 4 1c3.5 1 8.5 0 8.5-5C36.5 30 30 22 24 22Z" fill="#ffd24d" {...line} />
    <path d="M17 31c1-2.5 3-4.5 5-5.5" stroke="#fff3b8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </>,
  chest: <>
    <path d="M6 23h36v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z" fill="#c9652c" {...line} />
    <path d="M6 23c0-8 6-14 18-14s18 6 18 14Z" fill="#ea8139" {...line} />
    <path d="M13 11.5V42M35 11.5V42" stroke={INK} strokeWidth="7" />
    <path d="M13 11.5V42M35 11.5V42" stroke="#ffd447" strokeWidth="3.4" />
    <path d="M6 23h36" {...line} />
    <rect x="19.5" y="19" width="9" height="11" rx="2.5" fill="#ffd447" {...line} />
    <path d="M24 23.5v2.5" {...line} />
  </>,
  gift: <>
    <rect x="8" y="21" width="32" height="20" rx="3" fill="#ff6c9c" {...line} />
    <rect x="5" y="14.5" width="38" height="9" rx="3" fill="#ff93b9" {...line} />
    <path d="M24 14.5V41" stroke={INK} strokeWidth="9" />
    <path d="M24 14.5V41" stroke="#ffd447" strokeWidth="5" />
    <path d="M24 14c-3-6-10-9-12.5-5.5S16.5 14 24 14Zm0 0c3-6 10-9 12.5-5.5S31.5 14 24 14Z" fill="#ffd447" {...line} />
  </>,
  grid: <>
    {[[6, 6], [26, 6], [6, 26], [26, 26]].map(([x, y]) => <rect key={`${x}:${y}`} x={x} y={y} width="16" height="16" rx="4.5" fill="#f2fbff" {...line} />)}
  </>,
  globe: <>
    <circle cx="24" cy="24" r="18" fill="#58c8ff" {...line} />
    <path d="M11 15c4-2 7-1 8 2s-2 5-5 6-5 3-4 6c-2-4-2-10 1-14Zm14-8c3 3 8 3 10 6s-1 6-5 6-6 4-4 8 6 4 7 8c3-4 4-8 3-13-1-8-6-14-11-15ZM19 33c3-1 6 1 6 4s-2 4-5 4c-2-2-3-5-1-8Z" fill="#7bd96a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 21a13 13 0 0 1 7-10" stroke="#e5fbff" strokeWidth="3" strokeLinecap="round" fill="none" />
  </>,
  portal: <>
    <path d="M8 42V22C8 6 40 6 40 22v20Z" fill="#b991f2" {...line} />
    <path d="M15 42V23c0-10 18-10 18 0v19Z" fill="#5d3fb0" {...line} />
    <path d="m26 17-7 11h6l-3 9 9-13h-6l4-7Z" fill="#9ff3ff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <path d="M5 42h38" {...line} />
  </>,
  gem: <>
    <path d="M13 8h22l8 11-19 22L5 19Z" fill="#53d8f2" {...line} />
    <path d="M5 19h38M13 8l6 11 5-11 5 11 6-11M19 19l5 22 5-22" fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M14 12l3 5" stroke="#e8fdff" strokeWidth="3" strokeLinecap="round" />
  </>,
  question: <>
    <path d="M15 17c0-11 19-11 18 0-.6 6-9 6-9 12" fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 17c0-11 19-11 18 0-.6 6-9 6-9 12" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="24" cy="39.5" r="5" fill="#fff" {...line} />
  </>,
  gear: <>
    <path d="m21 4h6l1.3 5.2 3.6 1.5 4.6-2.8 4.2 4.2-2.8 4.6 1.5 3.6L44 21v6l-5.2 1.3-1.5 3.6 2.8 4.6-4.2 4.2-4.6-2.8-3.6 1.5L27 44h-6l-1.3-5.2-3.6-1.5-4.6 2.8-4.2-4.2 2.8-4.6-1.5-3.6L4 27v-6l5.2-1.3 1.5-3.6-2.8-4.6 4.2-4.2 4.6 2.8 3.6-1.5Z" fill="#f2fbff" {...line} />
    <circle cx="24" cy="24" r="7" fill="#58c8ff" {...line} />
  </>,
  home: <>
    <path d="M10 22v18a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V22" fill="#fff6d6" {...line} />
    <path d="M4 24 24 6l20 18" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 24 24 6l20 18" fill="none" stroke="#ff7a3d" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 42V30h10v12" fill="#d98a33" {...line} />
  </>,
  jump: <>
    <path d="M10 30 24 16l14 14" fill="none" stroke={INK} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 30 24 16l14 14" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  plus: <>
    <path d="M24 10v28M10 24h28" stroke={INK} strokeWidth="12" strokeLinecap="round" />
    <path d="M24 10v28M10 24h28" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
  </>,
  bolt: <path d="M28 4 9 27h12l-4 17 22-26H27Z" fill="#ffd447" {...line} />,
  clover: <>
    {[[17, 17], [31, 17], [17, 31], [31, 31]].map(([x, y]) => <circle key={`${x}:${y}`} cx={x} cy={y} r="8.5" fill="#5bd46a" {...line} />)}
    <path d="M24 24c2 6 6 11 12 16" fill="none" {...line} />
  </>,
  exit: <>
    <path d="M27 7H10v34h17" fill="none" stroke={INK} strokeWidth="9" strokeLinejoin="round" />
    <path d="M27 7H10v34h17" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinejoin="round" />
    <path d="M21 24h20m-7-8 8 8-8 8" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 24h20m-7-8 8 8-8 8" fill="none" stroke="#ffd447" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  close: <>
    <path d="m12 12 24 24M36 12 12 36" stroke={INK} strokeWidth="13" strokeLinecap="round" />
    <path d="m12 12 24 24M36 12 12 36" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
  </>,
  pickaxe: <>
    <path d="m12 41 18-21" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    <path d="m12 41 18-21" stroke="#c98f55" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M8 13C17 4 33 5 41 17c-6-3-12-4-17-3-6 0-11 1-16-1Z" fill="#d7e5ee" {...line} />
    <path d="M14 11c5-2 11-2 16 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </>,
};

export function Icon({ kind, className = 'ui-icon' }: { kind: IconKind; className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">{ICONS[kind]}</svg>;
}
