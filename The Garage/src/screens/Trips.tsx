import { useStore } from '../store';
import { card, gold, labelFont } from '../theme';
import { SectionLabel } from '../components/UI';

export function Trips() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const totalKm = s.trips.reduce((a, t) => a + t.km, 0);
  const totalMin = s.trips.reduce((a, t) => a + t.min, 0);

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <div style={{ padding: '0 30px 34px' }}>
        <div style={{ ...labelFont(he, 's'), color: 'rgba(241,240,238,.46)' }}>{L.thisMonth}</div>
        <div style={{ font: '300 25px/1.15 Jost,sans-serif', letterSpacing: '.045em', marginTop: 9 }}>{L.myTrips}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '0 30px 34px' }}>
        {[[totalKm.toFixed(0), L.tripSummary[0][1]], [String(s.trips.length), L.tripSummary[1][1]], [Math.round(totalMin / 60) + 'h', L.tripSummary[2][1]]].map((s2, n) => (
          <div key={n} style={{ padding: '14px 12px', borderRadius: 18, ...card }}>
            <div style={{ font: '300 18px/1 Jost,sans-serif', letterSpacing: '.045em' }}>{s2[0]}</div>
            <div style={{ font: '400 10px/1.35 Jost,sans-serif', color: 'rgba(241,240,238,.4)', marginTop: 8 }}>{s2[1]}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 30px' }}>
        <SectionLabel>{L.recentTrips}</SectionLabel>
        {s.trips.length === 0 ? (
          <div style={{ padding: '38px 22px', borderRadius: 20, border: '1px dashed rgba(255,255,255,.1)', textAlign: 'center', font: '400 11.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.46)' }}>{L.emptyTrips}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {s.trips.map((t) => (
              <button key={t.id} onClick={() => { s.setTripId(t.id); s.go('trip'); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 18, borderRadius: 18, ...card, color: 'inherit', cursor: 'pointer', textAlign: 'start' }}>
                <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E8A33D" strokeWidth={1.05} strokeLinecap="round"><circle cx={6} cy={18} r={2.6} /><circle cx={18} cy={6} r={2.6} /><path d="M8.6 18h4.4a4 4 0 0 0 0-8H8" /></svg>
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', font: '400 13px/1 Jost,sans-serif' }}>{t.from} → {t.to}</span>
                  <span style={{ display: 'block', font: '400 11.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 7 }}>{t.date}</span>
                </span>
                <span style={{ font: '300 13px/1 Jost,sans-serif', color: gold }}>{t.km.toFixed(1)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TripDetail() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const t = s.trips.find((x) => x.id === s.tripId);
  if (!t) return null;
  const dur = (m: number) => (Math.floor(m / 60) > 0 ? Math.floor(m / 60) + L.hours + ' ' + (m % 60) + L.minutes : m + L.minutes);
  const rows = [t.from, t.to, t.km.toFixed(1) + ' ' + L.km, dur(t.min), t.avg + ' km/h', t.max + ' km/h', t.date, t.litres + ' ' + L.litres];

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 30px 32px' }}>
        <button onClick={s.back} style={{ width: 38, height: 38, flex: 'none', borderRadius: 13, border: '1px solid rgba(255,255,255,.09)', background: '#121419', color: '#F1F0EE', font: '500 15px/1 Jost,sans-serif', cursor: 'pointer' }}>{he ? '→' : '←'}</button>
        <div>
          <div style={{ ...labelFont(he, 's'), color: 'rgba(241,240,238,.46)' }}>{t.date}</div>
          <div style={{ font: '200 21px/1.15 Jost,sans-serif', letterSpacing: '.09em', marginTop: 8 }}>{t.from} → {t.to}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, padding: '0 30px' }}>
        {L.tripKeys.map((k, n) => (
          <div key={n} style={{ padding: 14, borderRadius: 16, ...card }}>
            <div style={{ font: '400 10px/1 Jost,sans-serif', color: 'rgba(241,240,238,.38)' }}>{k}</div>
            <div style={{ font: '300 15px/1 Jost,sans-serif', letterSpacing: '-.02em', marginTop: 9 }}>{rows[n]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
