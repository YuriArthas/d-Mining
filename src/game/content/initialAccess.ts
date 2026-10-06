import type {SessionContent} from '../application/SessionContent.ts';

// Current playable release opens the rebuilt underground layers at the surface.
// Access is content configuration, independent of the URL used to publish it.
const INITIALLY_UNLOCKED: readonly string[] = ['old_mine','fungal','crystal','ruins','frozen','volcanic','fossil','machinery','core'];
export function withInitialAccess(content:SessionContent):SessionContent {
  return {...content,initiallyUnlocked:[...new Set([
    ...(content.initiallyUnlocked ?? []), ...INITIALLY_UNLOCKED,
  ])]};
}
