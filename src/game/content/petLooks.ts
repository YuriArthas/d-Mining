// Presentation only: how each pet looks. A rounded cube body in the species colour, a pattern from its egg,
// a cute face that says which animal it is, and sparkles for the higher tiers. Logic never imports this.
import type { PetRarity } from '../logic/pets/types.ts';
import { petAppearance } from './petAppearance.ts';
import { EGG_DEFINITIONS } from './pets.ts';

export const PET_FACES = ['slime', 'mole', 'rabbit', 'fox', 'cat', 'owl', 'bird', 'phoenix', 'bug', 'bee', 'butterfly', 'deer',
  'bear', 'turtle', 'whale', 'fish', 'crab', 'frog', 'lion', 'bull', 'bat', 'lizard', 'beast', 'dragon'] as const;
export type PetFace = (typeof PET_FACES)[number];
export const PET_PATTERNS = ['moss', 'stone', 'spots', 'facets', 'copper', 'runes', 'waves', 'frost', 'embers', 'cracks', 'bones', 'honey', 'rivets', 'sheen', 'stars', 'core'] as const;
export type PetPattern = (typeof PET_PATTERNS)[number];
const PET_SPARKLES = ['sparkle', 'leaf', 'ember', 'bubble', 'snow', 'star'] as const;
export type PetSparkle = (typeof PET_SPARKLES)[number];

export type PetLook = Readonly<{
  speciesId: string; color: string; face: PetFace; pattern: PetPattern; sparkle: PetSparkle; sparkleColor: string;
  rarity: PetRarity; eggId: string | null; stage: number; size: number; particles: boolean; glow: boolean;
}>;

const FACE_BY_LABEL: Readonly<Record<string, PetFace>> = {
  鼠: 'mole', 砂鼠: 'mole', 兔: 'rabbit', 狐: 'fox', 猫: 'cat', 鹰: 'owl', 枭: 'owl', 鸟: 'bird', 雀: 'bird', 鹤: 'bird', 凰: 'phoenix',
  虫: 'bug', 蜂: 'bee', 蝶: 'butterfly', 鹿: 'deer', 熊: 'bear', 龟: 'turtle', 鲸: 'whale', 鱼: 'fish', 蟹: 'crab', 蛙: 'frog',
  狮: 'lion', 牛: 'bull', 蝠: 'bat', 蜥: 'lizard', 兽: 'beast', 龙: 'dragon',
};
const petFace = (label: string): PetFace => label.endsWith('团') ? 'slime' : FACE_BY_LABEL[label] ?? 'beast';

/** Each egg's material and sparkle, so a whole egg reads as one family. */
const EGG_THEMES: Readonly<Record<string, Readonly<{ pattern: PetPattern; sparkle: PetSparkle; tint: string }>>> = {
  'meadow-egg': { pattern: 'moss', sparkle: 'leaf', tint: '#c4f59a' },
  'pebble-egg': { pattern: 'stone', sparkle: 'sparkle', tint: '#fff3d6' },
  'mushroom-egg': { pattern: 'spots', sparkle: 'sparkle', tint: '#ffc6f1' },
  'crystal-egg': { pattern: 'facets', sparkle: 'sparkle', tint: '#e6d8ff' },
  'copper-egg': { pattern: 'copper', sparkle: 'ember', tint: '#ffb873' },
  'ruin-egg': { pattern: 'runes', sparkle: 'sparkle', tint: '#ffe8a3' },
  'tide-egg': { pattern: 'waves', sparkle: 'bubble', tint: '#d4f8ff' },
  'frost-egg': { pattern: 'frost', sparkle: 'snow', tint: '#ffffff' },
  'fire-egg': { pattern: 'embers', sparkle: 'ember', tint: '#ffb43c' },
  'lava-egg': { pattern: 'cracks', sparkle: 'ember', tint: '#ff7c40' },
  'fossil-egg': { pattern: 'bones', sparkle: 'sparkle', tint: '#fff1dc' },
  'amber-egg': { pattern: 'honey', sparkle: 'sparkle', tint: '#ffdb72' },
  'gear-egg': { pattern: 'rivets', sparkle: 'sparkle', tint: '#d9f3ff' },
  'silver-egg': { pattern: 'sheen', sparkle: 'star', tint: '#ffffff' },
  'star-egg': { pattern: 'stars', sparkle: 'star', tint: '#fff5ad' },
  'core-egg': { pattern: 'core', sparkle: 'star', tint: '#ffe38e' },
  'cryo-egg': { pattern: 'frost', sparkle: 'snow', tint: '#e8fbff' },
  'probe-egg': { pattern: 'rivets', sparkle: 'sparkle', tint: '#ffd99a' },
  'nitro-egg': { pattern: 'waves', sparkle: 'snow', tint: '#dff8ff' },
  'fusion-egg': { pattern: 'core', sparkle: 'ember', tint: '#c6ff9a' },
  'orbit-egg': { pattern: 'rivets', sparkle: 'star', tint: '#cdd5ff' },
  'geode-egg': { pattern: 'facets', sparkle: 'sparkle', tint: '#efdcff' },
  'rune-egg': { pattern: 'runes', sparkle: 'star', tint: '#fff0b0' },
  'comet-egg': { pattern: 'frost', sparkle: 'star', tint: '#d8f6ff' },
  'meteor-egg': { pattern: 'embers', sparkle: 'ember', tint: '#ffc2a0' },
  'aurora-egg': { pattern: 'waves', sparkle: 'star', tint: '#bfffe9' },
  'nebula-egg': { pattern: 'stars', sparkle: 'star', tint: '#f1d4ff' },
  'galaxy-egg': { pattern: 'stars', sparkle: 'sparkle', tint: '#c8ccff' },
  'void-egg': { pattern: 'cracks', sparkle: 'star', tint: '#d6c6ff' },
};
const DEFAULT_THEME = { pattern: 'stone', sparkle: 'sparkle', tint: '#fff3d6' } as const;

const RARITY_ORDER: Readonly<Record<PetRarity, number>> = { common: 0, rare: 1, epic: 2, legendary: 3 };
const SIZE: Readonly<Record<PetRarity, number>> = { common: 0.7, rare: 0.76, epic: 0.84, legendary: 0.95 };
/** Early eggs keep sparkles for legendaries; mid eggs share them from epic; the last eggs from rare. `stage` is
 *  the egg's layer across the three worlds (0-20). */
export function sparkleFrom(stage: number): PetRarity { return stage <= 4 ? 'legendary' : stage <= 11 ? 'epic' : 'rare'; }

const EGG_OF = new Map(EGG_DEFINITIONS.flatMap(egg => egg.pets.map(([id]) => [id, egg] as const)));
const RARITY_OF = new Map(EGG_DEFINITIONS.flatMap(egg => egg.pets.map(([id, , rarity]) => [id, rarity] as const)));
const looks = new Map<string, PetLook>();

export function petLook(speciesId: string, rarityHint?: PetRarity): PetLook {
  const cached = looks.get(speciesId);
  if (cached) return cached;
  const appearance = petAppearance(speciesId), egg = EGG_OF.get(speciesId), eggId = egg?.id ?? null;
  const theme = (eggId && EGG_THEMES[eggId]) || DEFAULT_THEME, stage = egg ? (egg.world - 1) * 7 + egg.layer : 0;
  const rarity = RARITY_OF.get(speciesId) ?? rarityHint ?? 'common';
  const look: PetLook = Object.freeze({
    speciesId, color: appearance.color, face: petFace(appearance.label), pattern: theme.pattern, sparkle: theme.sparkle, sparkleColor: theme.tint,
    rarity, eggId, stage, size: SIZE[rarity],
    particles: RARITY_ORDER[rarity] >= RARITY_ORDER[sparkleFrom(stage)], glow: rarity === 'legendary',
  });
  looks.set(speciesId, look);
  return look;
}
