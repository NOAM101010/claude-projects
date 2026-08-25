import { useMemo } from 'react';
import { useStore, activeCar } from '../store';
import { gold, ink, labelFont, money } from '../theme';
import { PlateChip, ScreenHeader } from '../components/UI';

function parseDMY(d: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}
function last6Months(lang: string) {
  const out: { year: number; month: number; label: string }[] = [];
  const now = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short' }) });
  }
  return out;
}

export default function Wrap() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const car = activeCar(s);
  const heroShot = s.photoCats.hero?.[0] || s.photoCats.exterior?.filter(Boolean)[0] || '';
  const year = new Date().getFullYear();

  const months = useMemo(() => last6Months(s.lang), [s.lang]);
  const kmByMonth = months.map(({ year: y, month }) => s.trips.filter((t) => { const d = parseDMY(t.date); return d && d.getFullYear() === y && d.getMonth() === month; }).reduce((a, t) => a + t.km, 0));
  const totalKm = s.trips.reduce((a, t) => a + t.km, 0);
  const totalSpend = Object.values(s.expenseEntries).reduce((a, list) => a + list.reduce((b, e) => b + e.amount, 0), 0) + s.refuels.reduce((a, r) => a + r.cost, 0);
  const longest = s.trips.reduce((best, t) => (!best || t.km > best.km ? t : best), null as null | (typeof s.trips)[number]);
  const peakIdx = kmByMonth.reduce((b, v, n) => (v > kmByMonth[b] ? n : b), 0);
  const wrapIdx = s.wrapMonth == null ? peakIdx : s.wrapMonth;
  const kmMax = Math.max(1, ...kmByMonth);

  const totalL = s.refuels.reduce((a, r) => a + r.litres, 0);
  const consumption = totalKm > 0 && totalL > 0 ? ((totalL / totalKm) * 100).toFixed(1) : '—';

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={L.wrapTitle} />
      <div style={{ padding: '0 30px' }}>
        <div style={{ position: 'relative', borderRadius: 26, overflow: 'hidden', border: '1px solid rgba(232,163,61,.22)', background: 'linear-gradient(168deg,#1E1710 0%,#101218 52%,#08090B 100%)', boxShadow: '0 34px 70px -30px rgba(0,0,0,.95)' }}>
          <div style={{ position: 'relative', height: 196, overflow: 'hidden', background: heroShot ? undefined : 'linear-gradient(160deg,#191B21,#0C0E12)' }}>
            {heroShot && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroShot})`, backgroundSize: 'cover', backgroundPosition: '50% 42%', maskImage: 'radial-gradient(78% 70% at 50% 44%,#000 30%,transparent 88%)', WebkitMaskImage: 'radial-gradient(78% 70% at 50% 44%,#000 30%,transparent 88%)' } as any} />}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(8,9,11,.5) 0%,transparent 38%,rgba(8,9,11,.92) 100%)' }} />
            <div dir="ltr" style={{ position: 'absolute', top: 16, left: 20, font: '200 62px/1 Jost,sans-serif', letterSpacing: '.06em', color: 'transparent', WebkitTextStroke: '1px rgba(245,199,126,.45)' } as any}>{year}</div>
            <div style={{ position: 'absolute', top: 20, right: 20, font: '400 9px/1 Jost,sans-serif', letterSpacing: '.24em', color: 'rgba(245,199,126,.8)' }}>{year} {he ? '' : 'card'}</div>
          </div>
          <div style={{ padding: '0 22px 26px', marginTop: -26, position: 'relative' }}>
            <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ font: '200 46px/1 Jost,sans-serif', letterSpacing: '.01em' }}>{totalKm.toFixed(0)}</span>
              <span style={{ font: '400 10px/1 Jost,sans-serif', letterSpacing: '.2em', color: 'rgba(241,240,238,.45)' }}>{L.km} {year}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 86, marginTop: 26, paddingBottom: 2 }}>
              {months.map((mo, n) => {
                const active = wrapIdx === n;
                return (
                  <button key={n} onClick={() => s.setWrapMonth(n)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <span style={{ width: '100%', borderRadius: '6px 6px 2px 2px', height: `${(kmByMonth[n] / kmMax) * 62}px`, minHeight: kmByMonth[n] > 0 ? 3 : 0, background: active ? gold : 'rgba(232,163,61,.3)', transition: 'height .5s ease, background .3s ease' }} />
                    <span style={{ font: '500 9px/1 Jost,sans-serif', color: active ? gold : 'rgba(241,240,238,.35)' }}>{mo.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <span style={{ font: '400 10px/1 Jost,sans-serif', letterSpacing: '.14em', color: 'rgba(241,240,238,.4)' }}>{months[wrapIdx].label}</span>
              <span style={{ font: '200 20px/1 Jost,sans-serif', letterSpacing: '.02em', color: gold, marginInlineStart: 'auto' }}>{kmByMonth[wrapIdx].toFixed(0)} {L.km}</span>
            </div>
            <div style={{ marginTop: 22, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              {[
                [he ? 'הנסיעה הארוכה' : 'Longest drive', longest ? `${longest.from} → ${longest.to} · ${longest.km.toFixed(0)} ${L.km}` : L.noKmData],
                [he ? 'סה״כ הוצאות' : 'Total spend', money(totalSpend)],
                [he ? 'צריכה ממוצעת' : 'Avg consumption', consumption === '—' ? consumption : consumption + ' L/100km'],
              ].map((r, n) => (
                <div key={n} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '13px 0', borderBottom: n < 2 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                  <span style={{ font: '400 10.5px/1 Jost,sans-serif', letterSpacing: '.06em', color: 'rgba(241,240,238,.42)', flex: 'none' }}>{r[0]}</span>
                  <span style={{ font: '300 12.5px/1.4 Jost,sans-serif', color: ink, marginInlineStart: 'auto', textAlign: 'end' }}>{r[1]}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 10px', marginTop: 20 }}>
              {[[totalKm.toFixed(0), L.wrapStats[0][1]], [String(s.trips.length), L.wrapStats[1][1]], [money(totalSpend), L.wrapStats[2][1]], [consumption, L.wrapStats[3][1]]].map((w, n) => (
                <div key={n}>
                  <div style={{ font: '200 21px/1 Jost,sans-serif', letterSpacing: '.02em', color: gold }}>{w[0]}</div>
                  <div style={{ font: '400 9.5px/1.35 Jost,sans-serif', letterSpacing: '.1em', color: 'rgba(241,240,238,.4)', marginTop: 8 }}>{w[1]}</div>
                </div>
              ))}
            </div>
            <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 26, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <span style={{ font: '200 8px/1 Jost,sans-serif', letterSpacing: '.5em', color: 'rgba(241,240,238,.32)' }}>THE</span>
              <span style={{ font: '300 11px/1 Jost,sans-serif', letterSpacing: '.3em', color: 'rgba(241,240,238,.62)' }}>GARAGE</span>
              {car?.plate && car.plate !== '—' && <span style={{ marginInlineStart: 'auto' }}><PlateChip plate={car.plate} /></span>}
            </div>
          </div>
        </div>
        <button onClick={() => s.flash(L.sharedToast)} style={{ width: '100%', height: 50, marginTop: 12, borderRadius: 16, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.03)', color: ink, font: '300 13px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.share}</button>
      </div>
    </div>
  );
}
