import { useGame } from '../state/useGame'

const STYLE = {
  win: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200',
  blackjack: 'border-gold/60 bg-gold/25 text-gold',
  lose: 'border-rose-400/50 bg-rose-500/20 text-rose-200',
  push: 'border-sky-400/50 bg-sky-500/20 text-sky-200',
  info: 'border-white/20 bg-white/10 text-white/90',
} as const

export default function Toast() {
  const toast = useGame(s => s.toast)
  if (!toast) return null

  return (
    <div
      className={`animate-[fadeIn_.2s_ease-out] rounded-2xl border px-7 py-3 font-display text-2xl font-bold backdrop-blur ${STYLE[toast.kind]}`}
    >
      {toast.text}
    </div>
  )
}
