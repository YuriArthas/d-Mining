import type { DrumId, InstrumentId } from './instruments.ts';

/** Songs are written like a tracker: one token per grid step, bars separated by `|`.
 *  Melody tokens are note names (`C5`, `F#4`, `Bb3`), `-` holds the previous note, `.` rests.
 *  Bass tokens are chord degrees (`R` root or slash bass, `3`, `5`, `8` octave), arpeggio tokens are
 *  indices into the chord's tones climbing from `low`, drum tokens are `X` accent, `x` hit, `o` ghost
 *  (drum bars may be written as one string, a character per step).
 *  Chords: one symbol per bar, or several separated by commas to split the bar evenly. */
export type Layer = 'core' | 'rhythm' | 'lead';
type Steps = 8 | 16;
type Common = Readonly<{ name: string; layer: Layer; level?: number; pan?: number; reverb?: number; sections?: readonly string[]; cycles?: readonly number[] }>;
export type TrackSpec = Common & (
  | Readonly<{ kind: 'melody'; instrument: InstrumentId | readonly (InstrumentId | null)[]; steps: Steps; parts: Readonly<Record<string, string>>; shift?: readonly number[] }>
  | Readonly<{ kind: 'bass'; instrument: InstrumentId; steps: Steps; pattern: string; low: number }>
  | Readonly<{ kind: 'arp'; instrument: InstrumentId; steps: Steps; pattern: string; low: number }>
  | Readonly<{ kind: 'pad'; instrument: InstrumentId; low: number }>
  | Readonly<{ kind: 'drum'; instrument: DrumId; steps: Steps; pattern: string }>
);
export type SongSpec = Readonly<{
  id: string; title: string; bpm: number;
  /** Loudness match between songs (measured offline, see tools/music-preview). */
  gain?: number;
  /** Where the off-beat eighth falls within the beat: 0.5 straight, about 0.6 for a shuffle. */
  swing?: number;
  sections: Readonly<Record<string, Readonly<{ bars: number; chords: string }>>>;
  form: readonly string[];
  /** Arrangement variants: track `cycles` and per-cycle instruments pick from `cycle % cycles`. */
  cycles: number;
  tracks: readonly TrackSpec[];
}>;

export type NoteEvent = Readonly<{ beat: number; beats: number; midi: readonly number[]; velocity: number; track: number; section: string }>;
export type CompiledCycle = Readonly<{ events: readonly NoteEvent[]; beats: number; sections: readonly Readonly<{ id: string; beat: number }>[] }>;

const LETTERS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midiOf(name: string) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw Error(`音符写法无效：${name}`);
  return 12 * (Number(m[3]) + 1) + LETTERS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function pitchClass(name: string) {
  const m = /^([A-G])(#|b)?$/.exec(name);
  if (!m) throw Error(`音名无效：${name}`);
  return (LETTERS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12;
}

const QUALITIES: Readonly<Record<string, readonly number[]>> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7],
  add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], dim: [0, 3, 6], aug: [0, 4, 8], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
  '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], '5': [0, 7], m7b5: [0, 3, 6, 10],
};
type Chord = Readonly<{ root: number; intervals: readonly number[]; bass: number }>;
export function parseChord(symbol: string): Chord {
  const m = /^([A-G](?:#|b)?)([a-z0-9]*)(?:\/([A-G](?:#|b)?))?$/.exec(symbol);
  const intervals = m && QUALITIES[m[2]];
  if (!m || !intervals) throw Error(`和弦写法无效：${symbol}`);
  const root = pitchClass(m[1]);
  return { root, intervals, bass: m[3] ? pitchClass(m[3]) : root };
}
/** Pitch classes of a chord. */
export const chordTones = (chord: Chord) => chord.intervals.map(i => (chord.root + i) % 12);
/** Closest-position voicing: every chord tone once, inside [low, low + 12). */
export function voicing(chord: Chord, low: number) {
  return chordTones(chord).map(pc => low + ((pc - low) % 12 + 12) % 12).sort((a, b) => a - b);
}
/** The lowest MIDI note of pitch class `pc` at or above `low`. */
const above = (pc: number, low: number) => low + ((pc - low) % 12 + 12) % 12;

function bars(text: string) {
  return text.split('|').map(bar => bar.trim()).filter(Boolean).map(bar => bar.split(/\s+/));
}
function gridBars(text: string, steps: number, where: string) {
  // Drum patterns may be written without spaces: one character per step.
  const parsed = bars(text).map(bar => bar.length === 1 && bar[0].length === steps ? [...bar[0]] : bar);
  parsed.forEach((bar, i) => { if (bar.length !== steps) throw Error(`${where} 第 ${i + 1} 小节有 ${bar.length} 格，应为 ${steps}`); });
  return parsed;
}

/** Beat position after swing: the off-beat eighth moves to `swing` of the beat. */
function swung(beat: number, swing: number) {
  if (swing === 0.5) return beat;
  const whole = Math.floor(beat), f = beat - whole;
  return whole + (f < 0.5 ? f * swing / 0.5 : swing + (f - 0.5) * (1 - swing) / 0.5);
}
/** Metric accent for a note starting at this beat of the bar. */
function accent(beatInBar: number) {
  if (beatInBar === 0) return 1;
  if (beatInBar === 2) return 0.92;
  return Number.isInteger(beatInBar) ? 0.86 : 0.76;
}

/** Every note of one pass through the song's form, in beats from its start. */
export function compileCycle(song: SongSpec, cycle: number): CompiledCycle {
  const events: NoteEvent[] = [], sections: { id: string; beat: number }[] = [], variant = cycle % song.cycles, swing = song.swing ?? 0.5;
  let start = 0;
  for (const id of song.form) {
    const section = song.sections[id];
    if (!section) throw Error(`${song.id} 缺少段落 ${id}`);
    sections.push({ id, beat: start });
    const chordBars = bars(section.chords).map(bar => bar.join('').split(',').map(parseChord));
    if (chordBars.length !== section.bars) throw Error(`${song.id}.${id} 和弦 ${chordBars.length} 小节，应为 ${section.bars}`);
    const chordAt = (bar: number, beatInBar: number) => { const list = chordBars[bar]; return list[Math.min(list.length - 1, Math.floor(beatInBar / (4 / list.length)))]; };
    song.tracks.forEach((track, index) => {
      if (track.sections && !track.sections.includes(id)) return;
      if (track.cycles && !track.cycles.includes(variant)) return;
      const push = (bar: number, beatInBar: number, beats: number, midi: readonly number[], velocity: number) => {
        const at = start + bar * 4 + beatInBar, end = at + beats;
        const beat = track.kind === 'pad' ? at : swung(at, swing);
        events.push({ beat, beats: (track.kind === 'pad' ? end : swung(end, swing)) - beat, midi, velocity, track: index, section: id });
      };
      if (track.kind === 'pad') {
        chordBars.forEach((list, bar) => list.forEach((chord, i) => push(bar, i * 4 / list.length, 4 / list.length, voicing(chord, track.low), 0.9)));
        return;
      }
      const grid = track.kind === 'melody' ? track.parts[id] : section.bars ? Array.from({ length: section.bars }, () => track.pattern).join(' | ') : '';
      if (!grid) return;
      const shift = track.kind === 'melody' ? track.shift?.[variant % track.shift.length] ?? 0 : 0;
      const parsed = gridBars(grid, track.steps, `${song.id}.${id}.${track.name}`);
      if (parsed.length !== section.bars) throw Error(`${song.id}.${id}.${track.name} 有 ${parsed.length} 小节，应为 ${section.bars}`);
      const step = 4 / track.steps;
      // `-` may carry a note over the bar line.
      const flat = parsed.flatMap((tokens, bar) => tokens.map((token, i) => ({ token, bar, i })));
      flat.forEach(({ token, bar, i }, k) => {
        if (token === '.' || token === '-') return;
        let length = 1;
        while (k + length < flat.length && flat[k + length].token === '-') length++;
        const beatInBar = i * step, chord = chordAt(bar, beatInBar);
        if (track.kind === 'drum') {
          const velocity = token === 'X' ? 1 : token === 'x' ? 0.78 : token === 'o' ? 0.45 : NaN;
          if (Number.isNaN(velocity)) throw Error(`${song.id}.${track.name} 鼓点写法无效：${token}`);
          push(bar, beatInBar, step, [], velocity);
        } else if (track.kind === 'melody') push(bar, beatInBar, length * step, [midiOf(token) + shift], accent(beatInBar));
        else if (track.kind === 'bass') {
          const root = above(token === 'R' ? chord.bass : chord.root, track.low);
          const degree: Readonly<Record<string, number>> = { R: 0, '3': chord.intervals[1] ?? 4, '5': 7, '8': 12 };
          if (!(token in degree)) throw Error(`${song.id}.${track.name} 低音写法无效：${token}`);
          push(bar, beatInBar, length * step, [token === 'R' ? root : above(chord.root, track.low) + degree[token]], accent(beatInBar));
        } else {
          const tones = voicing(chord, track.low), ladder = [...tones, ...tones.map(n => n + 12), ...tones.map(n => n + 24)];
          const n = Number(token);
          if (!Number.isInteger(n) || n < 0 || n >= ladder.length) throw Error(`${song.id}.${track.name} 琶音写法无效：${token}`);
          push(bar, beatInBar, length * step, [ladder[n]], accent(beatInBar) * 0.9);
        }
      });
    });
    start += section.bars * 4;
  }
  events.sort((a, b) => a.beat - b.beat || a.track - b.track);
  return { events, beats: start, sections };
}

/** The instrument a track plays in this cycle (null: the track rests this time round). */
export function trackInstrument(track: TrackSpec, cycle: number, cycles: number): InstrumentId | DrumId | null {
  if (track.kind !== 'melody' || typeof track.instrument === 'string') return track.instrument as InstrumentId | DrumId;
  const list = track.instrument as readonly (InstrumentId | null)[];
  return list[(cycle % cycles) % list.length];
}
