import { petAppearance } from '../../content/petAppearance.ts';

const INK = '#13355d';
/** Egg on a gold stand, spotted with the colour of its rarest pet. */
export function EggArt({ spotSpecies, className = '' }: { spotSpecies?: string; className?: string }) {
  const spot = spotSpecies ? petAppearance(spotSpecies).color : '#8fd36e';
  return <svg className={className} viewBox="0 0 120 140" aria-hidden="true" focusable="false">
    <ellipse cx="60" cy="128" rx="44" ry="8" fill="#0b1d33" opacity=".3" />
    <path d="M22 112h76l-6 14H28Z" fill="#ffd447" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    <path d="M60 8C34 8 20 50 20 76c0 24 18 38 40 38s40-14 40-38C100 50 86 8 60 8Z" fill="#fff3d6" stroke={INK} strokeWidth="5" />
    <circle cx="44" cy="52" r="8" fill={spot} /><circle cx="74" cy="40" r="6" fill={spot} /><circle cx="78" cy="78" r="10" fill={spot} /><circle cx="46" cy="90" r="6" fill={spot} />
    <path d="M38 30c4-8 9-12 15-14" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".8" />
  </svg>;
}
