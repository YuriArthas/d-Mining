import { EquipmentIcon, OreIcon } from './InventoryIcons.tsx';

export type HudIconKind = 'coin' | 'upgrade' | 'backpack' | 'pets' | 'world' | 'minerals' | 'rewards' | 'travel' | 'home' | 'settings' | 'help' | 'exit';

/** Native vector icons stay crisp independently of the generated layout reference. */
export function HudIcon({ kind }: { kind: HudIconKind }) {
  if (kind === 'upgrade' || kind === 'backpack' || kind === 'pets') {
    return <EquipmentIcon kind={kind === 'upgrade' ? 'pickaxe' : kind === 'pets' ? 'pet' : 'backpack'} />;
  }
  if (kind === 'minerals') return <OreIcon color="#9fe8ff" />;
  return <svg className="hud-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#173c58" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'coin' && <><ellipse cx="26" cy="26" rx="16" ry="18" fill="#d98a15" /><ellipse cx="22" cy="23" rx="16" ry="18" fill="#ffcc3c" /><ellipse cx="22" cy="23" rx="11" ry="13" stroke="#ed9b22" /><path d="m22 13 3 6 6 1-4 5 1 7-6-3-6 3 1-7-4-5 6-1Z" fill="#fff09d" stroke="#fff4b1" strokeWidth="1.5" /><path d="m12 9 4-2" stroke="#fff8d0" strokeWidth="3" /></>}
    {kind === 'world' && <><circle cx="24" cy="24" r="19" fill="#7edaff" /><path d="m9 12 10-5 3 7-5 6-8-1Zm17 11 11-4 6 9-7 12-9-3-3-7ZM11 27l6 1 3 7-8 3" fill="#81da71" /><path d="M10 20a15 15 0 0 1 11-12" stroke="#e0ffff" strokeWidth="3" /></>}
    {kind === 'rewards' && <><path d="M8 22h32v21H8Z" fill="#ffbe36" /><path d="M5 16h38v10H5Z" fill="#ffe16a" /><path d="M20 16h8v27h-8Z" fill="#f46583" /><path d="M24 16C5 17 8 2 16 5c6 2 8 11 8 11Zm0 0C43 17 40 2 32 5c-6 2-8 11-8 11Z" fill="#ff859b" /><path d="M10 19h7" stroke="#fff2c2" /></>}
    {kind === 'travel' && <><path d="M8 41V22C8 1 40 1 40 22v19Z" fill="#b993ef" /><path d="M15 41V23c0-14 18-14 18 0v18Z" fill="#5541a8" /><path d="m25 19-7 12h7l-3 9 10-15h-8l4-6" fill="#c2ffff" stroke="#9eebff" strokeWidth="1" /><path d="M5 41h38" stroke="#ecddff" strokeWidth="4" /><path d="m7 8 1-4m31 4 3-2" stroke="#f8e9ff" /></>}
    {kind === 'home' && <><path d="M9 23 24 9l15 14v19H9Z" fill="#ffebad" /><path d="m4 24 20-19 20 19" stroke="#fff2b6" strokeWidth="6" /><path d="M20 42V28h10v14" fill="#dc9231" /><path d="M5 35H1m0 0 5-5m-5 5 5 5" stroke="#fff" /></>}
    {kind === 'settings' && <><path d="m19 4 10 0 2 6 6 3 6-1 4 9-5 4-1 6 3 5-7 7-6-3-6 1-4 5-9-4 1-6-3-6-6-2V18l6-2 3-6-1-6 9-4Z" transform="translate(2 3) scale(.88)" fill="#eff7fc" /><circle cx="24" cy="24" r="8" fill="#65b4d6" /></>}
    {kind === 'help' && <><circle cx="24" cy="24" r="20" fill="#e9f7ff" /><path d="M17 17c0-10 18-10 15 1-1 4-8 4-8 10" stroke="#285779" strokeWidth="5" /><circle cx="24" cy="36" r="2.5" fill="#285779" stroke="none" /></>}
    {kind === 'exit' && <><path d="M28 8H9v32h19" stroke="#fff2dd" strokeWidth="5" /><path d="M22 24h22m-8-8 8 8-8 8" stroke="#ffbd9f" strokeWidth="5" /></>}
  </svg>;
}
