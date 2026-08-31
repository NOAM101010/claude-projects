import { useEffect, useState } from 'react'
import { useApp } from '../state/useApp'
import { useProgress } from '../progression/useProgress'
import { useSettings } from '../state/useSettings'
import { startMusic } from '../audio/music'
import { initVoice } from '../audio/voice'
import { t } from '../i18n/he'

const SUITS = ['♠', '♥', '♦', '♣']

/** Cinematic, branded entry screen. Captures the player's name on first run. */
export default function SplashScreen() {
  const dismiss = useApp(s => s.dismissSplash)
  const name = useProgress(s => s.name)
  const setName = useProgress(s => s.setName)
  const [draft, setDraft] = useState(name)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setShow(true), 80)
    return () => clearTimeout(id)
  }, [])

  const enter = () => {
    if (draft.trim()) setName(draft.trim())
    // This click is a user gesture — the only moment WebAudio/TTS may start.
    if (useSettings.getState().musicOn) startMusic()
    initVoice()
    dismiss()
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center overflow-hidden bg-[#080506]">
      {/* Ambient gold aura + vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 34%, rgba(212,175,55,0.20), transparent 58%)' }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: 'inset 0 0 220px 60px rgba(0,0,0,0.9)' }}
      />

      {/* Faint drifting suit marks */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {SUITS.map((s, i) => (
          <div
            key={i}
            className="absolute text-white/[0.03]"
            style={{
              fontSize: `${140 + i * 40}px`,
              left: `${12 + i * 22}%`,
              top: `${i % 2 ? 8 : 55}%`,
              transform: `rotate(${i * 18 - 20}deg)`,
            }}
          >
            {s}
          </div>
        ))}
      </div>

      <div
        className={`relative flex flex-col items-center gap-7 px-8 transition-all duration-1000 ${
          show ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        {/* Crest */}
        <div className="relative">
          <div className="absolute inset-0 -z-10 blur-2xl" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.5), transparent 70%)' }} />
          <div className="flex items-center gap-3 text-5xl text-gold/80">
            <span className="opacity-50">♣</span>
            <span className="text-6xl">♠</span>
            <span className="opacity-50">♦</span>
          </div>
        </div>

        <div className="text-center">
          <h1 className="lux-shimmer font-display text-6xl font-bold tracking-[0.16em] sm:text-7xl">
            {t('brand')}
          </h1>
          <div className="mx-auto mt-3 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold/60" />
            <span className="text-xs tracking-[0.42em] text-gold/60">{t('brandTagline')}</span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-gold/60" />
          </div>
        </div>

        <div className="mt-2 flex w-80 flex-col gap-3">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enter()}
            placeholder={t('yourName')}
            maxLength={16}
            dir="rtl"
            className="lux-glass rounded-2xl px-5 py-3.5 text-center text-lg text-white outline-none transition focus:border-gold/70"
          />
          <button
            onClick={enter}
            className="lux-gold rounded-2xl px-6 py-4 font-display text-lg font-bold tracking-widest transition"
          >
            {t('enter')}
          </button>
        </div>
      </div>

      <div className="absolute bottom-7 flex gap-4 text-lg tracking-[0.3em] text-gold/25">
        {SUITS.map(s => <span key={s}>{s}</span>)}
      </div>
    </div>
  )
}
