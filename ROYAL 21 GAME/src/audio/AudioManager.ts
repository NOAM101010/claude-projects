/**
 * Procedural audio.
 *
 * The game ships with zero audio files on purpose: every sound is synthesised
 * with the Web Audio API, so there is nothing to preload, nothing to 404 and
 * nothing to license. Swap in samples later by replacing `play()` internals —
 * the call sites (`audio.play('card')`) do not change.
 */
export type Bus = 'master' | 'music' | 'sfx' | 'ambient';
export type Sfx =
  | 'hover' | 'click' | 'back' | 'card' | 'cardFlip' | 'chip' | 'chipStack'
  | 'win' | 'bigWin' | 'lose' | 'bust' | 'push' | 'blackjack'
  | 'coin' | 'coinLand' | 'dice' | 'slotSpin' | 'slotStop' | 'wheelTick'
  | 'scratch' | 'notify' | 'friendJoin' | 'door' | 'vault' | 'levelUp' | 'error';

interface Voice { freq: number; dur: number; type: OscillatorType; gain: number; slide?: number; delay?: number }

/**
 * Sound design — a note on the goals here:
 *   - Every sfx has a short attack (< 20ms) and a rounded exponential decay,
 *     so nothing clicks or pops.
 *   - Chord-based sounds (win, blackjack, levelUp) use just-intonation
 *     intervals for a warmer feel than equal-tempered midi frequencies.
 *   - "Object" sounds (card, chip, coin) get a filtered noise transient on
 *     top of the tonal voice, added inside play() — that's what makes a chip
 *     land instead of just chirping.
 */
const VOICES: Record<Sfx, Voice[]> = {
  // UI clicks — quiet, quick, no reverb
  hover:    [{ freq: 1200, dur: 0.03, type: 'sine',     gain: 0.025 }],
  click:    [{ freq: 660,  dur: 0.04, type: 'triangle', gain: 0.05, slide: 440 }],
  back:     [{ freq: 440,  dur: 0.08, type: 'sine',     gain: 0.06, slide: 260 }],

  // Card flips: mostly paper friction (the noise sweep in play() carries it),
  // a faint tonal tick just to seat it in pitch
  card:     [{ freq: 2000, dur: 0.04, type: 'triangle', gain: 0.045, slide: 1100 }],
  cardFlip: [
    { freq: 1600, dur: 0.04, type: 'triangle', gain: 0.04,  slide: 820 },
    { freq: 1000, dur: 0.08, type: 'triangle', gain: 0.03,  delay: 45, slide: 620 },
  ],

  // Chips: a tight ceramic click — sharp transient in play() does the work
  chip: [
    { freq: 760, dur: 0.05, type: 'triangle', gain: 0.06, slide: 320 },
    { freq: 300, dur: 0.05, type: 'sine',     gain: 0.04, delay: 10 },
  ],
  chipStack: [
    { freq: 720, dur: 0.05, type: 'triangle', gain: 0.055 },
    { freq: 640, dur: 0.05, type: 'triangle', gain: 0.055, delay: 55 },
    { freq: 560, dur: 0.06, type: 'triangle', gain: 0.05,  delay: 115 },
    { freq: 480, dur: 0.07, type: 'triangle', gain: 0.045, delay: 175 },
  ],

  // Wins: an ascending major arpeggio that opens into a high shimmer
  win: [
    { freq: 523.25, dur: 0.22, type: 'triangle', gain: 0.12 },                  // C5
    { freq: 659.25, dur: 0.22, type: 'triangle', gain: 0.12, delay: 70 },       // E5
    { freq: 783.99, dur: 0.24, type: 'triangle', gain: 0.12, delay: 140 },      // G5
    { freq: 1046.5, dur: 0.40, type: 'sine',     gain: 0.11, delay: 210 },      // C6
    { freq: 1568.0, dur: 0.52, type: 'sine',     gain: 0.055, delay: 300 },     // G6 shimmer
  ],
  bigWin: [
    { freq: 523.25, dur: 0.24, type: 'triangle', gain: 0.12 },
    { freq: 659.25, dur: 0.24, type: 'triangle', gain: 0.12, delay: 80 },
    { freq: 783.99, dur: 0.24, type: 'triangle', gain: 0.12, delay: 160 },
    { freq: 1046.5, dur: 0.40, type: 'sine',     gain: 0.13, delay: 260 },      // C6
    { freq: 1318.5, dur: 0.52, type: 'sine',     gain: 0.10, delay: 340 },      // E6
    { freq: 1975.5, dur: 0.55, type: 'sine',     gain: 0.05, delay: 440 },      // B6 bell
    { freq: 2637.0, dur: 0.60, type: 'sine',     gain: 0.035, delay: 560 },     // E7 sparkle
  ],

  // Losses: muted downward sweep — sad, not painful, easy on repeat
  lose: [
    { freq: 320, dur: 0.34, type: 'sine',     gain: 0.08, slide: 165 },
    { freq: 236, dur: 0.30, type: 'triangle', gain: 0.04, delay: 80, slide: 120 },
  ],
  bust: [
    { freq: 240, dur: 0.40, type: 'triangle', gain: 0.08, slide: 95 },
    { freq: 160, dur: 0.34, type: 'sine',     gain: 0.05, delay: 50, slide: 72 },
  ],
  push: [
    { freq: 440, dur: 0.14, type: 'sine',     gain: 0.06 },
    { freq: 440, dur: 0.14, type: 'sine',     gain: 0.05, delay: 100 },
  ],

  // Blackjack: its own signature — a bright "ta-daa" fourth that resolves up an
  // octave, then a pair of bells ringing out over a warm low body
  blackjack: [
    { freq: 587.33, dur: 0.16, type: 'triangle', gain: 0.12 },                  // D5
    { freq: 880.00, dur: 0.18, type: 'triangle', gain: 0.12, delay: 90 },       // A5
    { freq: 1174.7, dur: 0.32, type: 'sine',     gain: 0.12, delay: 190 },      // D6
    { freq: 440.00, dur: 0.50, type: 'sine',     gain: 0.06, delay: 190 },      // A4 body
    { freq: 1760.0, dur: 0.60, type: 'sine',     gain: 0.075, delay: 320 },     // A6 bell
    { freq: 2349.3, dur: 0.66, type: 'sine',     gain: 0.045, delay: 440 },     // D7 shimmer
  ],

  // Coin: satisfying spin → ring
  coin: [
    { freq: 700,  dur: 0.20, type: 'triangle', gain: 0.09, slide: 1800 },
    { freq: 1400, dur: 0.30, type: 'sine',     gain: 0.06, delay: 60 },
  ],
  coinLand: [
    { freq: 1600, dur: 0.14, type: 'triangle', gain: 0.10, slide: 600 },
    { freq: 800,  dur: 0.20, type: 'sine',     gain: 0.06, delay: 30, slide: 500 },
  ],

  // Dice: three quick clacks
  dice: [
    { freq: 260, dur: 0.05, type: 'square', gain: 0.07 },
    { freq: 220, dur: 0.05, type: 'square', gain: 0.06, delay: 100 },
    { freq: 190, dur: 0.06, type: 'square', gain: 0.05, delay: 190 },
  ],

  // Slots: mechanical whir + click
  slotSpin: [
    { freq: 200, dur: 0.60, type: 'sawtooth', gain: 0.05, slide: 480 },
    { freq: 400, dur: 0.60, type: 'sawtooth', gain: 0.03, slide: 300 },
  ],
  slotStop: [
    { freq: 300, dur: 0.08, type: 'square',   gain: 0.06, slide: 170 },
    { freq: 150, dur: 0.11, type: 'triangle', gain: 0.06, delay: 8 },
  ],
  wheelTick: [{ freq: 900, dur: 0.025, type: 'square', gain: 0.045, slide: 560 }],

  // Micro details
  scratch:  [{ freq: 2400, dur: 0.03, type: 'sawtooth', gain: 0.025 }],

  // Notifications: friendly, not intrusive
  notify: [
    { freq: 880,   dur: 0.10, type: 'sine', gain: 0.07 },
    { freq: 1174,  dur: 0.14, type: 'sine', gain: 0.07, delay: 80 },
    { freq: 1568,  dur: 0.18, type: 'sine', gain: 0.05, delay: 160 },
  ],
  friendJoin: [
    { freq: 660,  dur: 0.14, type: 'sine', gain: 0.09 },
    { freq: 880,  dur: 0.14, type: 'sine', gain: 0.09, delay: 90 },
    { freq: 1174, dur: 0.20, type: 'sine', gain: 0.08, delay: 170 },
  ],

  // Room / vault: low, cinematic
  door: [
    { freq: 110, dur: 0.60, type: 'sawtooth', gain: 0.07, slide: 55 },
    { freq: 55,  dur: 0.80, type: 'sine',     gain: 0.05, delay: 100 },
  ],
  vault: [
    { freq: 160, dur: 0.16, type: 'square',   gain: 0.07 },
    { freq: 120, dur: 0.50, type: 'sawtooth', gain: 0.06, delay: 180, slide: 70 },
    { freq: 240, dur: 0.30, type: 'sine',     gain: 0.05, delay: 350 },
  ],

  // Level up: heroic fanfare
  levelUp: [
    { freq: 392.0, dur: 0.22, type: 'sine', gain: 0.11 },                       // G4
    { freq: 523.25, dur: 0.22, type: 'sine', gain: 0.11, delay: 90 },           // C5
    { freq: 659.25, dur: 0.22, type: 'sine', gain: 0.11, delay: 180 },          // E5
    { freq: 987.77, dur: 0.42, type: 'sine', gain: 0.12, delay: 270 },          // B5
    { freq: 1318.5, dur: 0.60, type: 'sine', gain: 0.10, delay: 380 },          // E6
  ],

  error: [
    { freq: 200, dur: 0.18, type: 'square', gain: 0.06, slide: 130 },
    { freq: 130, dur: 0.16, type: 'square', gain: 0.05, delay: 60, slide: 100 },
  ],
};

/** Which sfx get a filtered-noise transient layered on top for physical realism. */
const NOISE_TRANSIENT: Partial<Record<Sfx, { dur: number; gain: number; cutoff: number }>> = {
  card:     { dur: 0.07, gain: 0.09, cutoff: 7000 },
  cardFlip: { dur: 0.11, gain: 0.10, cutoff: 6000 },
  chip:     { dur: 0.03, gain: 0.11, cutoff: 3800 },
  chipStack:{ dur: 0.03, gain: 0.09, cutoff: 3600 },
  coin:     { dur: 0.03, gain: 0.05, cutoff: 8000 },
  coinLand: { dur: 0.05, gain: 0.09, cutoff: 4500 },
  dice:     { dur: 0.03, gain: 0.10, cutoff: 4000 },
  slotStop: { dur: 0.05, gain: 0.07, cutoff: 2600 },
  wheelTick:{ dur: 0.02, gain: 0.05, cutoff: 3500 },
  door:     { dur: 0.10, gain: 0.04, cutoff: 800 },
  vault:    { dur: 0.06, gain: 0.05, cutoff: 1500 },
  scratch:  { dur: 0.10, gain: 0.10, cutoff: 6000 },
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private buses: Partial<Record<Bus, GainNode>> = {};
  /** Shared convolution reverb — one node for the whole app, cheap. */
  private reverb: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private musicTimer: number | null = null;
  private musicNextTime = 0;
  private musicStep = 0;
  private ambientNodes: AudioScheduledSourceNode[] = [];
  private levels: Record<Bus, number> = { master: 0.7, music: 0.35, sfx: 0.8, ambient: 0.4 };
  private started = false;
  private zone: 'hub' | 'blackjack' | 'slots' | 'vault' = 'hub';
  /** Cached noise buffer so short transients don't re-allocate. */
  private noiseBuffer: AudioBuffer | null = null;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    const master = this.ctx.createGain();
    master.gain.value = this.levels.master;
    master.connect(this.ctx.destination);
    this.buses.master = master;
    (['music', 'sfx', 'ambient'] as Bus[]).forEach((bus) => {
      const node = this.ctx!.createGain();
      node.gain.value = this.levels[bus];
      node.connect(master);
      this.buses[bus] = node;
    });

    // Build the shared reverb: sfx and music send to it, ambient does not.
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.buildImpulseResponse(this.ctx, 1.4, 2.2);
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = 0.14;
    this.reverb.connect(this.reverbSend);
    this.reverbSend.connect(master);

    // Cache white noise for transients (0.5s is plenty — we only use ~0.05s slices)
    const noiseLen = this.ctx.sampleRate * 0.5;
    this.noiseBuffer = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;

    return this.ctx;
  }

  /** Small-room impulse response for the reverb send. */
  private buildImpulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = rate * seconds;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Exponentially decaying stereo noise
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'running') { this.started = true; return; }
    void ctx.resume().then(() => { this.started = ctx.state === 'running'; }).catch(() => {});
  }

  get ready() {
    return this.started && this.ctx?.state === 'running';
  }

  setLevel(bus: Bus, value: number) {
    this.levels[bus] = value;
    const node = this.buses[bus];
    if (node && this.ctx) node.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
  }

  getLevel(bus: Bus) {
    return this.levels[bus];
  }

  setZone(zone: 'hub' | 'blackjack' | 'slots' | 'vault') {
    this.zone = zone;
  }

  private zoneGain(name: Sfx) {
    const near: Record<string, string[]> = {
      blackjack: ['card', 'cardFlip', 'chip', 'chipStack', 'blackjack'],
      slots: ['slotSpin', 'slotStop', 'wheelTick'],
      vault: ['vault', 'door'],
      hub: [],
    };
    return near[this.zone]?.includes(name) ? 1.15 : 1;
  }

  /** How much reverb to mix in per sound. Some sounds want none. */
  private reverbAmount(name: Sfx): number {
    const dry: Sfx[] = ['hover', 'click', 'back', 'wheelTick', 'scratch'];
    if (dry.includes(name)) return 0;
    const heavy: Sfx[] = ['bigWin', 'blackjack', 'levelUp', 'door', 'vault', 'coinLand', 'win'];
    if (heavy.includes(name)) return 1;
    return 0.55;
  }

  /** Emit a short filtered-noise burst for object impact sounds. */
  private noiseHit(at: number, dur: number, level: number, cutoff: number, sendReverb: number) {
    const ctx = this.ctx;
    const bus = this.buses.sfx;
    if (!ctx || !bus || !this.noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    if (sendReverb > 0 && this.reverb) {
      const send = ctx.createGain();
      send.gain.value = sendReverb * 0.4;
      gain.connect(send);
      send.connect(this.reverb);
    }
    source.start(at);
    source.stop(at + dur + 0.02);
  }

  play(name: Sfx, options?: { gain?: number }) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => { this.started = ctx.state === 'running'; }).catch(() => {});
      return;
    }
    this.started = true;
    const bus = this.buses.sfx;
    if (!bus) return;
    const zone = this.zoneGain(name);
    const sendAmount = this.reverbAmount(name);
    VOICES[name].forEach((voice) => {
      const at = ctx.currentTime + (voice.delay ?? 0) / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = voice.type;
      osc.frequency.setValueAtTime(voice.freq, at);
      if (voice.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, voice.slide), at + voice.dur);
      const peak = voice.gain * (options?.gain ?? 1) * zone;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(peak, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + voice.dur);
      osc.connect(gain);
      gain.connect(bus);
      // Reverb send
      if (sendAmount > 0 && this.reverb) {
        const send = ctx.createGain();
        send.gain.value = sendAmount * 0.5;
        gain.connect(send);
        send.connect(this.reverb);
      }
      osc.start(at);
      osc.stop(at + voice.dur + 0.03);
    });

    // Optional noise transient for object/impact sounds
    const noise = NOISE_TRANSIENT[name];
    if (noise) {
      this.noiseHit(
        ctx.currentTime,
        noise.dur,
        noise.gain * (options?.gain ?? 1) * zone,
        noise.cutoff,
        sendAmount,
      );
    }
  }

  duck(ms = 1400) {
    const ctx = this.ensure();
    const music = this.buses.music;
    if (!ctx || !music) return;
    const now = ctx.currentTime;
    music.gain.cancelScheduledValues(now);
    music.gain.setTargetAtTime(this.levels.music * 0.25, now, 0.08);
    music.gain.setTargetAtTime(this.levels.music, now + ms / 1000, 0.4);
  }

  private noteAt(midi: number) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  /** One plucked voice: two slightly detuned oscillators through a decay envelope. */
  private pluck(at: number, midi: number, seconds: number, level: number, type: OscillatorType = 'triangle') {
    const ctx = this.ctx;
    const bus = this.buses.music;
    if (!ctx || !bus) return;

    const freq = this.noteAt(midi);
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, at);
    filter.frequency.exponentialRampToValueAtTime(650, at + seconds);
    filter.Q.value = 0.7;

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);

    filter.connect(gain);
    gain.connect(bus);

    // Slight reverb send for depth
    if (this.reverb) {
      const send = ctx.createGain();
      send.gain.value = 0.18;
      gain.connect(send);
      send.connect(this.reverb);
    }

    [-6, 0, 6].forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(at);
      osc.stop(at + seconds + 0.05);
    });
  }

  /* An eight-bar lounge round in A minor — a ii–V–i circle that drifts through
     the relative major before coming home:
       Am7 · Dm7 · G7 · Cmaj7 · Fmaj7 · Bm7b5 · E7 · Am7
     Each bar carries a bass root (+ a passing tone), an arpeggio of the chord
     tones, and a sustained pad underneath for depth. */
  private static readonly PROGRESSION: { bass: number; chord: number[]; pad: number[] }[] = [
    { bass: 45, chord: [57, 60, 64, 67], pad: [57, 64, 72] },   // Am7
    { bass: 50, chord: [62, 65, 69, 72], pad: [62, 69, 77] },   // Dm7
    { bass: 43, chord: [55, 59, 62, 65], pad: [55, 62, 71] },   // G7
    { bass: 48, chord: [60, 64, 67, 71], pad: [60, 67, 76] },   // Cmaj7
    { bass: 41, chord: [53, 57, 60, 64], pad: [53, 60, 69] },   // Fmaj7
    { bass: 47, chord: [59, 62, 65, 69], pad: [59, 65, 74] },   // Bm7b5
    { bass: 40, chord: [56, 59, 63, 66], pad: [52, 59, 68] },   // E7
    { bass: 45, chord: [57, 60, 64, 67], pad: [57, 64, 72] },   // Am7
  ];

  /** Soft sustained chord bed: a few detuned oscillators under a long attack. */
  private pad(at: number, midis: number[], seconds: number, level: number) {
    const ctx = this.ctx;
    const bus = this.buses.music;
    if (!ctx || !bus) return;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    filter.connect(gain);
    gain.connect(bus);
    if (this.reverb) {
      const send = ctx.createGain();
      send.gain.value = 0.22;
      gain.connect(send);
      send.connect(this.reverb);
    }
    midis.forEach((midi, i) => {
      [-7, 7].forEach((detune) => {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = this.noteAt(midi);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(at);
        osc.stop(at + seconds + 0.05);
      });
    });
  }

  /** Schedules any notes that fall inside the lookahead window. */
  private pumpMusic() {
    const ctx = this.ctx;
    if (!ctx || this.musicTimer === null) return;
    const beat = 60 / 72;          // 72 BPM — slow lounge
    const step = beat / 2;         // eighth notes
    const lookahead = 0.7;
    const loopLen = AudioManager.PROGRESSION.length;

    while (this.musicNextTime < ctx.currentTime + lookahead) {
      const at = this.musicNextTime;
      const stepInBar = this.musicStep % 8;
      const barCount = Math.floor(this.musicStep / 8);
      const bar = barCount % loopLen;
      const { bass, chord, pad } = AudioManager.PROGRESSION[bar];

      // Every second pass through the round plays a touch brighter/busier.
      const round = Math.floor(barCount / loopLen);
      const lively = round % 2 === 1;
      // Zone colour: the slots floor is a hair louder/brighter, the vault mellow.
      const zoneVel = this.zone === 'slots' ? 1.1 : this.zone === 'vault' ? 0.8 : 1;
      const vel = (lively ? 1.15 : 1) * zoneVel;
      const isLastBar = bar === loopLen - 1;

      // Sustained pad — once per bar, carried across it
      if (stepInBar === 0) this.pad(at, pad, beat * 3.2, 0.045 * vel);

      // Bass: root on beat 1, fifth on beat 3, passing tone into the next bar
      if (stepInBar === 0) this.pluck(at, bass, beat * 2.4, 0.18 * vel, 'sine');
      if (stepInBar === 4) this.pluck(at, bass + 7, beat * 1.4, 0.10 * vel, 'sine');
      if (stepInBar === 7) {
        const next = AudioManager.PROGRESSION[(bar + 1) % loopLen].bass;
        const passing = bass + Math.sign(next - bass || 1) * 2;
        this.pluck(at, passing, beat * 0.7, 0.09, 'sine');
      }

      // Arpeggio on off-eighths (denser on the lively round)
      if (stepInBar % 2 === 0 || (lively && stepInBar % 2 === 1)) {
        const note = chord[(this.musicStep / 2 | 0) % chord.length];
        this.pluck(at, note, beat * 1.2, 0.08 * vel);
      }

      // Sparkle: octave note on the back half of every other bar
      if (stepInBar === 6 && bar % 2 === 1) {
        this.pluck(at, chord[chord.length - 1] + 12, beat * 0.9, 0.06);
      }

      // Countermelody: soft top note on beat 3 of the home bar
      if (isLastBar && stepInBar === 4) {
        this.pluck(at, chord[2] + 12, beat * 1.8, 0.05, 'sine');
      }

      // Turnaround fill: a quick three-note run on the last two eighths
      if (isLastBar && (stepInBar === 6 || stepInBar === 7)) {
        this.pluck(at, chord[stepInBar === 6 ? 1 : 3] + 12, beat * 0.5, 0.05);
      }

      this.musicNextTime += step;
      this.musicStep += 1;
    }
  }

  startMusic() {
    const ctx = this.ensure();
    const bus = this.buses.music;
    if (!ctx || !bus || this.musicTimer !== null) return;
    this.musicStep = 0;
    this.musicNextTime = ctx.currentTime + 0.12;
    this.pumpMusic();
    this.musicTimer = window.setInterval(() => this.pumpMusic(), 120);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicNodes.forEach(({ osc }) => { try { osc.stop(); } catch { /* already stopped */ } });
    this.musicNodes = [];
  }

  /** Filtered noise: the distant hum of a busy room, in two layers —
      a low steady rumble plus a slow-breathing "murmur" band that drifts
      in and out so the room never sounds perfectly static. */
  startAmbient() {
    const ctx = this.ensure();
    const bus = this.buses.ambient;
    if (!ctx || !bus || this.ambientNodes.length) return;

    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;

    // Layer 1 — low room rumble
    const rumble = ctx.createBufferSource();
    rumble.buffer = buffer;
    rumble.loop = true;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 320;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.045;
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(bus);
    rumble.start();

    // Layer 2 — a narrow mid band standing in for a crowd murmur, its level
    // swept by a very slow LFO
    const murmur = ctx.createBufferSource();
    murmur.buffer = buffer;
    murmur.loop = true;
    const murmurFilter = ctx.createBiquadFilter();
    murmurFilter.type = 'bandpass';
    murmurFilter.frequency.value = 620;
    murmurFilter.Q.value = 1.4;
    const murmurGain = ctx.createGain();
    murmurGain.gain.value = 0.018;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(murmurGain.gain);
    murmur.connect(murmurFilter);
    murmurFilter.connect(murmurGain);
    murmurGain.connect(bus);
    murmur.start();
    lfo.start();

    this.ambientNodes = [rumble, murmur, lfo];
  }

  stopAmbient() {
    this.ambientNodes.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } });
    this.ambientNodes = [];
  }
}

export const audio = new AudioManager();
