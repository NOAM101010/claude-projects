type Sfx = 'deal' | 'chip' | 'win' | 'lose' | 'shuffle'

let ctx: AudioContext | null = null
let muted = false
let volume = 0.7

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function setMuted(v: boolean) {
  muted = v
}

export function isMuted() {
  return muted
}

export function setVolume(v: number) {
  volume = Math.min(Math.max(v, 0), 1)
}

export function getVolume() {
  return volume
}

const RECIPES: Record<Sfx, { freq: number; dur: number; type: OscillatorType; sweep?: number; noise?: boolean }> = {
  deal: { freq: 320, dur: 0.09, type: 'triangle', sweep: 140, noise: true },
  chip: { freq: 900, dur: 0.07, type: 'square', sweep: 600 },
  win: { freq: 523, dur: 0.35, type: 'sine', sweep: 1046 },
  lose: { freq: 260, dur: 0.32, type: 'sawtooth', sweep: 110 },
  shuffle: { freq: 180, dur: 0.5, type: 'triangle', noise: true },
}

export function playSfx(name: Sfx) {
  if (muted || volume <= 0) return
  try {
    const a = audio()
    const r = RECIPES[name]
    const now = a.currentTime
    const gain = a.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.18 * volume, 0.0002), now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + r.dur)
    gain.connect(a.destination)

    const osc = a.createOscillator()
    osc.type = r.type
    osc.frequency.setValueAtTime(r.freq, now)
    if (r.sweep) osc.frequency.exponentialRampToValueAtTime(r.sweep, now + r.dur)
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + r.dur)

    if (r.noise) {
      const buf = a.createBuffer(1, a.sampleRate * r.dur, a.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
      const src = a.createBufferSource()
      src.buffer = buf
      const ng = a.createGain()
      ng.gain.value = 0.06 * volume
      src.connect(ng).connect(a.destination)
      src.start(now)
    }
  } catch {
    // audio unavailable — silent
  }
}
