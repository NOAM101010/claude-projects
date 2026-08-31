import { getVolume, isMuted } from './sfx'

/**
 * Ambient background music, synthesised with WebAudio (no licensed track — we
 * have no audio asset). A slow lounge pad cycles through a warm chord
 * progression with a soft bass and occasional bell notes. Respects the global
 * mute/volume and its own on/off toggle.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let running = false
let musicEnabled = true
let stepTimer: ReturnType<typeof setInterval> | null = null

// A ii–V–I-ish loop in a warm key (frequencies in Hz, root triads).
const CHORDS: number[][] = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
  [261.63, 329.63, 392.0], // C
]

let step = 0
let voices: { osc: OscillatorNode; gain: GainNode }[] = []

function targetGain(): number {
  if (!musicEnabled || isMuted()) return 0
  return 0.12 * getVolume()
}

function playChord(chord: number[]) {
  if (!ctx || !master) return
  const now = ctx.currentTime

  // Fade out the previous voices.
  for (const v of voices) {
    v.gain.gain.cancelScheduledValues(now)
    v.gain.gain.setTargetAtTime(0, now, 1.1)
    v.osc.stop(now + 3)
  }
  voices = []

  // New pad voices.
  for (const f of chord) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = f
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.gain.setTargetAtTime(0.33, now, 1.4)
    // gentle detune shimmer
    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.value = f * 2.001
    const g2 = ctx.createGain()
    g2.gain.value = 0.08
    osc2.connect(g2).connect(gain)
    osc.connect(gain).connect(master)
    osc.start(now)
    osc2.start(now)
    voices.push({ osc, gain }, { osc: osc2, gain: g2 })
  }

  // Soft bass an octave below the root.
  const bass = ctx.createOscillator()
  bass.type = 'sine'
  bass.frequency.value = chord[0] / 2
  const bg = ctx.createGain()
  bg.gain.value = 0
  bg.gain.setTargetAtTime(0.4, now, 1.2)
  bg.gain.setTargetAtTime(0, now + 3, 1.2)
  bass.connect(bg).connect(master)
  bass.start(now)
  bass.stop(now + 6)
}

function ensureContext() {
  if (ctx) return
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = targetGain()
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
}

/** Starts the loop (call from a user gesture). Safe to call repeatedly. */
export function startMusic() {
  ensureContext()
  if (!ctx || running) return
  running = true
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  playChord(CHORDS[step])
  stepTimer = setInterval(() => {
    step = (step + 1) % CHORDS.length
    playChord(CHORDS[step])
  }, 4200)
}

export function stopMusic() {
  running = false
  if (stepTimer) {
    clearInterval(stepTimer)
    stepTimer = null
  }
  if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
}

export function setMusicEnabled(on: boolean) {
  musicEnabled = on
  if (master && ctx) master.gain.setTargetAtTime(targetGain(), ctx.currentTime, 0.3)
  if (on && !running) startMusic()
}

/** Re-applies volume/mute changes to the running music. */
export function refreshMusicGain() {
  if (master && ctx) master.gain.setTargetAtTime(targetGain(), ctx.currentTime, 0.2)
}

export function isMusicEnabled() {
  return musicEnabled
}
