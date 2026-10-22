import { useEffect, useRef } from 'react';
import { petLook } from '../../content/petLooks.ts';
import type { PetRarity } from '../../logic/pets/types.ts';
import { portraitCanvas } from '../../presentation/pets/petArt.ts';

const SIZE = 288;
/** The same rounded cube, pattern, cute face and sparkles as the pet in the world, drawn for the UI.
 *  Drawn after the panel renders, so opening a panel never waits on portraits. 288 px keeps the
 *  150 px hatch reveal sharp on a 2x screen; smaller cells scale it down. */
export function PetArt({ speciesId, rarity, className = 'ui-cell-art' }: { speciesId: string; rarity?: PetRarity; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, SIZE, SIZE);
    g.drawImage(portraitCanvas(petLook(speciesId, rarity), SIZE), 0, 0);
  }, [speciesId, rarity]);
  return <canvas ref={ref} className={className} width={SIZE} height={SIZE} data-species={speciesId} aria-hidden="true" />;
}
