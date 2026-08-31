import { useEffect, useState } from 'react'
import { useDiamonds } from '../state/useDiamonds'

/**
 * Brief celebratory toast when a rare on-win diamond drop lands. Follows the
 * split show/hide effect pattern so the auto-hide timer isn't cleared by the
 * re-render that shows it.
 */
export default function DiamondDropToast() {
  const drop = useDiamonds(s => s.recentDrop)
  const consume = useDiamonds(s => s.consumeDrop)
  const [shown, setShown] = useState<number | null>(null)

  // Show effect: a new drop appears → capture it and clear the store flag.
  useEffect(() => {
    if (!drop) return
    setShown(drop.amount)
    consume()
  }, [drop, consume])

  // Hide effect: keyed only on `shown` so its timer isn't torn down early.
  useEffect(() => {
    if (shown === null) return
    const id = setTimeout(() => setShown(null), 2600)
    return () => clearTimeout(id)
  }, [shown])

  if (shown === null) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-[70] flex justify-center" dir="rtl">
      <div
        className="flex items-center gap-2 rounded-full border border-sky-300/40 bg-[#0b1220]/90 px-5 py-2.5 shadow-2xl backdrop-blur"
        style={{ animation: 'floatUp .3s ease-out' }}
      >
        <span className="text-2xl">💎</span>
        <span className="font-display text-lg font-bold text-sky-300">
          זכית ב־{shown} {shown === 1 ? 'יהלום' : 'יהלומים'}!
        </span>
      </div>
    </div>
  )
}
