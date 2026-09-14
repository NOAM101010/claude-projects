/**
 * רקע נרות יפניים דקורטיבי **סטטי** (בלי אנימציה, בלי canvas) בהשראת `LaunchScreen`
 * (שם זה canvas מונפש - לא כאן, זה מסך אחר: `AccessCodeGate`). SVG בלבד, מספר קבוע
 * ומגורל-מראש של נרות כדי שיהיה עדין ולא מסיח בזמן שהמשתמש מזין קוד גישה.
 */
const CANDLES = [
  { x: 4, open: 46, close: 38, high: 34, low: 50, up: true },
  { x: 12, open: 40, close: 44, high: 36, low: 48, up: false },
  { x: 20, open: 44, close: 30, high: 26, low: 47, up: true },
  { x: 28, open: 32, close: 36, high: 28, low: 40, up: false },
  { x: 36, open: 36, close: 22, high: 18, low: 39, up: true },
  { x: 44, open: 24, close: 28, high: 20, low: 32, up: false },
  { x: 52, open: 28, close: 14, high: 10, low: 31, up: true },
  { x: 60, open: 16, close: 20, high: 12, low: 24, up: false },
  { x: 68, open: 20, close: 8, high: 5, low: 23, up: true },
  { x: 76, open: 10, close: 16, high: 6, low: 19, up: false },
  { x: 84, open: 16, close: 4, high: 2, low: 18, up: true },
  { x: 92, open: 6, close: 10, high: 3, low: 13, up: false },
] as const

export function StaticCandleBackground({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 60" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {CANDLES.map((c) => {
        const color = c.up ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.18)'
        const top = Math.min(c.open, c.close)
        const height = Math.max(0.8, Math.abs(c.close - c.open))
        return (
          <g key={c.x}>
            <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={color} strokeWidth={0.4} />
            <rect x={c.x - 1.6} y={top} width={3.2} height={height} fill={color} />
          </g>
        )
      })}
    </svg>
  )
}
