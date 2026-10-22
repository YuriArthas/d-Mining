import type { ReactNode } from 'react';
import { petAppearance } from '../../content/petAppearance.ts';
import type { PetRarity } from '../../logic/pets/types.ts';

/** Cube-pet portraits drawn from the species' colour and animal. Interim art until the
 *  Blender pet models render their own icons; the archetypes double as the model brief. */
type Kind = 'slime' | 'mole' | 'rabbit' | 'fox' | 'cat' | 'owl' | 'bird' | 'phoenix' | 'bug' | 'bee' | 'butterfly' | 'deer'
  | 'bear' | 'turtle' | 'whale' | 'fish' | 'crab' | 'frog' | 'lion' | 'bull' | 'bat' | 'lizard' | 'beast' | 'dragon';
const KIND_BY_LABEL: Readonly<Record<string, Kind>> = {
  鼠: 'mole', 砂鼠: 'mole', 兔: 'rabbit', 狐: 'fox', 猫: 'cat', 鹰: 'owl', 枭: 'owl', 鸟: 'bird', 雀: 'bird', 鹤: 'bird', 凰: 'phoenix',
  虫: 'bug', 蜂: 'bee', 蝶: 'butterfly', 鹿: 'deer', 熊: 'bear', 龟: 'turtle', 鲸: 'whale', 鱼: 'fish', 蟹: 'crab', 蛙: 'frog',
  狮: 'lion', 牛: 'bull', 蝠: 'bat', 蜥: 'lizard', 兽: 'beast', 龙: 'dragon',
};
export const petKind = (label: string): Kind => label.endsWith('团') ? 'slime' : KIND_BY_LABEL[label] ?? 'beast';

const INK = '#13355d';
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16), target = amount < 0 ? 0 : 255, t = Math.abs(amount);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (target - v) * t).toString(16).padStart(2, '0')).join('');
}
const line = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const thin = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Eyes({ y = 54, r = 9, gap = 13 }: { y?: number; r?: number; gap?: number }) {
  return <>{[50 - gap, 50 + gap].map(x => <g key={x}>
    <ellipse cx={x} cy={y} rx={r - 1} ry={r} fill="#fff" stroke={INK} strokeWidth="3" />
    <ellipse cx={x + 1.5} cy={y + 2} rx={r * .56} ry={r * .64} fill="#1d2635" />
    <circle cx={x + 3.5} cy={y - 1.5} r={r * .25} fill="#fff" />
  </g>)}</>;
}
const Cheeks = () => <><ellipse cx="25" cy="67" rx="5" ry="3" fill="#ff7fa8" opacity=".75" /><ellipse cx="75" cy="67" rx="5" ry="3" fill="#ff7fa8" opacity=".75" /></>;
const Smile = () => <path d="M45 68q2.5 3 5 0q2.5 3 5 0" fill="none" {...thin} />;
const Cube = ({ c }: { c: string }) => <>
  <rect x="17" y="28" width="66" height="60" rx="17" fill={c} {...line} />
  <path d="M21 73h58v1a12 12 0 0 1-12 12H33a12 12 0 0 1-12-12Z" fill={shade(c, -.28)} opacity=".6" />
  <path d="M27 37h18" stroke={shade(c, .45)} strokeWidth="5" strokeLinecap="round" />
</>;

type Parts = { back?: ReactNode; body?: ReactNode; front?: ReactNode; eyes?: ReactNode; mouth?: ReactNode | null };
const PARTS: Record<Kind, (c: string) => Parts> = {
  slime: c => ({ body: <>
    <path d="M18 78c0-30 12-50 32-50s32 20 32 50c0 8-6 10-12 10H30c-6 0-12-2-12-10Z" fill={c} {...line} />
    <path d="M50 28c2-7 8-10 13-9-2 5-6 8-13 9Z" fill={c} {...line} />
    <path d="M30 44c3-6 8-9 13-10" stroke={shade(c, .5)} strokeWidth="5" strokeLinecap="round" fill="none" />
  </> }),
  mole: c => ({ back: <><circle cx="24" cy="31" r="9" fill={shade(c, -.15)} {...line} /><circle cx="76" cy="31" r="9" fill={shade(c, -.15)} {...line} /></>,
    front: <ellipse cx="50" cy="66" rx="7" ry="5" fill="#ff9db8" {...thin} /> }),
  rabbit: c => ({ back: <>
    <rect x="25" y="2" width="15" height="36" rx="7.5" fill={c} {...line} /><rect x="60" y="2" width="15" height="36" rx="7.5" fill={c} {...line} />
    <rect x="29.5" y="8" width="6" height="22" rx="3" fill="#ffc6d6" /><rect x="64.5" y="8" width="6" height="22" rx="3" fill="#ffc6d6" />
  </>, front: <path d="m46 64 4 4 4-4Z" fill="#ff8fb0" {...thin} /> }),
  fox: c => ({ back: <><path d="M20 38 26 10l20 20Z" fill={c} {...line} /><path d="M80 38 74 10 54 30Z" fill={c} {...line} /><path d="m25 30 3-12 9 9Zm50 0-3-12-9 9Z" fill="#ffd9c0" /></>,
    front: <><path d="M30 70c4-9 12-11 20-11s16 2 20 11c-3 9-11 13-20 13s-17-4-20-13Z" fill="#fff7ea" {...thin} /><ellipse cx="50" cy="64" rx="4.5" ry="3.4" fill="#1d2635" /></> }),
  cat: c => ({ back: <><path d="M21 36 25 14l16 14Z" fill={c} {...line} /><path d="M79 36 75 14 59 28Z" fill={c} {...line} /><path d="m26 29 2-8 7 6Zm48 0-2-8-7 6Z" fill="#ffc6d6" /></>,
    front: <><path d="m47 63 3 3 3-3Z" fill="#ff8fb0" {...thin} /><path d="M20 62h12M20 68l12-2M80 62H68M80 68l-12-2" stroke={INK} strokeWidth="2" strokeLinecap="round" /></> }),
  owl: c => ({ back: <><path d="M18 40 22 14l16 16Z" fill={shade(c, -.15)} {...line} /><path d="M82 40 78 14 62 30Z" fill={shade(c, -.15)} {...line} /></>,
    front: <><circle cx="37" cy="54" r="13" fill={shade(c, .55)} /><circle cx="63" cy="54" r="13" fill={shade(c, .55)} /><path d="m44 66 6 9 6-9Z" fill="#ffb238" {...thin} /></>,
    eyes: <Eyes r={10} />, mouth: null }),
  bird: c => ({ back: <><path d="M44 30c-2-10 4-18 10-20-1 8 2 12 6 16Z" fill="#ff7a5a" {...line} /><path d="M17 60 6 52l6 20Z" fill={shade(c, -.2)} {...line} /><path d="m83 60 11-8-6 20Z" fill={shade(c, -.2)} {...line} /></>,
    front: <path d="m43 64 7 8 7-8Z" fill="#ffb238" {...thin} />, mouth: null }),
  phoenix: c => ({ back: <>
    <path d="M70 80c14 0 24 6 28 16-10-4-20-4-30-6Z" fill="#ffb238" {...line} />
    <path d="M34 30c-6-10-2-20 4-24 0 8 4 12 8 16Z" fill="#ff5a3c" {...line} /><path d="M46 28c-2-12 4-22 10-24-1 10 3 14 6 18Z" fill="#ffb238" {...line} /><path d="M58 30c2-10 8-16 14-16-3 7-4 12-6 18Z" fill="#ff5a3c" {...line} />
  </>, front: <path d="m43 64 7 8 7-8Z" fill="#ffd447" {...thin} />, mouth: null }),
  bug: c => ({ back: <><path d="M38 30C34 18 28 12 22 12M62 30c4-12 10-18 16-18" fill="none" {...line} /><circle cx="22" cy="12" r="4" fill={shade(c, .4)} {...thin} /><circle cx="78" cy="12" r="4" fill={shade(c, .4)} {...thin} /></>,
    front: <><circle cx="28" cy="78" r="4" fill={shade(c, -.35)} /><circle cx="72" cy="78" r="4" fill={shade(c, -.35)} /><circle cx="50" cy="82" r="3" fill={shade(c, -.35)} /></> }),
  bee: c => ({ back: <>
    <ellipse cx="22" cy="30" rx="12" ry="8" fill="#e8fbff" fillOpacity=".9" {...thin} transform="rotate(-30 22 30)" />
    <ellipse cx="78" cy="30" rx="12" ry="8" fill="#e8fbff" fillOpacity=".9" {...thin} transform="rotate(30 78 30)" />
    <path d="M42 30c-2-8-6-12-10-13M58 30c2-8 6-12 10-13" fill="none" {...thin} />
  </>, front: <><path d="M18 74h64M18 82h64" stroke="#3a2d1a" strokeWidth="5" /></> }),
  butterfly: c => ({ back: <>
    <path d="M18 50C4 34 4 16 14 12c10-4 18 10 22 24Z" fill={shade(c, .15)} {...line} /><path d="M82 50c14-16 14-34 4-38-10-4-18 10-22 24Z" fill={shade(c, .15)} {...line} />
    <circle cx="16" cy="26" r="5" fill="#fff" opacity=".8" /><circle cx="84" cy="26" r="5" fill="#fff" opacity=".8" />
    <path d="M42 29c-2-8-6-12-10-14M58 29c2-8 6-12 10-14" fill="none" {...thin} />
  </> }),
  deer: c => ({ back: <>
    <path d="M30 30 22 8M24 16l-8-2M26 22l-10 2M70 30l8-22M76 16l8-2M74 22l10 2" fill="none" stroke="#c9935a" strokeWidth="5" strokeLinecap="round" />
    <path d="M30 30 22 8M70 30l8-22" fill="none" stroke={INK} strokeWidth="1.5" />
    <ellipse cx="17" cy="42" rx="8" ry="5" fill={c} {...thin} /><ellipse cx="83" cy="42" rx="8" ry="5" fill={c} {...thin} />
  </>, front: <><ellipse cx="50" cy="69" rx="10" ry="7" fill={shade(c, .45)} {...thin} /><ellipse cx="50" cy="65" rx="4" ry="3" fill="#1d2635" /></>, mouth: null }),
  bear: c => ({ back: <><circle cx="24" cy="30" r="11" fill={c} {...line} /><circle cx="76" cy="30" r="11" fill={c} {...line} /><circle cx="24" cy="30" r="5" fill={shade(c, .45)} /><circle cx="76" cy="30" r="5" fill={shade(c, .45)} /></>,
    front: <><ellipse cx="50" cy="70" rx="13" ry="9" fill={shade(c, .5)} {...thin} /><ellipse cx="50" cy="66" rx="5" ry="3.6" fill="#1d2635" /></>, mouth: null }),
  turtle: c => ({ back: <><path d="M20 46c0-16 13-26 30-26s30 10 30 26Z" fill="#6fbf54" {...line} /><path d="M36 22l6 12h16l6-12M42 34l-9 10M58 34l9 10" fill="none" stroke={INK} strokeWidth="2.5" /></> }),
  whale: c => ({ back: <>
    <path d="M50 24c-4-8-10-10-14-8 4 2 6 6 8 10Zm0 0c4-8 10-10 14-8-4 2-6 6-8 10Z" fill="#9fe7ff" {...thin} />
    <path d="M80 70c8-4 14-12 14-20-6 2-10 6-12 10Z" fill={shade(c, -.15)} {...line} />
  </>, front: <path d="M24 72c8 10 44 10 52 0v4a12 12 0 0 1-12 12H36a12 12 0 0 1-12-12Z" fill="#eaf7ff" /> }),
  fish: c => ({ back: <>
    <path d="M40 30 50 12l10 18Z" fill={shade(c, -.2)} {...line} /><path d="M82 58 98 44v32Z" fill={shade(c, -.2)} {...line} />
    <path d="M18 62 6 70l12 6Z" fill={shade(c, -.2)} {...thin} />
  </>, front: <path d="M30 78q4-4 8 0M44 80q4-4 8 0M58 78q4-4 8 0" fill="none" stroke={shade(c, -.35)} strokeWidth="2.5" strokeLinecap="round" />, mouth: <ellipse cx="50" cy="69" rx="4" ry="3" fill="#ff8fb0" {...thin} /> }),
  crab: c => ({ back: <>
    <path d="M18 56C6 52 2 40 8 32l8 8 4-8c6 6 6 16-2 24Z" fill={shade(c, .1)} {...line} />
    <path d="M82 56c12-4 16-16 10-24l-8 8-4-8c-6 6-6 16 2 24Z" fill={shade(c, .1)} {...line} />
    <path d="M38 30V18M62 30V18" stroke={INK} strokeWidth="4" strokeLinecap="round" />
  </>, eyes: <Eyes y={18} r={8} gap={12} /> }),
  frog: c => ({ back: <><circle cx="34" cy="30" r="14" fill={c} {...line} /><circle cx="66" cy="30" r="14" fill={c} {...line} /></>,
    eyes: <Eyes y={29} r={9} gap={16} />, mouth: <path d="M32 66q18 12 36 0" fill="none" {...thin} /> }),
  lion: c => ({ back: <>
    <circle cx="50" cy="58" r="42" fill={shade(c, -.3)} {...line} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map(a => <circle key={a} cx={50 + Math.cos(a * Math.PI / 180) * 40} cy={58 + Math.sin(a * Math.PI / 180) * 40} r="8" fill={shade(c, -.3)} {...thin} />)}
  </>, front: <><ellipse cx="50" cy="70" rx="12" ry="8" fill={shade(c, .5)} {...thin} /><path d="m45 64 5 4 5-4Z" fill="#1d2635" /></>, mouth: null }),
  bull: c => ({ back: <><path d="M24 34C10 32 6 20 10 12c4 8 10 12 18 14Z" fill="#fff1d0" {...line} /><path d="M76 34c14-2 18-14 14-22-4 8-10 12-18 14Z" fill="#fff1d0" {...line} /></>,
    front: <><ellipse cx="50" cy="72" rx="16" ry="10" fill="#ffb3c4" {...thin} /><circle cx="44" cy="72" r="2.5" fill={INK} /><circle cx="56" cy="72" r="2.5" fill={INK} /></>, mouth: null }),
  bat: c => ({ back: <>
    <path d="M24 34 20 6l18 22Z" fill={c} {...line} /><path d="M76 34 80 6 62 28Z" fill={c} {...line} />
    <path d="M17 50C6 44 0 50 2 60c4-2 6 0 8 4 2-4 4-6 8-6Z" fill={shade(c, -.25)} {...line} /><path d="M83 50c11-6 17 0 15 10-4-2-6 0-8 4-2-4-4-6-8-6Z" fill={shade(c, -.25)} {...line} />
  </>, mouth: <><path d="M44 67q6 4 12 0" fill="none" {...thin} /><path d="m46 68 2 4 2-3m4 3 2-4" fill="#fff" stroke={INK} strokeWidth="1.5" /></> }),
  lizard: c => ({ back: <path d="M26 30 30 16l8 12 6-14 6 14 6-14 6 14 8-12 4 14Z" fill={shade(c, -.2)} {...line} />,
    front: <><circle cx="30" cy="76" r="4" fill={shade(c, .35)} /><circle cx="70" cy="78" r="5" fill={shade(c, .35)} /><circle cx="52" cy="82" r="3" fill={shade(c, .35)} /></> }),
  beast: c => ({ back: <><path d="M20 38 24 12l18 18Z" fill={c} {...line} /><path d="M80 38 76 12 58 30Z" fill={c} {...line} /><path d="M50 30 54 12 46 12Z" fill="#fff1d0" {...thin} /></>,
    front: <><path d="M34 70c4-7 10-9 16-9s12 2 16 9c-3 7-9 10-16 10s-13-3-16-10Z" fill={shade(c, .45)} {...thin} /><ellipse cx="50" cy="66" rx="4" ry="3" fill="#1d2635" /></>, mouth: null }),
  dragon: c => ({ back: <>
    <path d="M28 31 22 10l15 15Z" fill="#fff3c4" {...line} /><path d="M72 31l6-21-15 15Z" fill="#fff3c4" {...line} />
    <path d="M17 58 4 48l4 22Z" fill={shade(c, -.2)} {...line} /><path d="m83 58 13-10-4 22Z" fill={shade(c, -.2)} {...line} />
  </>, front: <><path d="M36 75c4-6 9-8 14-8s10 2 14 8c-3 7-8 10-14 10s-11-3-14-10Z" fill={shade(c, .5)} {...thin} /><circle cx="46" cy="69" r="1.6" fill={INK} /><circle cx="54" cy="69" r="1.6" fill={INK} /></>, mouth: null }),
};

const Crown = () => <path d="M34 26 30 10l10 8 10-12 10 12 10-8-4 16Z" fill="#ffd447" stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
const Sparkle = () => <path d="M86 18l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#fff6a8" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />;

export function PetArt({ speciesId, rarity, className = 'ui-cell-art' }: { speciesId: string; rarity?: PetRarity; className?: string }) {
  const look = petAppearance(speciesId), parts = PARTS[petKind(look.label)](look.color);
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <ellipse cx="50" cy="93" rx="28" ry="5" fill="#0b1d33" opacity=".3" />
    {parts.back}{parts.body ?? <Cube c={look.color} />}{parts.front}{parts.eyes ?? <Eyes />}<Cheeks />{parts.mouth === undefined ? <Smile /> : parts.mouth}
    {rarity === 'legendary' && <Crown />}{(rarity === 'epic' || rarity === 'legendary') && <Sparkle />}
  </svg>;
}
