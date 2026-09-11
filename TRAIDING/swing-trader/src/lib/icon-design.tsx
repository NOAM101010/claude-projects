/**
 * עיצוב האייקון המשותף — שלושה נרות יפניים בעלייה (uptrend candlesticks),
 * בפלטת האפליקציה (רקע פחם/טיטניום, גופים ירוקים, פתילים ומסגרת עמבר).
 * משמש את `src/app/icon.tsx`, `src/app/apple-icon.tsx` ואת
 * `scripts/generate-icons.ts` כדי שהעיצוב יישאר זהה בכל הגרסאות.
 */

const BG = "#0a0a0b";
const GREEN = "#4ade80";
const AMBER = "#e8b341";
const WICK = "#3a4a3f";

type Candle = { bodyH: number; wickTop: number; wickBottom: number; lift: number };

/**
 * מחזיר JSX-tree תואם-satori של 3 נרות עולים בתוך ריבוע `size`x`size`.
 * `opaque` — כשאמת (apple-icon), אין פינות מעוגלות (iOS מעגל בעצמו).
 */
export function CandleIcon({ size, opaque = false }: { size: number; opaque?: boolean }) {
  const bodyW = Math.round(size * 0.15);
  const gap = Math.round(size * 0.075);
  const wickW = Math.max(2, Math.round(size * 0.03));
  const border = Math.max(2, Math.round(size * 0.016));
  const radius = Math.round(size * 0.035);
  const baseline = Math.round(size * 0.74);

  const candles: Candle[] = [
    { bodyH: Math.round(size * 0.16), wickTop: Math.round(size * 0.06), wickBottom: Math.round(size * 0.05), lift: 0 },
    { bodyH: Math.round(size * 0.24), wickTop: Math.round(size * 0.07), wickBottom: Math.round(size * 0.05), lift: Math.round(size * 0.1) },
    { bodyH: Math.round(size * 0.34), wickTop: Math.round(size * 0.08), wickBottom: Math.round(size * 0.05), lift: Math.round(size * 0.22) },
  ];

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        position: "relative",
        background: BG,
        borderRadius: opaque ? 0 : Math.round(size * 0.18),
      }}
    >
      <div
        style={{
          position: "absolute",
          display: "flex",
          alignItems: "flex-end",
          left: 0,
          right: 0,
          bottom: size - baseline,
          justifyContent: "center",
        }}
      >
        {candles.map((c, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginLeft: i === 0 ? 0 : gap,
              transform: `translateY(-${c.lift}px)`,
            }}
          >
            <div style={{ width: wickW, height: c.wickTop, background: WICK, display: "flex" }} />
            <div
              style={{
                width: bodyW,
                height: c.bodyH,
                background: GREEN,
                border: `${border}px solid ${AMBER}`,
                borderRadius: radius,
                display: "flex",
              }}
            />
            <div style={{ width: wickW, height: c.wickBottom, background: WICK, display: "flex" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
