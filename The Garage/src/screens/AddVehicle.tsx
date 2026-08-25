import { useState } from 'react';
import { useStore } from '../store';
import { CATALOG } from '../data';
import { card, gold, ink, ghostBtn } from '../theme';

type Mode = '' | 'upload' | 'catalog';

export default function AddVehicle({ onboarding = false }: { onboarding?: boolean }) {
  const s = useStore();
  const L = s.L(); const i = s.i(); const he = s.lang === 'he';
  const [mode, setMode] = useState<Mode>('');
  const [step, setStep] = useState(0);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [catalogPick, setCatalogPick] = useState(-1);

  const finish = () => {
    s.addVehicle({
      make: vals[0]?.trim() || '—',
      model: vals[1]?.trim() || '—',
      year: +(vals[2] || new Date().getFullYear()) || new Date().getFullYear(),
      engine: vals[3]?.trim() || '—',
      hp: 0,
      odo: +(vals[4] || '0').replace(/[^\d]/g, '') || 0,
      plate: vals[5]?.trim() || '—',
    });
  };

  const choosing = mode === '';
  const browsing = mode === 'catalog' && catalogPick < 0;
  const stepping = mode === 'upload' || (mode === 'catalog' && catalogPick >= 0);
  const steps = L.steps;
  const stepDef = steps[step];
  const isPhotoStep = step === 6;

  const pickCatalog = (n: number) => {
    const c = CATALOG[n];
    setCatalogPick(n);
    setVals({ 0: c.make[i], 1: c.model, 2: String(c.year), 3: c.engine, 4: '0', 5: '' });
  };

  const handleBack = () => {
    if (mode === '') { if (!onboarding) s.back(); return; }
    if (browsing) { setMode(''); return; }
    if (stepping && step === 0) { setMode(mode === 'catalog' ? 'catalog' : ''); if (mode === 'catalog') setCatalogPick(-1); return; }
    setStep((x) => Math.max(0, x - 1));
  };

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 30px 34px' }}>
        {!(onboarding && choosing) && (
          <button onClick={handleBack} style={{ width: 38, height: 38, flex: 'none', borderRadius: 13, border: '1px solid rgba(255,255,255,.09)', background: '#121419', color: ink, font: '500 15px/1 Jost,sans-serif', cursor: 'pointer' }}>{he ? '→' : '←'}</button>
        )}
        <div>
          {stepping && <div style={{ font: '600 10px/1 Assistant,sans-serif', letterSpacing: '.13em', color: 'rgba(241,240,238,.46)' }}>{L.step} {step + 1} {L.of} {steps.length}</div>}
          <div style={{ font: '200 21px/1.15 Jost,sans-serif', letterSpacing: '.09em', marginTop: 8 }}>{onboarding && choosing ? L.onboardTitle : L.addVehicleTitle}</div>
        </div>
      </div>

      {choosing && (
        <div style={{ padding: '0 30px' }}>
          <div style={{ font: '200 28px/1.25 Jost,sans-serif', letterSpacing: '.045em' }}>{onboarding ? L.onboardTitle : L.chooseTitle}</div>
          <div style={{ font: '400 12.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.45)', marginTop: 12 }}>{onboarding ? L.onboardSub : L.chooseSub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
            {[L.chooseUpload, L.chooseCatalog].map((c, n) => (
              <button key={n} onClick={() => setMode(n === 0 ? 'upload' : 'catalog')} style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: 22, borderRadius: 20, cursor: 'pointer', textAlign: 'start', color: 'inherit', ...card }}>
                <span style={{ font: '400 9px/1 Jost,sans-serif', letterSpacing: '.24em', color: gold }}>{n === 0 ? '01' : '02'}</span>
                <span style={{ font: '300 17px/1.3 Jost,sans-serif', letterSpacing: '.035em' }}>{c[0]}</span>
                <span style={{ font: '400 11.5px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.45)' }}>{c[1]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {browsing && (
        <div style={{ padding: '0 30px' }}>
          <div style={{ font: '200 26px/1.25 Jost,sans-serif', letterSpacing: '.045em' }}>{L.collectionTitle}</div>
          <div style={{ font: '400 12.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.45)', marginTop: 11 }}>{L.collectionSub}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 24 }}>
            {CATALOG.map((c, n) => (
              <button key={n} onClick={() => pickCatalog(n)} style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 14, borderRadius: 16, cursor: 'pointer', textAlign: 'start', color: 'inherit', ...card }}>
                <span style={{ width: '100%', aspectRatio: '1.4', borderRadius: 10, background: c.photo ? `url(${c.photo}) center/cover` : 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '300 20px/1 Jost,sans-serif', color: 'rgba(241,240,238,.3)' }}>{!c.photo && (c.make[i][0] + c.model[0])}</span>
                <span style={{ display: 'block', font: '400 12.5px/1.3 Jost,sans-serif' }}>{c.make[i]} {c.model}</span>
                <span style={{ display: 'block', font: '400 10.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.4)' }}>{c.year} · {c.engine}</span>
              </button>
            ))}
          </div>
          <div style={{ font: '400 10.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.3)', marginTop: 16 }}>{L.collectionNote}</div>
          <button onClick={() => setMode('')} style={{ width: '100%', height: 50, marginTop: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'none', color: 'rgba(241,240,238,.5)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.back}</button>
        </div>
      )}

      {stepping && (
        <>
          <div style={{ padding: '0 30px 48px' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {steps.map((_, n) => (
                <span key={n} style={{ flex: 1, height: 4, borderRadius: 999, background: n <= step ? gold : 'rgba(255,255,255,.08)', transition: 'background .3s ease' }} />
              ))}
            </div>
          </div>
          <div style={{ padding: '0 30px' }}>
            <div style={{ font: '300 22px/1.3 Jost,sans-serif', letterSpacing: '.045em' }}>{stepDef[1]}</div>
            <div style={{ font: '400 12.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.45)', marginTop: 11 }}>{stepDef[3]}</div>
            {!isPhotoStep ? (
              <input value={vals[step] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [step]: e.target.value }))} placeholder={stepDef[2]}
                style={{ width: '100%', height: 54, marginTop: 22, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: '#121419', color: ink, padding: '0 16px', font: '500 15px/1 Jost,sans-serif' }} />
            ) : (
              <button onClick={() => s.pickPhoto('hero', 0)} style={{ width: '100%', marginTop: 22, height: 140, borderRadius: 18, border: '1px dashed rgba(255,255,255,.14)', background: s.photoCats.hero?.[0] ? `url(${s.photoCats.hero[0]}) center/cover` : '#101116', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 12px/1 Jost,sans-serif', color: 'rgba(241,240,238,.46)', cursor: 'pointer' }}>
                {!s.photoCats.hero?.[0] && L.dropPhoto}
              </button>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
              <button onClick={handleBack} style={{ flex: 1, height: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'none', color: 'rgba(241,240,238,.5)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.back}</button>
              <button onClick={() => (step === steps.length - 1 ? finish() : setStep((x) => x + 1))} style={{ flex: 2, height: 52, borderRadius: 16, ...ghostBtn }}>{step === steps.length - 1 ? L.finish : L.next}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
