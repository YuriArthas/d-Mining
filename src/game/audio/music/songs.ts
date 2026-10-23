import type { SongSpec, TrackSpec } from './score.ts';

/** One piece per layer theme. Each pass is intro, A, B, A again and an outro (about a minute and a
 *  half), then a rest; passes alternate the lead instrument so the loop does not wear thin.
 *  Track levels are relative to the instrument's own level (see instruments.ts). */
const MAIN = ['A', 'B', 'A2'] as const;
const BODY = ['A', 'B', 'A2', 'outro'] as const;
const ALL = ['intro', 'A', 'B', 'A2', 'outro'] as const;
const FORM = ['intro', 'A', 'B', 'A2', 'outro'] as const;

type Melody = Extract<TrackSpec, { kind: 'melody' }>;
const lead = (instrument: Melody['instrument'], parts: Melody['parts'], extra: Partial<Pick<Melody, 'level' | 'pan' | 'reverb' | 'shift'>> = {}): Melody =>
  ({ name: 'lead', kind: 'melody', layer: 'lead', instrument, steps: 8, parts, pan: 0.08, reverb: 0.28, ...extra });

export const SONGS: readonly SongSpec[] = [
  {
    id: 'meadow', title: '松风晨光', bpm: 100, gain: 0.87, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'Fmaj7 | Bb/F' },
      A: { bars: 8, chords: 'F | C/E | Dm | Bb | F | C | Bb | C' },
      B: { bars: 8, chords: 'Bb | C | Am7 | Dm | Gm7 | C | F/A,Bb | Csus4,C' },
      A2: { bars: 8, chords: 'F | C/E | Dm | Bb | F | C | Bb,C | F' },
      outro: { bars: 4, chords: 'Bb | C | F | F' },
    },
    tracks: [
      lead(['marimba', 'ocarina'], {
        A: 'C5 . F5 . A5 - G5 F5 | G5 - - . C5 . E5 . | D5 . F5 . D5 - C5 A4 | Bb4 - - . C5 . D5 . | C5 . F5 . A5 - Bb5 A5 | G5 - F5 . E5 . C5 . | D5 . Bb4 . D5 . F5 . | E5 - - - G5 - - .',
        B: 'F5 - D5 . F5 . Bb5 . | A5 - G5 . E5 . C5 . | E5 - - . G5 . A5 . | F5 - - - D5 - - . | Bb5 - - . A5 . G5 . | G5 - E5 . C5 . E5 . | A5 - F5 . Bb5 - D5 . | F5 - - . E5 - - .',
        A2: 'C5 . F5 . A5 - G5 F5 | G5 - - . C5 . E5 . | D5 . F5 . D5 - C5 A4 | Bb4 - - . C5 . D5 . | C5 . F5 . A5 - Bb5 A5 | G5 - F5 . E5 . C5 . | D5 . Bb4 . E5 . G5 . | F5 - - - - - . .',
        outro: 'D5 - - . F5 - - . | E5 - - . G5 - - . | F5 - - - A5 - - - | - - - - - - . .',
      }),
      { name: 'chime', kind: 'arp', layer: 'lead', instrument: 'celesta', steps: 8, pattern: '5 . . . . . 4 .', low: 60, level: 0.45, pan: -0.3, reverb: 0.4, sections: ['B', 'A2'] },
      { name: 'guitar', kind: 'arp', layer: 'core', instrument: 'pluck', steps: 8, pattern: '0 2 1 2 0 2 1 2', low: 55, level: 0.7, pan: -0.22, reverb: 0.22, sections: ALL },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'bass', steps: 8, pattern: 'R - - . 5 - R .', low: 36, level: 0.6, sections: BODY },
      { name: 'pad', kind: 'pad', layer: 'core', instrument: 'pad', low: 60, level: 0.55, reverb: 0.4, sections: ALL },
      { name: 'kick', kind: 'drum', layer: 'rhythm', instrument: 'kick', steps: 16, pattern: 'x.......x.......', level: 0.65, sections: MAIN },
      { name: 'clap', kind: 'drum', layer: 'rhythm', instrument: 'clap', steps: 16, pattern: '....x.......x...', level: 0.5, pan: 0.1, reverb: 0.15, sections: MAIN },
      { name: 'shaker', kind: 'drum', layer: 'rhythm', instrument: 'shaker', steps: 16, pattern: '..x...x...x...x.', level: 0.6, pan: 0.25, sections: MAIN },
    ],
  },
  {
    id: 'timber', title: '矿灯小调', bpm: 92, gain: 0.99, swing: 0.6, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'Dm | Dm' },
      A: { bars: 8, chords: 'Dm | C | Dm | Am | Dm | C | Bb | A' },
      B: { bars: 8, chords: 'F | C | G | Dm | Bb | F | Gm | A' },
      A2: { bars: 8, chords: 'Dm | C | Dm | Am | Dm | C | Bb,A | Dm' },
      outro: { bars: 4, chords: 'Dm | C | Dm | Dm' },
    },
    tracks: [
      lead(['whistle', 'marimba'], {
        A: 'D5 . D5 F5 E5 . D5 . | C5 . E5 . G5 - - . | F5 . F5 A5 G5 . F5 . | E5 - - . C5 . A4 . | D5 . D5 F5 E5 . D5 . | C5 . E5 . G5 . A5 . | F5 . D5 . Bb4 . D5 . | C#5 - - - E5 - - .',
        B: 'A5 - - . G5 . F5 . | E5 - - . D5 . C5 . | D5 - B4 . D5 . G5 . | F5 - - - A4 - - . | F5 - - . E5 . D5 . | C5 - - . A4 . C5 . | D5 . Bb4 . G4 . Bb4 . | A4 - - - C#5 - E5 .',
        A2: 'D5 . D5 F5 E5 . D5 . | C5 . E5 . G5 - - . | F5 . F5 A5 G5 . F5 . | E5 - - . C5 . A4 . | D5 . D5 F5 E5 . D5 . | C5 . E5 . G5 . A5 . | F5 . D5 . C#5 . E5 . | D5 - - - - - . .',
        outro: 'A4 - - . D5 - - . | E5 - - . C5 - - . | D5 - - - - - - - | - - - - - - . .',
      }),
      { name: 'banjo', kind: 'arp', layer: 'core', instrument: 'banjo', steps: 8, pattern: '0 2 1 3 0 2 1 3', low: 55, level: 0.62, pan: -0.25, reverb: 0.18, sections: ALL },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'pluckBass', steps: 8, pattern: 'R . . . 5 . . .', low: 36, level: 0.9, sections: BODY },
      { name: 'pad', kind: 'pad', layer: 'core', instrument: 'pad', low: 57, level: 0.4, reverb: 0.4, sections: BODY },
      { name: 'kick', kind: 'drum', layer: 'rhythm', instrument: 'kick', steps: 16, pattern: 'x.......x.......', level: 0.55, sections: MAIN },
      { name: 'block', kind: 'drum', layer: 'rhythm', instrument: 'woodblock', steps: 16, pattern: '..x...x...x...x.', level: 0.5, pan: 0.3, reverb: 0.2, sections: MAIN },
      { name: 'rim', kind: 'drum', layer: 'rhythm', instrument: 'rim', steps: 16, pattern: '....o.......x...', level: 0.6, pan: -0.1, sections: MAIN },
    ],
  },
  {
    id: 'mushroom', title: '孢子微光', bpm: 96, gain: 0.97, swing: 0.58, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'Am | D' },
      A: { bars: 8, chords: 'Am | D | Am | D | F | G | Em | Am' },
      B: { bars: 8, chords: 'F | G | Am | Am | F | G | E | E' },
      A2: { bars: 8, chords: 'Am | D | Am | D | F | G | Em | Am' },
      outro: { bars: 4, chords: 'Am | D | Am | Am' },
    },
    tracks: [
      lead(['kalimba', 'marimba'], {
        A: 'A4 C5 E5 . A5 . G5 . | F#5 . D5 . A4 . . . | A4 C5 E5 . A5 . B5 . | A5 . F#5 . D5 . . . | C5 . F5 . A5 . G5 F5 | D5 . G5 . B5 . A5 G5 | E5 . G5 . B4 . E5 . | A4 - - - . . . .',
        B: 'A5 - G5 . F5 . E5 . | D5 - - . B4 . D5 . | C5 . E5 . A5 . E5 . | C5 - - - . . . . | A5 - G5 . F5 . A5 . | B5 - A5 . G5 . B5 . | G#5 - - . E5 . B4 . | G#4 - - - B4 - - .',
        A2: 'A4 C5 E5 . A5 . G5 . | F#5 . D5 . A4 . . . | A4 C5 E5 . A5 . B5 . | A5 . F#5 . D5 . . . | C5 . F5 . A5 . G5 F5 | D5 . G5 . B5 . A5 G5 | E5 . G5 . B4 . E5 . | A4 - - - . . . .',
        outro: 'E5 - - . A4 - - . | F#5 - - . D5 - - . | E5 - - - C5 - - - | A4 - - - - - . .',
      }),
      { name: 'pizz', kind: 'arp', layer: 'core', instrument: 'pizz', steps: 8, pattern: '0 2 1 2 0 2 1 2', low: 57, level: 0.6, pan: -0.25, reverb: 0.25, sections: ALL },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'pluckBass', steps: 8, pattern: 'R . 5 . R . 5 .', low: 36, level: 0.8, sections: BODY },
      { name: 'pad', kind: 'pad', layer: 'core', instrument: 'glass', low: 64, level: 0.6, reverb: 0.5, sections: ALL },
      { name: 'kick', kind: 'drum', layer: 'rhythm', instrument: 'kick', steps: 16, pattern: 'x.......x.......', level: 0.45, sections: MAIN },
      { name: 'block', kind: 'drum', layer: 'rhythm', instrument: 'woodblock', steps: 16, pattern: '....x.......x...', level: 0.45, pan: 0.25, reverb: 0.25, sections: MAIN },
      { name: 'shaker', kind: 'drum', layer: 'rhythm', instrument: 'shaker', steps: 16, pattern: '..o...o...o...o.', level: 0.7, pan: -0.2, sections: MAIN },
      { name: 'bubble', kind: 'drum', layer: 'rhythm', instrument: 'bubble', steps: 16, pattern: '..........x.....', level: 0.8, pan: 0.35, reverb: 0.5, sections: ['B', 'A2'] },
    ],
  },
  {
    id: 'crystal', title: '棱镜深穴', bpm: 76, gain: 1.26, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'Emaj7 | Emaj7' },
      A: { bars: 8, chords: 'Emaj7 | F#/E | C#m7 | Amaj7 | Emaj7 | F#/E | G#m7 | Amaj7' },
      B: { bars: 8, chords: 'Amaj7 | B | G#m7 | C#m7 | Amaj7 | B | F#m7 | Bsus4,B' },
      A2: { bars: 8, chords: 'Emaj7 | F#/E | C#m7 | Amaj7 | Emaj7 | F#/E | G#m7 | Amaj7' },
      outro: { bars: 4, chords: 'Amaj7 | B | Emaj7 | Emaj7' },
    },
    tracks: [
      lead(['bell', 'musicBox'], {
        A: 'B5 - - - G#5 - - - | A#5 - - - F#5 - - - | G#5 - - - E5 - - - | C#6 - - - B5 - - - | B5 - - - D#6 - - - | C#6 - - - A#5 - - - | B5 - - - D#6 - C#6 - | C#6 - - - - - - -',
        B: 'E6 - - - C#6 - - - | D#6 - - - B5 - - - | D#6 - C#6 - B5 - - - | G#5 - - - - - - - | E6 - - - C#6 - E6 - | F#6 - - - D#6 - - - | C#6 - - - A5 - - - | E6 - - - D#6 - - -',
        A2: 'B5 - - - G#5 - - - | A#5 - - - F#5 - - - | G#5 - - - E5 - - - | C#6 - - - B5 - - - | B5 - - - D#6 - - - | C#6 - - - A#5 - - - | B5 - - - D#6 - C#6 - | C#6 - - - - - - -',
        outro: 'C#6 - - - E6 - - - | D#6 - - - F#6 - - - | G#6 - - - - - - - | - - - - - - . .',
      }, { reverb: 0.45 }),
      { name: 'sparkle', kind: 'arp', layer: 'core', instrument: 'celesta', steps: 16, pattern: '0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1', low: 64, level: 0.32, pan: -0.3, reverb: 0.5, sections: MAIN },
      { name: 'harp', kind: 'arp', layer: 'core', instrument: 'harp', steps: 8, pattern: '0 1 2 3 4 3 2 1', low: 52, level: 0.55, pan: 0.25, reverb: 0.45, sections: ['intro', 'outro'] },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'pluckBass', steps: 8, pattern: 'R - - - 5 - - -', low: 36, level: 0.45, sections: BODY },
      { name: 'pad', kind: 'pad', layer: 'core', instrument: 'glass', low: 64, level: 0.75, reverb: 0.55, sections: ALL },
      { name: 'triangle', kind: 'drum', layer: 'rhythm', instrument: 'triangle', steps: 16, pattern: 'x...............', level: 0.7, pan: 0.3, reverb: 0.5, sections: ['B'] },
      { name: 'shaker', kind: 'drum', layer: 'rhythm', instrument: 'shaker', steps: 16, pattern: '..o...o...o...o.', level: 0.5, pan: -0.2, sections: ['B', 'A2'] },
    ],
  },
  {
    id: 'ruins', title: '砂岩回声', bpm: 84, gain: 0.7, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'E | F' },
      A: { bars: 8, chords: 'E | F | E | F | Dm | E | F | E' },
      B: { bars: 8, chords: 'Am | G | F | E | Am | G | F | E' },
      A2: { bars: 8, chords: 'E | F | E | F | Dm | E | F | E' },
      outro: { bars: 4, chords: 'F | E | F | E' },
    },
    tracks: [
      lead(['flute', 'marimba'], {
        A: 'E5 - F5 E5 G#5 - - . | A5 - G#5 . F5 - - . | E5 - F5 E5 G#5 . B5 . | A5 . C6 . B5 - A5 . | F5 - E5 . D5 . F5 . | E5 - - . G#5 . B5 . | A5 - G#5 . F5 . A5 . | G#5 - - - E5 - - .',
        B: 'C6 - B5 . A5 - - . | B5 - A5 . G5 - - . | A5 - G5 . F5 - - . | G#5 - - - - - . . | E5 . A5 . C6 . B5 A5 | D5 . G5 . B5 . A5 G5 | C5 . F5 . A5 . G#5 F5 | E5 - - - - - . .',
        A2: 'E5 - F5 E5 G#5 - - . | A5 - G#5 . F5 - - . | E5 - F5 E5 G#5 . B5 . | A5 . C6 . B5 - A5 . | F5 - E5 . D5 . F5 . | E5 - - . G#5 . B5 . | A5 - G#5 . F5 . A5 . | G#5 - - - E5 - - .',
        outro: 'A5 - - - G#5 - - - | E5 - - - - - - - | F5 - - - A5 - - - | G#5 - - - E5 - - .',
      }, { reverb: 0.38 }),
      { name: 'harp', kind: 'arp', layer: 'core', instrument: 'harp', steps: 8, pattern: '0 1 2 1 3 1 2 1', low: 52, level: 0.55, pan: -0.25, reverb: 0.35, sections: ALL },
      { name: 'drone', kind: 'bass', layer: 'core', instrument: 'drone', steps: 8, pattern: 'R - - - - - - -', low: 40, level: 0.55, reverb: 0.3, sections: ALL },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'pluckBass', steps: 8, pattern: 'R . . R . . R .', low: 36, level: 0.75, sections: BODY },
      { name: 'dum', kind: 'drum', layer: 'rhythm', instrument: 'frameDum', steps: 16, pattern: 'x.......x.......', level: 0.65, reverb: 0.2, sections: MAIN },
      { name: 'tek', kind: 'drum', layer: 'rhythm', instrument: 'frameTek', steps: 16, pattern: '..x...x.....x...', level: 0.5, pan: 0.25, reverb: 0.25, sections: MAIN },
    ],
  },
  {
    id: 'ice', title: '霜光', bpm: 66, gain: 1.19, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'Bm | G' },
      A: { bars: 8, chords: 'Bm | G | D | A | Bm | Em | F#sus4 | F#' },
      B: { bars: 8, chords: 'G | A | F#m | Bm | G | Em | F#sus4 | F#' },
      A2: { bars: 8, chords: 'Bm | G | D | A | Bm | Em | F#sus4,F# | Bm' },
      outro: { bars: 4, chords: 'G | A | Bm | Bm' },
    },
    tracks: [
      lead(['musicBox', 'celesta'], {
        A: 'F#5 - - . D5 - B4 . | D5 - - . B4 - G4 . | A4 - - . D5 - F#5 . | E5 - - - - - . . | F#5 - - . B5 - A5 . | G5 - - . E5 - B4 . | B4 - - . C#5 - - . | A#4 - - - - - . .',
        B: 'B5 - - . A5 - G5 . | A5 - - . E5 - C#5 . | C#5 - - . F#5 - A5 . | F#5 - - - - - . . | G5 - - . F#5 - D5 . | E5 - - . G5 - B5 . | C#6 - - . B5 - - . | A#5 - - - F#5 - - .',
        A2: 'F#5 - - . D5 - B4 . | D5 - - . B4 - G4 . | A4 - - . D5 - F#5 . | E5 - - - - - . . | F#5 - - . B5 - A5 . | G5 - - . E5 - B4 . | B4 - C#5 . A#4 - C#5 . | B4 - - - - - . .',
        outro: 'D5 - - . B4 - - . | C#5 - - . E5 - - . | F#5 - - - - - - - | - - - - - - . .',
      }, { reverb: 0.5 }),
      { name: 'harp', kind: 'arp', layer: 'core', instrument: 'harp', steps: 8, pattern: '0 . 2 . 4 . 2 .', low: 59, level: 0.45, pan: -0.25, reverb: 0.5, sections: ALL },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'pluckBass', steps: 8, pattern: 'R - - - - - - -', low: 35, level: 0.45, sections: BODY },
      { name: 'pad', kind: 'pad', layer: 'core', instrument: 'glass', low: 62, level: 0.8, reverb: 0.6, sections: ALL },
    ],
  },
  {
    id: 'lava', title: '熔岩脉动', bpm: 108, gain: 0.94, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'Cm | Cm' },
      A: { bars: 8, chords: 'Cm | Cm | Ab | Bb | Cm | Cm | Ab | G' },
      B: { bars: 8, chords: 'Fm | Cm | Ab | Bb | Fm | Cm | Db | G' },
      A2: { bars: 8, chords: 'Cm | Cm | Ab | Bb | Cm | Cm | Ab | G' },
      outro: { bars: 4, chords: 'Ab | G | Cm | Cm' },
    },
    tracks: [
      lead(['marimba', 'softLead'], {
        A: 'G4 . C5 . Eb5 . D5 C5 | D5 . Eb5 . G5 - - . | Ab5 . G5 . Eb5 . C5 . | D5 - - . F5 - - . | G4 . C5 . Eb5 . D5 C5 | D5 . Eb5 . G5 . Bb5 . | C6 . Bb5 . Ab5 . Eb5 . | D5 - - - B4 - - .',
        B: 'Ab5 - - . G5 . F5 . | G5 - - . Eb5 . C5 . | Eb5 - C5 . Ab4 . C5 . | D5 - - - F5 - - . | C6 - - . Ab5 . F5 . | G5 - - . Eb5 . G5 . | F5 - - . Ab5 . Db6 . | B5 - - - D6 - - .',
        A2: 'G4 . C5 . Eb5 . D5 C5 | D5 . Eb5 . G5 - - . | Ab5 . G5 . Eb5 . C5 . | D5 - - . F5 - - . | G4 . C5 . Eb5 . D5 C5 | D5 . Eb5 . G5 . Bb5 . | C6 . Bb5 . Ab5 . Eb5 . | D5 - - - B4 - - .',
        outro: 'C6 - - . Ab5 - Eb5 . | D5 - - . B4 - D5 . | C5 - - - - - - - | - - - - - - . .',
      }),
      { name: 'pluck', kind: 'arp', layer: 'core', instrument: 'pluck', steps: 8, pattern: '0 . 0 2 . 0 1 .', low: 48, level: 0.6, pan: -0.25, reverb: 0.2, sections: ALL },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'synthBass', steps: 8, pattern: 'R R 8 R R R 8 R', low: 36, level: 0.75, sections: BODY },
      { name: 'brass', kind: 'pad', layer: 'core', instrument: 'brass', low: 55, level: 0.55, pan: 0.15, reverb: 0.3, sections: ['B', 'outro'] },
      { name: 'pad', kind: 'pad', layer: 'core', instrument: 'pad', low: 55, level: 0.45, reverb: 0.35, sections: ['intro', 'A', 'A2'] },
      { name: 'kick', kind: 'drum', layer: 'rhythm', instrument: 'kick', steps: 16, pattern: 'x.....x...x.....', level: 0.65, sections: MAIN },
      { name: 'snare', kind: 'drum', layer: 'rhythm', instrument: 'snare', steps: 16, pattern: '....x.......x...', level: 0.5, reverb: 0.15, sections: MAIN },
      { name: 'tom', kind: 'drum', layer: 'rhythm', instrument: 'tomLow', steps: 16, pattern: '..............x.', level: 0.55, pan: -0.15, sections: MAIN },
      { name: 'hat', kind: 'drum', layer: 'rhythm', instrument: 'hat', steps: 16, pattern: 'o.x.o.x.o.x.o.x.', level: 0.55, pan: 0.25, sections: MAIN },
    ],
  },
  {
    id: 'fossil', title: '远古骨语', bpm: 80, gain: 0.77, swing: 0.56, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'Gm | C' },
      A: { bars: 8, chords: 'Gm | C | Gm | C | Eb | F | Gm | Gm' },
      B: { bars: 8, chords: 'Eb | F | Dm | Gm | Eb | F | Cm | D' },
      A2: { bars: 8, chords: 'Gm | C | Gm | C | Eb | F | Gm | Gm' },
      outro: { bars: 4, chords: 'Eb | F | Gm | Gm' },
    },
    tracks: [
      lead(['flute', 'kalimba'], {
        A: 'G4 - Bb4 . D5 - C5 . | E5 - - . D5 . C5 . | Bb4 - D5 . G5 - F5 . | E5 - - - C5 - - . | Bb4 - Eb5 . G5 - F5 . | F5 - - . C5 . A4 . | Bb4 - A4 . G4 - D5 . | G4 - - - - - . .',
        B: 'G5 - - . Bb5 . G5 . | A5 - - . F5 . C5 . | D5 - F5 . A5 - G5 . | G5 - - - D5 - - . | Eb5 - G5 . Bb5 - G5 . | F5 - A5 . C6 - A5 . | G5 - Eb5 . C5 - Eb5 . | F#5 - - - A5 - - .',
        A2: 'G4 - Bb4 . D5 - C5 . | E5 - - . D5 . C5 . | Bb4 - D5 . G5 - F5 . | E5 - - - C5 - - . | Bb4 - Eb5 . G5 - F5 . | F5 - - . C5 . A4 . | Bb4 - A4 . G4 - D5 . | G4 - - - - - . .',
        outro: 'G5 - - . Eb5 - - . | F5 - - . C5 - - . | D5 - - - Bb4 - - - | G4 - - - - - . .',
      }, { reverb: 0.35 }),
      { name: 'logs', kind: 'arp', layer: 'core', instrument: 'marimba', steps: 8, pattern: '0 . 0 1 . 0 2 .', low: 45, level: 0.6, pan: -0.2, reverb: 0.2, sections: ALL },
      { name: 'drone', kind: 'bass', layer: 'core', instrument: 'drone', steps: 8, pattern: 'R - - - - - - -', low: 31, level: 0.6, reverb: 0.25, sections: ALL },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'pluckBass', steps: 8, pattern: 'R . . . . . 5 .', low: 36, level: 0.6, sections: BODY },
      { name: 'dum', kind: 'drum', layer: 'rhythm', instrument: 'frameDum', steps: 16, pattern: 'x.......x..x....', level: 0.6, reverb: 0.2, sections: MAIN },
      { name: 'tek', kind: 'drum', layer: 'rhythm', instrument: 'frameTek', steps: 16, pattern: '....x.......x...', level: 0.4, pan: 0.2, sections: MAIN },
      { name: 'shaker', kind: 'drum', layer: 'rhythm', instrument: 'shaker', steps: 16, pattern: 'o.x.o.x.o.x.o.x.', level: 0.55, pan: -0.25, sections: MAIN },
    ],
  },
  {
    id: 'machine', title: '齿轮深处', bpm: 104, gain: 1.22, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'Am | Am' },
      A: { bars: 8, chords: 'Am | F | C | G | Am | F | Dm | E' },
      B: { bars: 8, chords: 'F | G | Em | Am | F | G | E | E' },
      A2: { bars: 8, chords: 'Am | F | C | G | Am | F | Dm | E' },
      outro: { bars: 4, chords: 'F | E | Am | Am' },
    },
    tracks: [
      lead(['bell', 'softLead'], {
        A: 'A4 . C5 . E5 . A5 . | G5 - F5 . C5 - - . | E5 . G5 . C6 . B5 . | D6 - B5 . G5 - - . | A5 . G5 . E5 . C5 . | F5 . A5 . C6 . A5 . | F5 - E5 . D5 - A4 . | G#4 - - - B4 - - .',
        B: 'C6 - - . A5 - F5 . | D6 - - . B5 - G5 . | B5 - G5 . E5 - G5 . | A5 - - - E5 - - . | A5 - C6 . F6 - C6 . | B5 - D6 . G6 - D6 . | E6 - D6 . B5 - G#5 . | E5 - - - - - . .',
        A2: 'A4 . C5 . E5 . A5 . | G5 - F5 . C5 - - . | E5 . G5 . C6 . B5 . | D6 - B5 . G5 - - . | A5 . G5 . E5 . C5 . | F5 . A5 . C6 . A5 . | F5 - E5 . D5 - A4 . | G#4 - - - B4 - - .',
        outro: 'C6 - - . A5 - F5 . | G#5 - - . B5 - E5 . | A5 - - - - - - - | - - - - - - . .',
      }, { reverb: 0.32 }),
      { name: 'arp', kind: 'arp', layer: 'core', instrument: 'arpSynth', steps: 16, pattern: '0 1 2 1 3 1 2 1 0 1 2 1 3 1 2 1', low: 57, level: 0.55, pan: -0.28, reverb: 0.3, sections: ALL },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'synthBass', steps: 8, pattern: 'R . R R . R R .', low: 33, level: 0.7, sections: BODY },
      { name: 'pad', kind: 'pad', layer: 'core', instrument: 'pad', low: 57, level: 0.45, reverb: 0.4, sections: ALL },
      { name: 'kick', kind: 'drum', layer: 'rhythm', instrument: 'kick', steps: 16, pattern: 'x.......x.......', level: 0.6, sections: MAIN },
      { name: 'rim', kind: 'drum', layer: 'rhythm', instrument: 'rim', steps: 16, pattern: '....x.......x...', level: 0.6, pan: 0.1, reverb: 0.2, sections: MAIN },
      { name: 'tick', kind: 'drum', layer: 'rhythm', instrument: 'tick', steps: 16, pattern: 'x.o.x.o.x.o.x.o.', level: 0.6, pan: 0.3, sections: MAIN },
    ],
  },
  {
    id: 'core', title: '世界之心', bpm: 72, gain: 1.12, cycles: 2, form: FORM,
    sections: {
      intro: { bars: 2, chords: 'Cm | Ab' },
      A: { bars: 8, chords: 'Cm | Ab | Eb | Bb | Cm | Ab | Fm | G' },
      B: { bars: 8, chords: 'Ab | Bb | Gm | Cm | Fm | Bb | Ab | G' },
      A2: { bars: 8, chords: 'Cm | Ab | Eb | Bb | Cm | Ab | Fm | G' },
      outro: { bars: 4, chords: 'Ab | G | C | C' },
    },
    tracks: [
      lead(['bell', 'flute'], {
        A: 'G4 - C5 - Eb5 - D5 - | C5 - - - Eb5 - - - | Bb4 - Eb5 - G5 - F5 - | F5 - - - D5 - - - | G5 - - - Eb5 - C5 - | C6 - - - Ab5 - - - | Ab5 - G5 - F5 - Eb5 - | D5 - - - B4 - - -',
        B: 'Eb5 - - - Ab5 - C6 - | D6 - - - Bb5 - - - | Bb5 - - - G5 - D5 - | Eb5 - - - - - - - | F5 - Ab5 - C6 - Ab5 - | Bb5 - - - D6 - - - | C6 - Bb5 - Ab5 - Eb5 - | D5 - - - G5 - - -',
        A2: 'G4 - C5 - Eb5 - D5 - | C5 - - - Eb5 - - - | Bb4 - Eb5 - G5 - F5 - | F5 - - - D5 - - - | G5 - - - Eb5 - C5 - | C6 - - - Ab5 - - - | Ab5 - G5 - F5 - Eb5 - | D5 - - - B4 - - -',
        outro: 'C6 - - - Eb6 - - - | D6 - - - B5 - - - | C6 - - - - - - - | - - - - - - . .',
      }, { reverb: 0.45 }),
      { name: 'harp', kind: 'arp', layer: 'core', instrument: 'harp', steps: 8, pattern: '0 1 2 3 4 3 2 1', low: 48, level: 0.55, pan: -0.25, reverb: 0.45, sections: ALL },
      { name: 'choir', kind: 'pad', layer: 'core', instrument: 'choir', low: 55, level: 0.6, reverb: 0.55, sections: ALL },
      { name: 'bass', kind: 'bass', layer: 'core', instrument: 'bass', steps: 8, pattern: 'R - - - - - - -', low: 36, level: 0.42, sections: BODY },
      { name: 'timpani', kind: 'drum', layer: 'rhythm', instrument: 'timpani', steps: 16, pattern: 'x...............', level: 0.6, reverb: 0.35, sections: ['B', 'A2'] },
      { name: 'triangle', kind: 'drum', layer: 'rhythm', instrument: 'triangle', steps: 16, pattern: '........x.......', level: 0.6, pan: 0.3, reverb: 0.5, sections: ['B'] },
    ],
  },
];

export type SongId = 'meadow' | 'timber' | 'mushroom' | 'crystal' | 'ruins' | 'ice' | 'lava' | 'fossil' | 'machine' | 'core';
const byId = new Map(SONGS.map(song => [song.id, song]));
export function songById(id: SongId) {
  const song = byId.get(id);
  if (!song) throw Error(`未知曲目 ${id}`);
  return song;
}
