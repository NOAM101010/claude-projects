import { SYMBOLS } from './engine'
import { useSlots } from './useSlots'

/**
 * Shows what each symbol pays, multiplied by the current bet so the numbers are
 * concrete. Highest-value symbol first.
 */
export default function SlotsPaytable() {
  const bet = useSlots(s => s.bet)
  const ordered = [...SYMBOLS].sort((a, b) => b.three - a.three)

  return (
    <div className="lux-glass w-44 rounded-2xl p-3">
      <div className="mb-2 text-center text-xs font-bold uppercase tracking-[0.18em] text-gold/70">
        טבלת תשלומים
      </div>
      <div className="space-y-1.5">
        {ordered.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5">
            <div className="flex items-center gap-1 text-lg">
              <span>{s.glyph}</span>
              <span>{s.glyph}</span>
              <span>{s.glyph}</span>
            </div>
            <div className="text-left">
              <div className="font-display text-sm font-bold text-gold tabular-nums">
                ×{s.three}
              </div>
              <div className="text-[10px] text-white/40 tabular-nums">
                {(bet * s.three).toLocaleString('he-IL')}
              </div>
            </div>
          </div>
        ))}
        {/* Two-of-a-kind note for the cherry */}
        {SYMBOLS.find(s => s.two > 0) && (
          <div className="mt-1 border-t border-white/10 pt-1.5 text-center text-[10px] text-white/40">
            🍒🍒 = ×{SYMBOLS.find(s => s.two > 0)!.two}
          </div>
        )}
      </div>
    </div>
  )
}
