import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeContext, seeded } from './fixtures/fakeAudio.mjs';
import { RANGE } from '../../src/game/audio/music/instruments.ts';
import { MusicPlayer } from '../../src/game/audio/music/MusicPlayer.ts';
import { chordTones, compileCycle, midiOf, parseChord, trackInstrument, voicing } from '../../src/game/audio/music/score.ts';
import { SONGS, songById } from '../../src/game/audio/music/songs.ts';
import { makeNoise } from '../../src/game/audio/synth.ts';
import { THEMES } from '../../src/game/content/themes.ts';
import { Soundscape } from '../../src/game/audio/soundscape.ts';

test('乐谱写法：音名、和弦（含转位低音）和紧凑排列的和弦音', () => {
  assert.deepEqual(['C4', 'A4', 'F#5', 'Bb3', 'C-1'].map(midiOf), [60, 69, 78, 58, 0]);
  const chord = parseChord('C/E');
  assert.deepEqual([chord.root, chord.bass], [0, 4]);
  assert.deepEqual(chordTones(parseChord('F#m7')), [6, 9, 1, 4]);
  for (const symbol of ['Fmaj7', 'Bsus4', 'G#m7', 'Db', 'Am7']) {
    const notes = voicing(parseChord(symbol), 55);
    assert.ok(notes.every(n => n >= 55 && n < 67), `${symbol} voiced inside one octave from the floor`);
  }
  assert.throws(() => parseChord('H7'));
  assert.throws(() => compileCycle({ ...songById('meadow'), sections: { ...songById('meadow').sections, A: { bars: 7, chords: 'F | C | F' } } }, 0), /和弦/);
});

test('十首曲子：每段格数正确、音都在乐器音域里、强拍旋律多落在和弦音上、一遍一到两分钟', () => {
  assert.equal(SONGS.length, 10);
  for (const song of SONGS) {
    for (let cycle = 0; cycle < song.cycles; cycle++) {
      const { events, beats } = compileCycle(song, cycle), seconds = beats * 60 / song.bpm;
      assert.ok(seconds > 60 && seconds < 120, `${song.id} pass lasts ${seconds.toFixed(0)} s`);
      assert.ok(events.every((e, i) => i === 0 || e.beat >= events[i - 1].beat), 'events in time order');
      for (const e of events) {
        const track = song.tracks[e.track], instrument = trackInstrument(track, cycle, song.cycles);
        if (!instrument || !(instrument in RANGE)) continue;
        const [low, high] = RANGE[instrument];
        assert.ok(e.midi.every(m => m >= low && m <= high), `${song.id}.${track.name} ${e.midi} within ${instrument}`);
      }
    }
    // Strong beats of the tune mostly land on the chord: the melody fits its harmony.
    const lead = song.tracks.findIndex(t => t.kind === 'melody'), { events, sections } = compileCycle(song, 0);
    const begin = Object.fromEntries(sections.map(s => [s.id, s.beat]));
    let strong = 0, fit = 0;
    for (const e of events) {
      if (e.track !== lead) continue;
      const local = e.beat - begin[e.section], bar = Math.floor(local / 4), inBar = local - bar * 4;
      if (Math.abs(inBar - Math.round(inBar)) > 1e-6 || Math.round(inBar) % 2) continue;
      const list = song.sections[e.section].chords.split('|')[bar].trim().replace(/\s+/g, '').split(',').map(parseChord);
      strong++; if (chordTones(list[Math.min(list.length - 1, Math.floor(inBar / (4 / list.length)))]).includes(e.midi[0] % 12)) fit++;
    }
    assert.ok(fit / strong >= 0.8, `${song.id}: ${fit}/${strong} strong-beat melody notes are chord tones`);
    // The lead changes instrument from one pass to the next.
    const melody = song.tracks[lead];
    assert.notEqual(trackInstrument(melody, 0, song.cycles), trackInstrument(melody, 1, song.cycles), `${song.id} alternates its lead`);
    assert.ok(song.tracks.filter(t => t.kind === 'drum').every(t => t.layer === 'rhythm'), 'drums sit in the rhythm layer');
  }
});

test('每个矿层主题都有自己的曲子', () => {
  const ids = new Set(SONGS.map(s => s.id)), soundscape = new Soundscape();
  for (const theme of THEMES) {
    const scene = soundscape.scene({ theme: theme.id, surfaceLight: 0 });
    assert.ok(ids.has(scene.song), `${theme.id} plays ${scene.song}`);
  }
  assert.equal(new Set(THEMES.map(t => new Soundscape().scene({ theme: t.id, surfaceLight: 0 }).song)).size, 10, 'ten different pieces');
});

function player(song = 'meadow') {
  const ctx = new FakeContext({ time: 0 }), out = ctx.createGain(), wet = ctx.createGain();
  const music = new MusicPlayer(ctx, out, wet, makeNoise(ctx, 0.5), seeded(7));
  music.setScene({ song, rhythm: 1, lead: 1 });
  const run = seconds => { for (let t = 0; t < seconds; t += 0.1) { ctx.currentTime = +(ctx.currentTime + 0.1).toFixed(6); music.tick(); } };
  return { ctx, music, run };
}
const scheduledOscillators = ctx => ctx.nodes.filter(n => n.kind === 'osc' && n.startTime !== undefined);

test('播放器只排程前方一小段：音符在开始时间之前排好，不会一次把整首塞进去', () => {
  const { ctx, music, run } = player();
  run(3);
  const starts = scheduledOscillators(ctx).map(o => o.startTime);
  assert.ok(starts.length > 0, 'notes are scheduled');
  assert.ok(Math.max(...starts) <= ctx.currentTime + 0.61, `nothing beyond the lookahead (${Math.max(...starts).toFixed(2)} vs ${ctx.currentTime})`);
  assert.equal(music.diagnostics().state, 'playing');
  assert.equal(music.diagnostics().playing, 'meadow');
});

test('换曲：旧曲淡出、稍等再从前奏开始新曲；夜里关掉鼓组就不再排鼓点', () => {
  const { ctx, music, run } = player();
  run(4);
  const firstGain = ctx.nodes.find(n => n.kind === 'gain' && n.gain.events.some(e => e[0] === 'linear' && e[1] === songById('meadow').gain));
  music.setScene({ song: 'timber', rhythm: 1, lead: 1 });
  assert.ok(firstGain.gain.events.some(e => e[0] === 'target' && e[1] === 0), 'old song fades out');
  assert.equal(music.diagnostics().state, 'resting', 'a short gap before the next song');
  run(1.5);
  assert.equal(music.diagnostics().playing, 'timber');
  assert.equal(music.diagnostics().section, 'intro');
  run(3);
  assert.ok(firstGain.disconnected, 'the faded song is released');
  // Rhythm off: no drum hits scheduled from now on.
  music.setScene({ song: 'timber', rhythm: 0, lead: 1 });
  const before = ctx.nodes.length;
  run(10);
  const kicks = ctx.nodes.slice(before).filter(n => n.kind === 'osc' && n.frequency.events.some(e => e[0] === 'exp' && e[1] === 52));
  assert.equal(kicks.length, 0, 'no kick drum while the rhythm layer is off');
});

test('一遍放完先休息一会儿，再换另一种主奏乐器接着放；关掉音乐后再打开从头放', () => {
  const { music, run } = player('lava');
  run(80);
  assert.equal(music.passes, 1, 'first pass done');
  assert.equal(music.diagnostics().state, 'resting');
  run(25);
  assert.equal(music.diagnostics().state, 'playing');
  assert.equal(music.diagnostics().cycle, 1);
  assert.equal(music.diagnostics().lead_instrument, 'softLead', 'second pass changes the lead');
  music.stop();
  run(0.5);
  assert.equal(music.diagnostics().section, 'intro');
  assert.equal(music.diagnostics().cycle, 0);
});
