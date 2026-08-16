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

  // Card flips: crisp riffle
  card:     [{ freq: 1800, dur: 0.06, type: 'triangle', gain: 0.10, slide: 900 }],
  cardFlip: [
    { freq: 1400, dur: 0.05, type: 'triangle', gain: 0.09, slide: 700 },
    { freq: 900,  dur: 0.10, type: 'triangle', gain: 0.07, delay: 40, slide: 500 },
  ],

  // Chips: two-tone thock (the noise transient in play() adds the "clay" edge)
  chip: [
    { freq: 620, dur: 0.10, type: 'triangle', gain: 0.09, slide: 260 },
    { freq: 380, dur: 0.09, type: 'sine',     gain: 0.05, delay: 30, slide: 240 },
  ],
  chipStack: [
    { freq: 620, dur: 0.09, type: 'triangle', gain: 0.07 },
    { freq: 560, dur: 0.09, type: 'triangle', gain: 0.07, delay: 55 },
    { freq: 500, dur: 0.10, type: 'triangle', gain: 0.07, delay: 115 },
    { freq: 440, dur: 0.11, type: 'triangle', gain: 0.06, delay: 175 },
  ],

  // Wins: major triad → octave, with a shimmering tail added in play()
  win: [
    { freq: 523.25, dur: 0.28, type: 'triangle', gain: 0.13 },                  // C5
    { freq: 659.25, dur: 0.28, type: 'triangle', gain: 0.13, delay: 90 },       // E5
    { freq: 783.99, dur: 0.36, type: 'triangle', gain: 0.13, delay: 180 },      // G5
  ],
  bigWin: [
    { freq: 523.25, dur: 0.30, type: 'triangle', gain: 0.13 },
    { freq: 659.25, dur: 0.30, type: 'triangle', gain: 0.13, delay: 90 },
    { freq: 783.99, dur: 0.30, type: 'triangle', gain: 0.13, delay: 180 },
    { freq: 1046.5, dur: 0.44, type: 'sine',     gain: 0.14, delay: 300 },      // C6
    { freq: 1318.5, dur: 0.60, type: 'sine',     gain: 0.11, delay: 380 },      // E6
  ],

  // Losses: muted downward sweep — sad, not painful
  lose: [
    { freq: 330, dur: 0.36, type: 'sine',     gain: 0.09, slide: 140 },
    { freq: 220, dur: 0.28, type: 'triangle', gain: 0.05, delay: 60, slide: 110 },
  ],
  bust: [
    { freq: 260, dur: 0.40, type: 'sawtooth', gain: 0.08, slide: 90 },
    { freq: 180, dur: 0.36, type: 'sawtooth', gain: 0.05, delay: 40, slide: 70 },
  ],
  push: [
    { freq: 440, dur: 0.14, type: 'sine',     gain: 0.06 },
    { freq: 440, dur: 0.14, type: 'sine',     gain: 0.05, delay: 100 },
  ],

  // Blackjack: dramatic ascending arpeggio
  blackjack: [
    { freq: 523.25, dur: 0.20, type: 'triangle', gain: 0.13 },                  // C5
    { freq: 659.25, dur: 0.20, type: 'triangle', gain: 0.13, delay: 70 },       // E5
    { freq: 783.99, dur: 0.24, type: 'triangle', gain: 0.13, delay: 140 },      // G5
    { freq: 1046.5, dur: 0.28, type: 'triangle', gain: 0.13, delay: 220 },      // C6
    { freq: 1568.0, dur: 0.55, type: 'sine',     gain: 0.12, delay: 320 },      // G6 (fifth on top)
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
    { freq: 620, dur: 0.10, type: 'square',   gain: 0.08, slide: 320 },
    { freq: 220, dur: 0.08, type: 'triangle', gain: 0.05, delay: 20 },
  ],
  wheelTick: [{ freq: 1400, dur: 0.03, type: 'square', gain: 0.05 }],

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
  card:     { dur: 0.05, gain: 0.06, cutoff: 6000 },
  cardFlip: { dur: 0.08, gain: 0.07, cutoff: 5500 },
  chip:     { dur: 0.04, gain: 0.08, cutoff: 3000 },
  chipStack:{ dur: 0.04, gain: 0.07, cutoff: 3000 },
  coin:     { dur: 0.03, gain: 0.05, cutoff: 8000 },
  coinLand: { dur: 0.05, gain: 0.09, cutoff: 4500 },
  dice:     { dur: 0.03, gain: 0.10, cutoff: 4000 },
  slotStop: { dur: 0.04, gain: 0.06, cutoff: 5000 },
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
  private ambientNode: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
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

  /* A minor lounge loop: Am7 · Dm7 · G7 · Cmaj7. Bass root, then the chord
     tones arpeggiated across the bar. */
  private static readonly PROGRESSION: { bass: number; chord: number[] }[] = [
    { bass: 45, chord: [57, 60, 64, 67] },   // Am7
    { bass: 50, chord: [62, 65, 69, 72] },   // Dm7
    { bass: 43, chord: [55, 59, 62, 65] },   // G7
    { bass: 48, chord: [60, 64, 67, 71] },   // Cmaj7
  ];

  /** Schedules any notes that fall inside the lookahead window. */
  private pumpMusic() {
    const ctx = this.ctx;
    if (!ctx || this.musicTimer === null) return;
    const beat = 60 / 72;          // 72 BPM — slow lounge
    const step = beat / 2;         // eighth notes
    const lookahead = 0.7;

    while (this.musicNextTime < ctx.currentTime + lookahead) {
      const at = this.musicNextTime;
      const stepInBar = this.musicStep % 8;
      const bar = Math.floor(this.musicStep / 8) % AudioManager.PROGRESSION.length;
      const { bass, chord } = AudioManager.PROGRESSION[bar];

      // Bass on beat 1 and beat 3 (walking feel)
      if (stepInBar === 0) this.pluck(at, bass, beat * 2.4, 0.18, 'sine');
      if (stepInBar === 4) this.pluck(at, bass + 7, beat * 1.4, 0.10, 'sine');

      // Arpeggio on off-eighths
      if (stepInBar % 2 === 0) {
        const note = chord[(this.musicStep / 2) % chord.length | 0];
        this.pluck(at, note, beat * 1.2, 0.08);
      }

      // Sparkle: octave note every other bar
      if (stepInBar === 6 && bar % 2 === 1) {
        this.pluck(at, chord[chord.length - 1] + 12, beat * 0.9, 0.06);
      }

      // Countermelody: a soft top note on beat 3 of the last bar of the loop
      if (bar === 3 && stepInBar === 4) {
        this.pluck(at, chord[2] + 12, beat * 1.8, 0.05, 'sine');
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

  /** Filtered noise: the distant hum of a busy room. */
  startAmbient() {
    const ctx = this.ensure();
    const bus = this.buses.ambient;
    if (!ctx || !bus || this.ambientNode) return;
    const seconds = 3;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    source.start();
    this.ambientNode = { source, gain };
  }

  stopAmbient() {
    this.ambientNode?.source.stop();
    this.ambientNode = null;
  }
}

export const audio = new AudioManager();
