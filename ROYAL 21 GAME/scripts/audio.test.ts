/**
 * Music engine. Run with `npm run test:audio`.
 *
 * The point: prove the soundtrack is actually music. The previous version held
 * three oscillators on one chord forever, which came out of the speakers as a
 * hum. These checks fail if that ever comes back — a drone schedules a handful
 * of oscillators that never stop, music schedules many short ones at changing
 * pitches.
 */

let failures = 0;
const check = (name: string, condition: boolean, detail = '') => {
  if (condition) console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
};

/* ---------------------------------------------------------------- stubs --- */
interface Scheduled { freq: number; start: number; stop: number | null }
const scheduled: Scheduled[] = [];

class FakeParam {
  value = 0;
  setValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
}
class FakeNode {
  connect() { return this; }
  disconnect() { return this; }
}
class FakeOsc extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  detune = new FakeParam();
  private entry: Scheduled | null = null;
  start(at = 0) { this.entry = { freq: this.frequency.value, start: at, stop: null }; scheduled.push(this.entry); }
  stop(at = 0) { if (this.entry) this.entry.stop = at; }
}
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam();
  Q = new FakeParam();
}
class FakeBufferSource extends FakeNode {
  buffer: unknown = null; loop = false;
  start() {} stop() {}
}
class FakeConvolver extends FakeNode {
  buffer: unknown = null;
}
class FakeCtx {
  currentTime = 0;
  sampleRate = 44100;
  destination = new FakeNode();
  state = 'running';
  createGain() { return new FakeGain(); }
  createOscillator() { return new FakeOsc(); }
  createBiquadFilter() { return new FakeFilter(); }
  createBufferSource() { return new FakeBufferSource(); }
  createConvolver() { return new FakeConvolver(); }
  createBuffer(channels: number, length: number) {
    return { getChannelData: (_ch: number = 0) => new Float32Array(length), numberOfChannels: channels };
  }
  resume() { return Promise.resolve(); }
}

const timers: (() => void)[] = [];
(globalThis as Record<string, unknown>).window = {
  AudioContext: FakeCtx,
  setInterval: (fn: () => void) => { timers.push(fn); return timers.length; },
  clearInterval: () => {},
};
(globalThis as Record<string, unknown>).setInterval = (fn: () => void) => { timers.push(fn); return timers.length; };
(globalThis as Record<string, unknown>).clearInterval = () => {};

/* -------------------------------------------------------------- the test -- */
const { audio } = await import('@/audio/AudioManager');

console.log('\nmusic — scheduling');
audio.unlock();
audio.startMusic();

// Advance the clock and pump the scheduler the way the browser timer would.
const ctx = (audio as unknown as { ctx: FakeCtx }).ctx;
for (let tick = 0; tick < 40; tick++) {
  ctx.currentTime += 0.25;
  timers.forEach((fn) => fn());
}

const freqs = scheduled.map((s) => s.freq);
const unique = new Set(freqs.map((f) => Math.round(f)));

check('notes are scheduled', scheduled.length > 40, `${scheduled.length} notes over ~10s`);
check('more than one pitch is used', unique.size >= 8, `${unique.size} distinct pitches`);
check('every note is given an end', scheduled.every((s) => s.stop !== null));
check('notes are short, not held forever',
  scheduled.every((s) => s.stop !== null && s.stop - s.start < 3),
  `longest ${Math.max(...scheduled.map((s) => (s.stop ?? 0) - s.start)).toFixed(2)}s`);
check('notes start at increasing times',
  scheduled.every((s, i, all) => i === 0 || s.start >= all[i - 1].start));
check('pitches sit in a musical range (55–1100 Hz)',
  freqs.every((f) => f > 50 && f < 1200),
  `${Math.min(...freqs).toFixed(0)}–${Math.max(...freqs).toFixed(0)} Hz`);

console.log('\nmusic — lifecycle');
const beforeStop = scheduled.length;
audio.stopMusic();
timers.forEach((fn) => fn());
check('stopMusic halts scheduling', scheduled.length === beforeStop);

audio.startMusic();
audio.startMusic();
const afterDouble = scheduled.length;
ctx.currentTime += 0.25;
timers.forEach((fn) => fn());
// One pump of the richer arrangement schedules ~12 oscillators on the downbeat
// (pad + bass + arpeggio); a doubled track would be ~24. 18 splits the two.
check('starting twice does not double the track', scheduled.length - afterDouble < 18,
  `${scheduled.length - afterDouble} notes in one tick`);

console.log(failures ? `\n${failures} failing check(s)\n` : '\nall music checks passed\n');
process.exit(failures ? 1 : 0);
