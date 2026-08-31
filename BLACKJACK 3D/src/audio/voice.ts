import { getVolume, isMuted } from './sfx'

/**
 * Dealer voice via the browser's SpeechSynthesis. No audio asset — quality
 * depends on the device's installed voices. Falls back silently to just the
 * on-screen bubbles when no Hebrew voice (or no TTS) is available.
 */

let enabled = true
let cachedVoice: SpeechSynthesisVoice | null = null
let voiceResolved = false

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
}

function pickVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = s.getVoices()
  if (voices.length === 0) return null
  // Prefer a Hebrew voice, else any voice.
  return voices.find(v => /he|iw/i.test(v.lang)) ?? voices[0]
}

function ensureVoice() {
  const s = synth()
  if (!s || voiceResolved) return
  cachedVoice = pickVoice(s)
  if (cachedVoice) voiceResolved = true
}

export function initVoice() {
  const s = synth()
  if (!s) return
  ensureVoice()
  // Voices often load asynchronously.
  s.onvoiceschanged = () => {
    cachedVoice = pickVoice(s)
    voiceResolved = !!cachedVoice
  }
}

export function setVoiceEnabled(on: boolean) {
  enabled = on
  if (!on) synth()?.cancel()
}

export function isVoiceEnabled() {
  return enabled
}

export function speak(text: string) {
  if (!enabled || isMuted() || getVolume() <= 0) return
  const s = synth()
  if (!s || !text) return
  ensureVoice()
  try {
    s.cancel() // don't stack lines
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'he-IL'
    if (cachedVoice) u.voice = cachedVoice
    u.volume = getVolume()
    u.rate = 1
    u.pitch = 1
    s.speak(u)
  } catch {
    /* TTS unavailable — bubbles still show */
  }
}
