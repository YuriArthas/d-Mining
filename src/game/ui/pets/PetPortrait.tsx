import type { CSSProperties } from 'react';
import { petAppearance } from '../../content/petAppearance.ts';

// The same authored color and label as the world sphere, without a WebGL canvas per card.
export function PetPortrait({ speciesId }: { speciesId: string }) {
  const look = petAppearance(speciesId);
  return <span className="pet-portrait" aria-hidden="true" style={{ '--pet-color': look.color } as CSSProperties}>{look.label}</span>;
}
