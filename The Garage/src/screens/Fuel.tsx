import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { card, gold, money } from '../theme';
import { ScreenHeader, SectionLabel } from '../components/UI';

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

export default function Fuel() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const [hover, setHover] = useState(5);
  const totalL = s.refuels.reduce((a, r) => a + r.litres, 0);
  const totalCost = s.refuels.reduce((a, r) => a + r.cost, 0);
  const totalKm = s.trips.reduce((a, t) => a + t.km, 0);
  const consumption = totalKm > 0 ? (totalL / totalKm) * 100 : null;
  const costPerKm = totalKm > 0 ? totalCost / totalKm : null;

  const fuelCards: [string, string][] = [
    [totalL ? totalL.toFixed(0) + ' ' + L.litres : L.noKmData, L.fuelCards[0][1]],
    [totalCost ? money(Math.round(totalCost)) : L.noKmData, L.fuelCards[1][1]],
    [consumption != null ? consumption.toFixed(1) + ' L' : L.noKmData, L.fuelCards[2][1]],
    [costPerKm != null ? '₪' + costPerKm.toFixed(2) : L.noKmData, L.fuelCards[3][1]],
  ];

  const months = useMemo(() => last6Months(s.lang), [s.lang]);
  const monthlyL = months.map(({ year, month }) => s.refuels.filter((r) => { const d = parseDMY(r.date); return d && d.getFullYear() === year && d.getMonth() === month; }).reduce((a, r) => a + r.litres, 0));
  const monthlyCost = months.map(({ year, month }) => s.refuels.filter((r) => { const d = parseDMY(r.date); return d && d.getFullYear() === year && d.getMonth() === month; }).reduce((a, r) => a + r.cost, 0));
  const series = s.fuelMode === 0 ? monthlyL : monthlyCost;
  const fuelMax = Math.max(1, ...series);

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={L.fuel} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, padding: '0 30px 34px' }}>
        {fuelCards.map(([v, sub], n) => (
          <div key={n} style={{ padding: 15, borderRadius: 18, ...card }}>
            <div style={{ font: '300 19px/1 Jost,sans-serif', letterSpacing: '.045em', color: gold }}>{v}</div>
            <div style={{ font: '400 11px/1 Jost,sans-serif', marginTop: 10 }}>{L.fuelCards[n][0]}</div>
            <div style={{ font: '400 10px/1.4 Jost,sans-serif', color: 'rgba(241,240,238,.36)', marginTop: 7 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 30px 34px' }}>
        <div style={{ padding: '18px 16px', borderRadius: 20, ...card }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ font: '400 11.5px/1 Jost,sans-serif' }}>{L.fuelPerMonth}</span>
            <span style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'rgba(255,255,255,.05)' }}>
              {L.fuelModes.map((m, n) => (
                <button key={n} onClick={() => useStore.setState({ fuelMode: n })} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', font: '400 10.5px/1 Jost,sans-serif', background: s.fuelMode === n ? 'rgba(232,163,61,.16)' : 'none', color: s.fuelMode === n ? gold : 'rgba(241,240,238,.45)' }}>{m}</button>
              ))}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 126 }}>
            {months.map((mo, n) => (
              <div key={n} onMouseEnter={() => setHover(n)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                <div style={{ width: '100%', borderRadius: '8px 8px 3px 3px', height: `${(series[n] / fuelMax) * 100}px`, minHeight: series[n] > 0 ? 3 : 0, background: n === hover ? gold : 'rgba(232,163,61,.35)', transition: 'height .5s cubic-bezier(.2,.8,.2,1)' }} />
                <div style={{ font: '500 9.5px/1 Jost,sans-serif', color: n === hover ? gold : 'rgba(241,240,238,.4)' }}>{mo.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <span style={{ font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.45)' }}>{months[hover].label}</span>
            <span style={{ font: '300 14px/1 Jost,sans-serif', color: gold }}>{s.fuelMode === 0 ? monthlyL[hover] + ' ' + L.litres : money(monthlyCost[hover])}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 30px' }}>
        <SectionLabel>{L.refuels}</SectionLabel>
        {s.refuels.length === 0 ? (
          <div style={{ padding: '28px 22px', borderRadius: 20, border: '1px dashed rgba(255,255,255,.1)', textAlign: 'center', font: '400 11.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.46)' }}>{L.noFuelData}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {s.refuels.map((r) => {
              const [d, m] = r.date.split('/');
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', borderRadius: 16, ...card }}>
                  <div style={{ width: 40, flex: 'none', textAlign: 'center' }}>
                    <div style={{ font: '300 14px/1 Jost,sans-serif' }}>{d}</div>
                    <div style={{ font: '500 9.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.38)', marginTop: 6 }}>{m}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '400 12.5px/1 Jost,sans-serif' }}>{r.station || '—'}</div>
                    <div style={{ font: '400 10.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.4)', marginTop: 7 }}>{r.litres} {L.litres}</div>
                  </div>
                  <div style={{ font: '300 12.5px/1 Jost,sans-serif', color: gold }}>{money(r.cost)}</div>
                  <button onClick={() => s.deleteRefuel(r.id)} style={{ width: 20, height: 20, flex: 'none', borderRadius: 6, border: 'none', background: 'none', color: 'rgba(241,240,238,.28)', font: '400 11px/1 Jost,sans-serif', cursor: 'pointer' }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
        <button onClick={s.openRefuelSheet} style={{ width: '100%', height: 50, marginTop: 12, borderRadius: 16, border: '1px dashed rgba(255,255,255,.14)', background: 'none', color: 'rgba(241,240,238,.65)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.addRefuel}</button>
        <div style={{ font: '400 10.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.3)', marginTop: 14 }}>{L.fuelSource}</div>
      </div>
    </div>
  );
}
