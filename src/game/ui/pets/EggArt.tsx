import { EGG_DISPLAY_ROWS, petAppearance } from '../../content/petAppearance.ts';

const INK = '#13355d';
const EGG_COLORS = new Map<string, string>(EGG_DISPLAY_ROWS.flat().map(row => [row.eggId, row.color]));
/** Lighten (f > 0) or darken (f < 0) a hex colour, as the Blender egg atlas does for its body and spots. */
function shade(hex: string, f: number) {
  return '#' + [1, 3, 5].map(i => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f).toString(16).padStart(2, '0'); }).join('');
}
/** Egg on a gold stand, coloured like the egg on its stand in the world (a lighter body with darker spots);
 *  without an egg id, a cream egg spotted with the colour of `spotSpecies`. */
export function EggArt({ eggId, spotSpecies, locked = false, className = '' }: { eggId?: string; spotSpecies?: string; locked?: boolean; className?: string }) {
  // A locked egg is a black silhouette with a question mark, as it stands in the world.
  if (locked) return <svg className={className} viewBox="0 0 120 140" aria-hidden="true" focusable="false">
    <ellipse cx="60" cy="128" rx="44" ry="8" fill="#0b1d33" opacity=".3" />
    <path d="M22 112h76l-6 14H28Z" fill="#ffd447" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    <path d="M60 8C34 8 20 50 20 76c0 24 18 38 40 38s40-14 40-38C100 50 86 8 60 8Z" fill="#0b0c12" stroke={INK} strokeWidth="5" />
    <text x="60" y="88" textAnchor="middle" fontSize="54" fontWeight="900" fill="#ffffff" opacity=".85">?</text>
  </svg>;
  const color = eggId ? EGG_COLORS.get(eggId) : undefined;
  const body = color ? shade(color, .16) : '#fff3d6';
  const spot = color ? shade(color, -.32) : spotSpecies ? petAppearance(spotSpecies).color : '#8fd36e';
  return <svg className={className} viewBox="0 0 120 140" aria-hidden="true" focusable="false">
    <ellipse cx="60" cy="128" rx="44" ry="8" fill="#0b1d33" opacity=".3" />
    <path d="M22 112h76l-6 14H28Z" fill="#ffd447" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    <path d="M60 8C34 8 20 50 20 76c0 24 18 38 40 38s40-14 40-38C100 50 86 8 60 8Z" fill={body} stroke={INK} strokeWidth="5" />
    <circle cx="44" cy="52" r="8" fill={spot} /><circle cx="74" cy="40" r="6" fill={spot} /><circle cx="78" cy="78" r="10" fill={spot} /><circle cx="46" cy="90" r="6" fill={spot} />
    <path d="M38 30c4-8 9-12 15-14" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".8" />
  </svg>;
}
