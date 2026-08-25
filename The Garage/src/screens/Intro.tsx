import { useState } from 'react';
import { useStore } from '../store';
import { ink, gold } from '../theme';

export function Splash() {
  const splash = useStore((s) => s.splash);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, background: 'radial-gradient(90% 60% at 50% 42%,#1B1B22 0%,#08090B 70%)', animation: 'gFade .7s ease both' }}>
      <div dir="ltr" style={{ textAlign: 'center', animation: 'gRise 1.4s cubic-bezier(.16,.84,.24,1) both' }}>
        <div style={{ font: '200 11px/1 Jost,sans-serif', letterSpacing: '.62em', color: 'rgba(241,240,238,.42)', textIndent: '.62em' }}>THE</div>
        <div style={{ font: '300 34px/1 Jost,sans-serif', letterSpacing: '.34em', color: ink, marginTop: 16, textIndent: '.34em' }}>GARAGE</div>
        <div style={{ width: 64, height: 1, background: 'rgba(232,163,61,.75)', margin: '22px auto 0' }} />
      </div>
      <div style={{ width: 96, height: 1, background: 'rgba(255,255,255,.07)', overflow: 'hidden', marginTop: 26 }}>
        <div style={{ height: '100%', width: `${25 + splash * 25}%`, background: 'rgba(232,163,61,.8)', transition: 'width 1s cubic-bezier(.16,.84,.24,1)' }} />
      </div>
    </div>
  );
}

export function Auth() {
  const s = useStore();
  const L = s.L();
  const heroShot = s.photoCats.hero?.[0] || s.photoCats.exterior?.filter(Boolean)[0] || '';
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const pick = (n: number) => {
    if (n === 2) { setShowForm(true); return; }
    s.enterApp();
  };
  const submit = () => {
    if (name.trim()) s.setAccount('name', name.trim());
    if (email.trim()) s.setAccount('email', email.trim());
    s.enterApp();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 30px 52px', animation: 'gFade .8s ease both' }}>
      {heroShot && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroShot})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.5 }} />}
      <div style={{ position: 'absolute', inset: 0, background: heroShot ? 'linear-gradient(180deg,rgba(8,9,11,.45) 0%,rgba(8,9,11,.86) 52%,#08090B 100%)' : 'radial-gradient(90% 60% at 50% 30%,#1B1B22 0%,#08090B 70%)' }} />
      <div style={{ position: 'relative', animation: 'gRise 1s cubic-bezier(.16,.84,.24,1) both' }}>
        <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 26, textAlign: 'start' }}>
          <span style={{ font: '200 9.5px/1 Jost,sans-serif', letterSpacing: '.5em', color: 'rgba(241,240,238,.4)' }}>THE</span>
          <span style={{ font: '300 15px/1 Jost,sans-serif', letterSpacing: '.3em', color: 'rgba(241,240,238,.85)' }}>GARAGE</span>
        </div>
        {!showForm ? (
          <>
            <div style={{ font: '200 30px/1.15 Jost,sans-serif', letterSpacing: '.05em' }}>{L.authTitle}</div>
            <div style={{ font: '400 14px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.55)', marginTop: 12, maxWidth: 290 }}>{L.authSub}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 30 }}>
              {L.authOptions.map((label, n) => (
                <button key={n} onClick={() => pick(n)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 16, cursor: 'pointer',
                  font: '400 13px/1 Jost,sans-serif', transition: 'all .45s cubic-bezier(.16,.84,.24,1)',
                  ...(n === 0 ? { background: '#F1F0EE', color: '#141519', border: 'none' }
                    : n === 1 ? { background: '#16181D', color: ink, border: '1px solid rgba(255,255,255,.12)' }
                    : { background: 'none', color: 'rgba(241,240,238,.6)', border: '1px solid rgba(255,255,255,.1)' }),
                }}>
                  <span style={{ fontSize: 15 }}>{['G', '', '✉'][n]}</span><span>{label}</span>
                </button>
              ))}
            </div>
            <div style={{ font: '400 11px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.32)', textAlign: 'center', marginTop: 18 }}>{L.authLegal}</div>
          </>
        ) : (
          <>
            <div style={{ font: '200 26px/1.2 Jost,sans-serif', letterSpacing: '.05em' }}>{L.signInTitle}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={L.signInNamePh}
                style={{ width: '100%', height: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,.12)', background: '#16181D', color: ink, padding: '0 16px', font: '400 14px/1 Jost,sans-serif' }} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={L.signInEmailPh} type="email" dir="ltr"
                style={{ width: '100%', height: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,.12)', background: '#16181D', color: ink, padding: '0 16px', font: '400 14px/1 Jost,sans-serif', textAlign: 'start' }} />
              <button onClick={submit} style={{ height: 52, borderRadius: 16, border: 'none', background: '#F1F0EE', color: '#141519', font: '400 13px/1 Jost,sans-serif', cursor: 'pointer', marginTop: 6 }}>{L.signInContinue}</button>
              <button onClick={() => setShowForm(false)} style={{ height: 44, borderRadius: 16, border: 'none', background: 'none', color: 'rgba(241,240,238,.5)', font: '400 12px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.cancel}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Welcome() {
  const s = useStore();
  const L = s.L();
  const heroShot = s.photoCats.hero?.[0] || s.photoCats.exterior?.filter(Boolean)[0] || '';
  const step = s.welcomeStep;
  return (
    <div onClick={s.skipWelcome} style={{ position: 'absolute', inset: 0, zIndex: 35, background: 'radial-gradient(110% 70% at 50% 30%,#12141A 0%,#08090B 62%)', overflow: 'hidden', cursor: 'pointer' }}>
      {heroShot && (
        <div style={{
          position: 'absolute', inset: 0, backgroundImage: `url(${heroShot})`, backgroundSize: 'cover', backgroundPosition: '50% 44%',
          maskImage: 'radial-gradient(72% 58% at 50% 46%,#000 34%,transparent 88%)', WebkitMaskImage: 'radial-gradient(72% 58% at 50% 46%,#000 34%,transparent 88%)',
          transition: 'transform 2.8s cubic-bezier(.16,.84,.24,1), opacity 1.6s ease',
          transform: `scale(${step >= 1 ? 1.02 : 1.22})`, opacity: step >= 1 ? 1 : 0,
        } as any} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(8,9,11,.6) 0%,transparent 34%,rgba(8,9,11,.9) 78%,#08090B 100%)' }} />
      <div style={{ position: 'absolute', insetInline: 30, bottom: 70 }}>
        <div style={{ position: 'relative', transition: 'opacity 1.1s ease, transform 1.2s cubic-bezier(.16,.84,.24,1)', opacity: step >= 2 ? 1 : 0, transform: `translateY(${step >= 2 ? '0' : '18px'})` }}>
          <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: 9, textAlign: 'start' }}>
            <span style={{ font: '200 9px/1 Jost,sans-serif', letterSpacing: '.5em', color: 'rgba(241,240,238,.46)' }}>THE</span>
            <span style={{ font: '300 13px/1 Jost,sans-serif', letterSpacing: '.3em', color: 'rgba(241,240,238,.7)' }}>GARAGE</span>
          </div>
          <div style={{ font: '200 30px/1.2 Jost,sans-serif', letterSpacing: '.05em', marginTop: 22 }}>{L.welcomeHello}</div>
          <div style={{ font: '400 13px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.45)', marginTop: 11 }}>{L.welcomeSub}</div>
          <div style={{ height: 1, background: 'rgba(232,163,61,.8)', marginTop: 22, transition: 'width 1.4s cubic-bezier(.16,.84,.24,1)', width: step >= 3 ? 92 : 0 }} />
        </div>
      </div>
      <div style={{ position: 'absolute', insetInline: 0, bottom: 28, textAlign: 'center', font: '400 10px/1 Jost,sans-serif', letterSpacing: '.24em', color: 'rgba(241,240,238,.28)' }}>{L.welcomeSkip}</div>
    </div>
  );
}
