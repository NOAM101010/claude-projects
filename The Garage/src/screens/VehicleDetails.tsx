import { useStore, activeCar } from '../store';
import { card, gold, ink, labelFont, nf, ghostBtn } from '../theme';
import { ScreenHeader, SectionLabel } from '../components/UI';
import { BODY_SWATCHES, TRIM_SWATCHES } from '../data';

export default function VehicleDetails() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const car = activeCar(s);
  if (!car) return null;

  const heroSpecs = L.heroSpecs;
  const infoVals = [car.plate, car.make, car.model, String(car.year), car.engine, (car.hp || '—') + (car.hp ? ' hp' : ''), car.gearbox || '—', car.fuel || '—', nf(car.odo) + ' ' + L.km, car.colour || '—', String(car.doors || '—')];

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader
        sub={car.make}
        title={car.model}
        right={!s.editing ? (
          <button onClick={s.startEdit} style={{ height: 36, padding: '0 14px', flex: 'none', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'none', color: 'rgba(241,240,238,.8)', font: '400 11.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.edit}</button>
        ) : (
          <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
            <button onClick={s.cancelEdit} style={{ height: 36, padding: '0 13px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'none', color: 'rgba(241,240,238,.6)', font: '400 11.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.cancel}</button>
            <button onClick={s.saveEdit} style={{ height: 36, padding: '0 15px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.03)', color: ink, font: '300 11.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.save}</button>
          </div>
        )}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '0 30px 34px' }}>
        {heroSpecs.map((h, n) => (
          <div key={n} style={{ padding: '14px 12px', borderRadius: 18, ...card }}>
            <div style={{ font: '300 19px/1 Jost,sans-serif', letterSpacing: '.045em', color: gold }}>{h[0]}</div>
            <div style={{ font: '400 10px/1.35 Jost,sans-serif', color: 'rgba(241,240,238,.4)', marginTop: 8 }}>{h[1]}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 30px 34px' }}>
        <SectionLabel>{L.vehicleInfo}</SectionLabel>
        {!s.editing ? (
          <div style={{ borderRadius: 20, ...card, overflow: 'hidden' }}>
            {L.infoKeys.map((k, n) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px', borderBottom: n < L.infoKeys.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                <span style={{ font: '400 12.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.45)' }}>{k}</span>
                <span style={{ font: '400 12.5px/1 Jost,sans-serif', unicodeBidi: 'isolate' } as any}>{infoVals[n]}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20, borderRadius: 20, background: '#121419', border: '1px solid rgba(232,163,61,.22)' }}>
            {(['plate', 'make', 'model', 'year', 'engine', 'hp', 'odo'] as const).map((key) => (
              <div key={key}>
                <div style={{ font: '500 10.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginBottom: 8 }}>{key}</div>
                <input value={s.editVals[key] || ''} onChange={(e) => s.setEditVal(key, e.target.value)}
                  style={{ width: '100%', height: 44, borderRadius: 13, border: '1px solid rgba(255,255,255,.09)', background: 'linear-gradient(180deg,#0B0D11,#111318)', color: ink, padding: '0 13px', font: '400 13px/1 Jost,sans-serif' }} />
                {s.editErrs[key] && <div style={{ font: '500 10.5px/1.3 Jost,sans-serif', color: '#E8956F', marginTop: 7 }}>{s.editErrs[key]}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '0 30px 34px' }}>
        <SectionLabel>{L.appearance}</SectionLabel>
        <div style={{ padding: 20, borderRadius: 20, ...card }}>
          <div style={{ font: '400 11.5px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.45)' }}>{L.appearanceSub}</div>
          <div style={{ font: '400 11px/1 Jost,sans-serif', margin: '16px 0 10px' }}>{L.bodyColour}</div>
          <div style={{ display: 'flex', gap: 9 }}>
            {BODY_SWATCHES.map((c, n) => (
              <button key={n} onClick={() => useStore.setState({ body: n })} style={{ width: 30, height: 30, borderRadius: 999, background: c, border: s.body === n ? `2px solid ${gold}` : '1px solid rgba(255,255,255,.15)', cursor: 'pointer' }} />
            ))}
          </div>
          <div style={{ font: '400 11px/1 Jost,sans-serif', margin: '18px 0 10px' }}>{L.interiorColour}</div>
          <div style={{ display: 'flex', gap: 9 }}>
            {TRIM_SWATCHES.map((c, n) => (
              <button key={n} onClick={() => useStore.setState({ trim: n })} style={{ width: 30, height: 30, borderRadius: 999, background: c, border: s.trim === n ? `2px solid ${gold}` : '1px solid rgba(255,255,255,.15)', cursor: 'pointer' }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 30px' }}>
        <button onClick={() => s.go('documents')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 15, borderRadius: 18, ...card, color: 'inherit', cursor: 'pointer', textAlign: 'start' }}>
          <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📄</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', font: '400 13px/1 Jost,sans-serif' }}>{L.documents}</span>
            <span style={{ display: 'block', font: '400 11.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 7 }}>{L.docsSub}</span>
          </span>
          <span style={{ font: '500 15px/1 Jost,sans-serif', color: 'rgba(241,240,238,.3)' }}>{he ? '‹' : '›'}</span>
        </button>
        <div style={{ font: '400 10.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.3)', marginTop: 14 }}>{L.specSource}</div>
        <button onClick={() => s.askConfirm('archive', car.id)} style={{ width: '100%', marginTop: 20, padding: 15, borderRadius: 18, border: '1px solid rgba(180,67,47,.32)', background: 'rgba(180,67,47,.07)', color: '#E8917C', cursor: 'pointer', textAlign: 'start' }}>
          <span style={{ display: 'block', font: '400 12.5px/1 Jost,sans-serif' }}>{L.sellVehicle}</span>
          <span style={{ display: 'block', font: '400 11px/1.5 Jost,sans-serif', color: 'rgba(232,145,124,.6)', marginTop: 7 }}>{L.sellSub}</span>
        </button>
      </div>
    </div>
  );
}
