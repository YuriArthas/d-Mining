import type { AmbienceId } from './ambience.ts';
import type { AudioScene } from './GameAudio.ts';
import type { SongId } from './music/songs.ts';

/** Each layer theme's piece, its underground ambience and how much effects echo there. */
const THEMES: Readonly<Record<string, Readonly<{ song: SongId; ambience: AmbienceId; cave: number }>>> = {
  meadow_mine: { song: 'meadow', ambience: 'shallow', cave: 0.3 },
  timber_mine: { song: 'timber', ambience: 'timber', cave: 0.35 },
  mushroom_cave: { song: 'mushroom', ambience: 'mushroom', cave: 0.4 },
  crystal_cave: { song: 'crystal', ambience: 'crystal', cave: 0.55 },
  buried_ruins: { song: 'ruins', ambience: 'ruins', cave: 0.5 },
  frozen_cave: { song: 'ice', ambience: 'ice', cave: 0.5 },
  lava_cave: { song: 'lava', ambience: 'lava', cave: 0.35 },
  fossil_cave: { song: 'fossil', ambience: 'fossil', cave: 0.45 },
  ancient_machine: { song: 'machine', ambience: 'machine', cave: 0.4 },
  core_sanctum: { song: 'core', ambience: 'core', cave: 0.55 },
};

export type PlaceSound = Readonly<{
  /** Theme id of the layer around the feet. */
  theme: string;
  /** Daylight reaching the feet: 1 in the open, 0 a few blocks down (surfaceLightStrengthAtFeet). */
  surfaceLight: number;
}>;

/** Chooses what a place sounds like. Above ground (always daytime): the valley's wind and birds over the
 *  full tune. Down the first shaft the valley tune carries on muffled, as if heard
 *  from above; every deeper layer has its own piece and cave ambience. Stepping in and out of the
 *  daylight edge switches with some hysteresis so a jump at the rim does not flip it. */
export class Soundscape {
  private outdoors = true;

  scene({ theme, surfaceLight }: PlaceSound): AudioScene {
    if (this.outdoors && surfaceLight < 0.3) this.outdoors = false;
    else if (!this.outdoors && surfaceLight > 0.6) this.outdoors = true;
    const place = THEMES[theme] ?? THEMES.meadow_mine, valley = theme === 'meadow_mine';
    if (this.outdoors) return { song: place.song, rhythm: 1, lead: 1, muffle: 0, ambience: 'meadow', cave: 0 };
    if (valley) return { song: 'meadow', rhythm: 0, lead: 0.85, muffle: 1, ambience: 'shallow', cave: place.cave };
    return { song: place.song, rhythm: 1, lead: 1, muffle: 0, ambience: place.ambience, cave: place.cave };
  }
}
