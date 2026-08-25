import { useStore, activeCar } from '../store';
import { card, gold, ink, ghostBtn } from '../theme';
import { PlateChip, ScreenHeader, SectionLabel } from '../components/UI';

export function Service() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const car = activeCar(s);
  if (!car) return null;
  const nextKm = 150000, progress = Math.min(100, Math.max(0, Math.round((car.odo / nextKm) * 100)));

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <div style={{ padding: '0 30px 34px' }}>
        {car.plate && car.plate !== '—' && <div style={{ display: 'flex' }}><PlateChip plate={car.plate} /></div>}
        <div style={{ font: '300 25px/1.15 Jost,sans-serif', letterSpacing: '.045em', marginTop: 9 }}>{L.service}</div>
      </div>

      <div style={{ padding: '0 30px 32px' }}>
        <div style={{ padding: 22, borderRadius: 22, background: 'linear-gradient(160deg,#191B21,#111318)', border: '1px solid rgba(232,163,61,.22)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ font: '400 10px/1 Jost,sans-serif', letterSpacing: '.18em', color: 'rgba(241,240,238,.4)' }}>{L.nextService}</div>
              <div style={{ font: '300 27px/1 Jost,sans-serif', letterSpacing: '.045em', color: gold, marginTop: 11 }}>{Math.max(0, nextKm - car.odo).toLocaleString()} {L.km}</div>
            </div>
          </div>
          <div style={{ height: 2, borderRadius: 999, background: 'rgba(255,255,255,.07)', overflow: 'hidden', marginTop: 18 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,rgba(232,163,61,.55),rgba(232,163,61,.9))', transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 30px 34px' }}>
        <button onClick={s.openServiceSheet} style={{ width: '100%', height: 50, borderRadius: 16, ...ghostBtn }}>{L.addService}</button>
      </div>

      <div style={{ padding: '0 30px' }}>
        <SectionLabel>{L.serviceHistory}</SectionLabel>
        {s.serviceHistory.length === 0 ? (
          <div style={{ padding: '28px 22px', borderRadius: 20, border: '1px dashed rgba(255,255,255,.1)', textAlign: 'center', font: '400 11.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.46)' }}>{L.emptyServiceHistory}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {s.serviceHistory.map((rec) => {
              const [d, m] = rec.date.split('/');
              return (
                <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 18, borderRadius: 18, ...card }}>
                  <div style={{ width: 44, flex: 'none', textAlign: 'center' }}>
                    <div style={{ font: '300 15px/1 Jost,sans-serif' }}>{d}</div>
                    <div style={{ font: '500 9.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.38)', marginTop: 6 }}>{m}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '400 13px/1 Jost,sans-serif' }}>{rec.title}</div>
                    <div style={{ font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.4)', marginTop: 7 }}>{rec.odo.toLocaleString()} {L.km}</div>
                  </div>
                  <div style={{ font: '300 13px/1 Jost,sans-serif', color: gold }}>₪{rec.cost}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function Documents() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={L.documents} />
      <div style={{ padding: '0 30px' }}>
        {s.documents.length === 0 ? (
          <div style={{ padding: '28px 22px', borderRadius: 20, border: '1px dashed rgba(255,255,255,.1)', textAlign: 'center', font: '400 11.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.46)' }}>{L.emptyDocuments}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {s.documents.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 15, borderRadius: 18, ...card }}>
                <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{d.icon}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', font: '400 13px/1 Jost,sans-serif' }}>{d.label}</span>
                  <span style={{ display: 'block', font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 7 }}>{d.status}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => s.flash(L.uploaded)} style={{ width: '100%', height: 50, marginTop: 12, borderRadius: 16, border: '1px dashed rgba(255,255,255,.14)', background: 'none', color: 'rgba(241,240,238,.65)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.uploadDoc}</button>
        <div style={{ font: '400 10.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.3)', marginTop: 14 }}>{L.docsNote}</div>
      </div>
    </div>
  );
}
