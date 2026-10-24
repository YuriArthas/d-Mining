import { playDrum, playNote, type DrumId, type InstrumentId } from './instruments.ts';
import { compileCycle, trackInstrument, type CompiledCycle, type Layer, type NoteEvent, type SongSpec, type TrackSpec } from './score.ts';
import { songById, type SongId } from './songs.ts';

/** What should be playing: the piece and how full the arrangement is (0..1 per optional layer). */
type MusicScene = Readonly<{ song: SongId | null; rhythm: number; lead: number }>;

const LOOKAHEAD = 0.6;
const FADE_OUT = 2.2;
const START_DELAY = 1.2;
const TAIL = 2.5;
const REST: readonly [number, number] = [9, 18];
/** Mix balance by part: the tune leads, bass and pads stay underneath (phones cannot play deep bass). */
const PART_GAIN: Readonly<Record<TrackSpec['kind'], number>> = { melody: 1.5, arp: 1, bass: 0.6, pad: 0.6, drum: 0.85 };

/** Per-song nodes: song envelope (dry and reverb send), layer switches and one input per track. */
type Routing = Readonly<{ gain: GainNode; wet: GainNode; layers: Readonly<Record<Layer, GainNode>>; tracks: readonly AudioNode[]; nodes: readonly AudioNode[] }>;
type Playback = {
  readonly song: SongSpec; readonly cycle: number; readonly compiled: CompiledCycle; readonly start: number; readonly beat: number;
  readonly routing: Routing; readonly instruments: readonly (InstrumentId | DrumId | null)[]; next: number;
};

/** Plays the scene's song on the audio clock: notes are scheduled a little ahead from a timer, so a
 *  busy frame never makes the music stumble. A pass runs intro to outro, rests, then plays again
 *  with the next arrangement; changing song fades the old one out before the new one starts. */
export class MusicPlayer {
  private readonly ctx: BaseAudioContext;
  private readonly out: AudioNode;
  private readonly wet: AudioNode;
  private readonly noise: AudioBuffer;
  private readonly random: () => number;
  private scene: MusicScene = { song: null, rhythm: 1, lead: 1 };
  private playback: Playback | null = null;
  private fading: { routing: Routing; until: number }[] = [];
  private cycle = 0;
  private resumeAt = 0;
  scheduled = 0;
  passes = 0;

  constructor(ctx: BaseAudioContext, out: AudioNode, wet: AudioNode, noise: AudioBuffer, random: () => number = Math.random) {
    this.ctx = ctx; this.out = out; this.wet = wet; this.noise = noise; this.random = random;
  }

  setScene(scene: MusicScene) {
    const changed = scene.song !== this.scene.song;
    this.scene = scene;
    if (changed) {
      if (this.playback) this.fadeOut(this.playback.routing);
      this.playback = null; this.cycle = 0;
      this.resumeAt = this.ctx.currentTime + (this.passes || this.fading.length ? START_DELAY : 0.3);
    } else if (this.playback) this.applyLayers(this.playback.routing, 0.6);
  }

  /** Stop at once-ish (music switched off): fade out and start the scene's song afresh later. */
  stop() {
    if (this.playback) this.fadeOut(this.playback.routing);
    this.playback = null; this.cycle = 0; this.resumeAt = 0;
  }

  /** Call regularly (every ~100 ms): schedules what falls inside the lookahead window. */
  tick() {
    const now = this.ctx.currentTime;
    this.fading = this.fading.filter(f => { if (now < f.until) return true; disconnect(f.routing); return false; });
    if (!this.scene.song) return;
    if (!this.playback) {
      if (now < this.resumeAt) return;
      this.playback = this.begin(songById(this.scene.song), this.cycle, Math.max(now + 0.05, this.resumeAt));
    }
    const p = this.playback, events = p.compiled.events, horizon = now + LOOKAHEAD;
    while (p.next < events.length && p.start + events[p.next].beat * p.beat < horizon) this.play(p, events[p.next++]);
    const end = p.start + p.compiled.beats * p.beat;
    if (p.next >= events.length && now > end + TAIL) {
      this.fading.push({ routing: p.routing, until: now });
      this.playback = null; this.cycle++; this.passes++;
      this.resumeAt = end + TAIL + REST[0] + this.random() * (REST[1] - REST[0]);
    }
  }

  dispose() {
    if (this.playback) disconnect(this.playback.routing);
    for (const f of this.fading) disconnect(f.routing);
    this.playback = null; this.fading = [];
  }

  diagnostics() {
    const p = this.playback, now = this.ctx.currentTime;
    const beat = p ? (now - p.start) / p.beat : 0;
    const section = p ? [...p.compiled.sections].reverse().find(s => s.beat <= beat)?.id ?? 'intro' : null;
    return {
      song: this.scene.song, playing: p?.song.id ?? null, cycle: this.cycle, passes: this.passes,
      state: p ? (beat < 0 ? 'starting' : 'playing') : this.scene.song ? 'resting' : 'silent',
      section, scheduled: this.scheduled, rhythm: this.scene.rhythm, lead: this.scene.lead,
      lead_instrument: p ? p.instruments[p.song.tracks.findIndex(t => t.kind === 'melody')] ?? null : null,
    };
  }

  private begin(song: SongSpec, cycle: number, start: number): Playback {
    const ctx = this.ctx, gain = ctx.createGain(), wet = ctx.createGain(), nodes: AudioNode[] = [gain, wet];
    // A short swell in, so a song never starts with a click; the reverb send follows the same envelope.
    for (const envelope of [gain, wet]) {
      envelope.gain.value = 0;
      envelope.gain.setValueAtTime(0, Math.max(0, start - 0.02));
      envelope.gain.linearRampToValueAtTime(song.gain ?? 1, start + 0.5);
    }
    gain.connect(this.out); wet.connect(this.wet);
    const layers = Object.fromEntries((['core', 'rhythm', 'lead'] as const).map(name => {
      const layer = ctx.createGain(); layer.connect(gain); nodes.push(layer);
      return [name, layer];
    })) as Record<Layer, GainNode>;
    const tracks = song.tracks.map(track => {
      const level = ctx.createGain();
      level.gain.value = (track.level ?? 1) * PART_GAIN[track.kind];
      nodes.push(level);
      let tail: AudioNode = level;
      if (track.pan && typeof ctx.createStereoPanner === 'function') {
        const pan = ctx.createStereoPanner(); pan.pan.value = track.pan; level.connect(pan); tail = pan; nodes.push(pan);
      }
      tail.connect(layers[track.layer]);
      if (track.reverb) { const send = ctx.createGain(); send.gain.value = track.reverb; level.connect(send).connect(wet); nodes.push(send); }
      return level;
    });
    const routing: Routing = { gain, wet, layers, tracks, nodes };
    this.applyLayers(routing, 0);
    return {
      song, cycle, compiled: compileCycle(song, cycle), start, beat: 60 / song.bpm, routing, next: 0,
      instruments: song.tracks.map(track => trackInstrument(track, cycle, song.cycles)),
    };
  }

  private applyLayers(routing: Routing, seconds: number) {
    const now = this.ctx.currentTime;
    for (const [name, value] of [['rhythm', this.scene.rhythm], ['lead', this.scene.lead]] as const) {
      if (seconds) routing.layers[name].gain.setTargetAtTime(value, now, seconds / 3);
      else routing.layers[name].gain.value = value;
    }
  }

  private play(p: Playback, event: NoteEvent) {
    const track = p.song.tracks[event.track], instrument = p.instruments[event.track];
    if (!instrument) return;
    // Skip layers that are switched off rather than schedule silent notes.
    if ((track.layer === 'rhythm' && this.scene.rhythm <= 0.01) || (track.layer === 'lead' && this.scene.lead <= 0.01)) return;
    const humane = track.kind === 'pad' ? 0 : (this.random() * 2 - 1) * (track.kind === 'drum' ? 0.003 : 0.006);
    const t = Math.max(this.ctx.currentTime + 0.005, p.start + event.beat * p.beat + humane);
    const velocity = event.velocity * (0.92 + this.random() * 0.16), out = p.routing.tracks[event.track];
    if (track.kind === 'drum') playDrum(instrument as DrumId, { ctx: this.ctx, out, t, velocity, random: this.random, noise: this.noise });
    else for (const midi of event.midi) {
      playNote(instrument as InstrumentId, { ctx: this.ctx, out, t, midi, seconds: event.beats * p.beat, velocity: velocity / Math.sqrt(event.midi.length), random: this.random, noise: this.noise });
    }
    this.scheduled++;
  }

  private fadeOut(routing: Routing) {
    const now = this.ctx.currentTime;
    for (const envelope of [routing.gain, routing.wet]) envelope.gain.setTargetAtTime(0, now, FADE_OUT / 5);
    this.fading.push({ routing, until: now + FADE_OUT + 0.5 });
  }
}

function disconnect(routing: Routing) {
  for (const node of routing.nodes) node.disconnect();
}
