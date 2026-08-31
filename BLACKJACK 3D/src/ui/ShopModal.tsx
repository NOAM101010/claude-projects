import { useEffect, useState } from 'react'
import { CHIP_PACKS, useCashier, formatCooldown } from '../state/useCashier'
import { usePiggyBank, PIGGY_CAP } from '../state/usePiggyBank'
import { POWERUPS, usePowerups } from '../state/usePowerups'
import { useProgress } from '../progression/useProgress'
import { playSfx } from '../audio/sfx'
import { t } from '../i18n/he'

export default function ShopModal({ onClose }: { onClose: () => void }) {
  const claims = useCashier(s => s.claims)
  const claim = useCashier(s => s.claim)
  const level = useProgress(s => s.level())
  const saved = usePiggyBank(s => s.saved)
  const breakPiggy = usePiggyBank(s => s.break)
  const buyPowerup = usePowerups(s => s.buy)
  const xp2xRounds = usePowerups(s => s.xp2xRounds)
  const [, force] = useState(0)

  // Tick every second so the countdowns update.
  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const now = Date.now()

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-gold/25 bg-[#0d0a12] p-6 shadow-2xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-gold">{t('shop')}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white">
            {t('close')}
          </button>
        </div>
        <p className="mb-4 text-xs text-white/40">{t('shopHint')}</p>

        <div className="grid grid-cols-2 gap-3">
          {CHIP_PACKS.map(pack => {
            const locked = level < pack.unlockLevel
            const last = claims[pack.id] ?? 0
            const remaining = Math.max(0, pack.cooldownMs - (now - last))
            const ready = !locked && remaining === 0

            return (
              <div
                key={pack.id}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center ${
                  ready ? 'border-gold/50 bg-gradient-to-b from-[#1a1206] to-black' : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="text-4xl">{pack.emoji}</div>
                <div className="font-display text-lg font-bold text-white">{pack.name}</div>
                <div className="lux-gold-text font-display text-xl font-bold tabular-nums">
                  {pack.amount.toLocaleString('he-IL')}
                </div>

                {locked ? (
                  <div className="rounded-full bg-black/50 px-3 py-1 text-xs text-white/60">
                    🔒 {t('unlockAtLevel')} {pack.unlockLevel}
                  </div>
                ) : ready ? (
                  <button
                    onClick={() => {
                      if (claim(pack.id)) {
                        playSfx('win')
                        force(n => n + 1)
                      }
                    }}
                    className="lux-gold w-full rounded-xl px-3 py-2 text-sm font-bold"
                  >
                    {t('claim')}
                  </button>
                ) : (
                  <div className="w-full rounded-xl bg-black/40 px-3 py-2 text-sm font-bold tabular-nums text-white/50">
                    {formatCooldown(remaining)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Piggy bank */}
        <div className="mt-5 rounded-2xl border border-pink-400/30 bg-pink-500/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-lg font-bold text-pink-200">🐷 קופת חיסכון</span>
            <span className="font-display text-lg font-bold text-white tabular-nums">
              {saved.toLocaleString('he-IL')}
            </span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-pink-400" style={{ width: `${Math.min(100, (saved / PIGGY_CAP) * 100)}%` }} />
          </div>
          <button
            onClick={() => { if (breakPiggy() > 0) { playSfx('win'); force(n => n + 1) } }}
            disabled={saved <= 0}
            className="lux-gold w-full rounded-xl py-2 text-sm font-bold disabled:opacity-40"
          >
            שבור וקבל
          </button>
        </div>

        {/* Power-ups */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gold/70">
            <span>פאוור-אפים</span>
            {xp2xRounds > 0 && <span className="text-emerald-300">⚡ XP×2 · {xp2xRounds} סיבובים</span>}
          </div>
          <div className="space-y-2">
            {POWERUPS.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                <span className="text-2xl">{p.emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">{p.name}</div>
                  <div className="text-[11px] text-white/50">{p.desc}</div>
                </div>
                <button
                  onClick={() => { if (buyPowerup(p.id)) { playSfx('chip'); force(n => n + 1) } }}
                  className="rounded-lg bg-gold/90 px-3 py-1.5 text-xs font-bold text-black transition hover:brightness-110"
                >
                  {p.costDiamonds > 0 ? `${p.costDiamonds} 💎` : `${(p.costChips / 1000)}K 🪙`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
