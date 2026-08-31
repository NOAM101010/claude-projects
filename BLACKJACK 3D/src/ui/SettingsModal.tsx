import { useState } from 'react'
import { Speed, useSettings } from '../state/useSettings'
import { useWallet } from '../state/useWallet'
import { DEFAULT_RULES } from '../engine/types'
import StatsPanel from './StatsPanel'
import { t } from '../i18n/he'

const SPEEDS: { key: Speed; label: string }[] = [
  { key: 'slow', label: t('slow') },
  { key: 'normal', label: t('normal') },
  { key: 'fast', label: t('fast') },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gold/70">{title}</h3>
      {children}
    </section>
  )
}

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-right transition hover:bg-white/10"
    >
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-white/20'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-0.5' : 'left-[22px]'}`}
        />
      </span>
      <span>
        <span className="block font-bold text-white">{label}</span>
        {hint && <span className="block text-xs text-white/45">{hint}</span>}
      </span>
    </button>
  )
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const muted = useSettings(s => s.muted)
  const volume = useSettings(s => s.volume)
  const musicOn = useSettings(s => s.musicOn)
  const voiceOn = useSettings(s => s.voiceOn)
  const speed = useSettings(s => s.speed)
  const trainerMode = useSettings(s => s.trainerMode)
  const setMutedPref = useSettings(s => s.setMutedPref)
  const setVolumePref = useSettings(s => s.setVolumePref)
  const setMusicOn = useSettings(s => s.setMusicOn)
  const setVoiceOn = useSettings(s => s.setVoiceOn)
  const setSpeed = useSettings(s => s.setSpeed)
  const setTrainerMode = useSettings(s => s.setTrainerMode)
  const resetWallet = useWallet(s => s.reset)

  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-gold/25 bg-[#0d1117] p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-gold">{t('settings')}</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            {t('close')}
          </button>
        </div>

        <div className="space-y-6">
          <Section title={t('sound')}>
            <Toggle checked={!muted} onChange={v => setMutedPref(!v)} label={muted ? t('muted') : t('sound')} />
            <Toggle checked={musicOn} onChange={setMusicOn} label={t('music')} />
            <Toggle checked={voiceOn} onChange={setVoiceOn} label={t('dealerVoice')} />
            <div className="rounded-xl bg-white/5 px-4 py-3">
              <div className="mb-2 flex justify-between text-sm">
                <span className="tabular-nums text-white/50">{Math.round(volume * 100)}%</span>
                <span className="font-bold text-white">{t('volume')}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                disabled={muted}
                onChange={e => setVolumePref(Number(e.target.value))}
                className="w-full accent-yellow-500 disabled:opacity-40"
              />
            </div>
          </Section>

          <Section title={t('speed')}>
            <div className="grid grid-cols-3 gap-2">
              {SPEEDS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSpeed(s.key)}
                  className={`rounded-xl px-3 py-2.5 font-bold transition ${
                    speed === s.key ? 'bg-gold text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title={t('trainer')}>
            <Toggle
              checked={trainerMode}
              onChange={setTrainerMode}
              label={t('trainer')}
              hint={t('trainerHint')}
            />
          </Section>

          <Section title={t('stats')}>
            <StatsPanel />
          </Section>

          <Section title={t('tableRules')}>
            <ul className="space-y-1 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/70">
              <li>{DEFAULT_RULES.decks} חבילות</li>
              <li>הדילר {DEFAULT_RULES.dealerHitsSoft17 ? 'לוקח' : 'עוצר על'} 17 רך</li>
              <li>בלאק ג'ק משלם {DEFAULT_RULES.blackjackPayout === 1.5 ? '3:2' : `${DEFAULT_RULES.blackjackPayout}:1`}</li>
              <li>ביטוח משלם {DEFAULT_RULES.insurancePayout}:1</li>
              <li>עד {DEFAULT_RULES.maxSplits + 1} ידיים בפיצול</li>
              <li>{DEFAULT_RULES.doubleAfterSplit ? 'מותר' : 'אסור'} להכפיל אחרי פיצול</li>
              <li>{DEFAULT_RULES.surrenderAllowed ? 'מותר' : 'אסור'} לוותר</li>
            </ul>
          </Section>

          <Section title={t('resetBalance')}>
            {confirmReset ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    resetWallet()
                    setConfirmReset(false)
                    onClose()
                  }}
                  className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 font-bold text-white transition hover:brightness-110"
                >
                  אפס הכל
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 font-bold text-white transition hover:bg-white/20"
                >
                  ביטול
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="w-full rounded-xl bg-white/5 px-4 py-2.5 font-bold text-white/70 transition hover:bg-white/10"
              >
                {t('resetBalance')}
              </button>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
