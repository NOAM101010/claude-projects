import { useState } from 'react';
import { useStore } from '../store';
import { MAKES } from '../data';
import { ink, ghostBtn } from '../theme';

export default function AddVehicle({ onboarding = false }: { onboarding?: boolean }) {
  const s = useStore();
  const L = s.L(); const i = s.i(); const he = s.lang === 'he';
  const [step, setStep] = useState(0);
  const [vals, setVals] = useState<Record<number, string>>({});
  const steps = L.steps;
  const stepDef = steps[step];
  const isPhotoStep = step === 6;

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

  const back = () => (step === 0 ? (!onboarding && s.back()) : setStep((x) => x - 1));

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 30px 34px' }}>
        {!(onboarding && step === 0) && (
          <button onClick={back} style={{ width: 38, height: 38, flex: 'none', borderRadius: 13, border: '1px solid rgba(255,255,255,.09)', background: '#121419', color: ink, font: '500 15px/1 Jost,sans-serif', cursor: 'pointer' }}>{he ? '→' : '←'}</button>
        )}
        <div>
          <div style={{ font: '600 10px/1 Assistant,sans-serif', letterSpacing: '.13em', color: 'rgba(241,240,238,.46)' }}>{L.step} {step + 1} {L.of} {steps.length}</div>
          <div style={{ font: '200 21px/1.15 Jost,sans-serif', letterSpacing: '.09em', marginTop: 8 }}>{onboarding && step === 0 ? L.onboardTitle : L.addVehicleTitle}</div>
        </div>
      </div>

      {onboarding && step === 0 && (
        <div style={{ padding: '0 30px 20px', font: '400 12.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.45)' }}>{L.onboardSub}</div>
      )}

      <div style={{ padding: '0 30px 48px' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {steps.map((_, n) => (
            <span key={n} style={{ flex: 1, height: 4, borderRadius: 999, background: n <= step ? '#F5C77E' : 'rgba(255,255,255,.08)', transition: 'background .3s ease' }} />
          ))}
        </div>
      </div>
      <div style={{ padding: '0 30px' }}>
        <div style={{ font: '300 22px/1.3 Jost,sans-serif', letterSpacing: '.045em' }}>{stepDef[1]}</div>
        <div style={{ font: '400 12.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.45)', marginTop: 11 }}>{stepDef[3]}</div>
        {!isPhotoStep ? (
          <>
            <input
              value={vals[step] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [step]: e.target.value }))}
              placeholder={step === 0 ? L.makePh : stepDef[2]} list={step === 0 ? 'garage-makes' : undefined}
              style={{ width: '100%', height: 54, marginTop: 22, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: '#121419', color: ink, padding: '0 16px', font: '500 15px/1 Jost,sans-serif' }} />
            {step === 0 && (
              <datalist id="garage-makes">
                {MAKES.map((m) => <option key={m[i]} value={m[i]} />)}
              </datalist>
            )}
          </>
        ) : (
          <button onClick={() => s.pickPhoto('hero', 0)} style={{ width: '100%', marginTop: 22, height: 140, borderRadius: 18, border: '1px dashed rgba(255,255,255,.14)', background: s.photoCats.hero?.[0] ? `url(${s.photoCats.hero[0]}) center/cover` : '#101116', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 12px/1 Jost,sans-serif', color: 'rgba(241,240,238,.46)', cursor: 'pointer' }}>
            {!s.photoCats.hero?.[0] && L.dropPhoto}
          </button>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          <button onClick={back} style={{ flex: 1, height: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'none', color: 'rgba(241,240,238,.5)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.back}</button>
          <button onClick={() => (step === steps.length - 1 ? finish() : setStep((x) => x + 1))} style={{ flex: 2, height: 52, borderRadius: 16, ...ghostBtn }}>{step === steps.length - 1 ? L.finish : L.next}</button>
        </div>
      </div>
    </div>
  );
}
