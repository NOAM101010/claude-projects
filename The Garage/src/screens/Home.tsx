import { useStore, activeCar } from '../store';
import { STREAK_CARS, STREAK_MARKS } from '../data';
import { card, gold, ink, labelFont, nf, money } from '../theme';
import { PlateChip } from '../components/UI';

export default function Home() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const car = activeCar(s);
  const heroShot = s.photoCats.hero?.[0] || s.photoCats.exterior?.filter(Boolean)[0] || '';
  const streakDay = Math.max(1, s.streak || 1);
  const streakCar = STREAK_CARS[Math.min(29, streakDay - 1)];
  const [mark, markColor] = STREAK_MARKS[Math.min(29, streakDay - 1)];
  const trip = s.trips[0];
  const dur = (m: number) => (Math.floor(m / 60) > 0 ? Math.floor(m / 60) + L.hours + ' ' + (m % 60) + L.minutes : m + L.minutes);

  const totalSpend = Object.values(s.expenseEntries).reduce((a, list) => a + list.reduce((b, e) => b + e.amount, 0), 0);
  const nextServiceKm = car ? 150000 - car.odo : 0;
  const lastServiceOdo = s.serviceHistory[0]?.odo;
  const showServiceReminder = car && lastServiceOdo != null && car.odo - lastServiceOdo >= 8000;

  const greetName = s.account.name?.trim();
  const hello = greetName ? L.greetName(greetName.split(' ')[0]) : L.helloGeneric;

  if (!car) {
    return (
      <div style={{ animation: 'gFade .6s ease both', padding: '0 30px', textAlign: 'center', marginTop: 60 }}>
        <div style={{ font: '200 22px/1.3 Jost,sans-serif' }}>{L.noVehicleHome}</div>
        <button onClick={() => useStore.setState({ screen: 'addVehicle' })} style={{ marginTop: 20, height: 50, padding: '0 22px', borderRadius: 16, border: '1px solid rgba(232,163,61,.4)', background: 'rgba(232,163,61,.1)', color: gold, font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.addFirstVehicle}</button>
      </div>
    );
  }

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 30px 22px' }}>
        <span style={{ font: '400 8px/1 Michroma,sans-serif', letterSpacing: '.46em', color: 'rgba(241,240,238,.32)' }}>THE</span>
        <span style={{ font: '400 11px/1 Michroma,sans-serif', letterSpacing: '.3em', color: 'rgba(241,240,238,.75)' }}>GARAGE</span>
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(232,163,61,.5),transparent)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '0 30px 20px' }}>
        <div>
          <div style={{ font: '200 26px/1.2 Jost,sans-serif', letterSpacing: '.07em' }}>{hello}</div>
          <div style={{ font: '400 13px/1.4 Jost,sans-serif', color: 'rgba(241,240,238,.45)', marginTop: 7 }}>{L.helloSub}</div>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 8, flex: 'none' }}>
          <button onClick={() => useStore.setState((st) => ({ streakOpen: !st.streakOpen }))} style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 12px', borderRadius: 14, cursor: 'pointer',
            background: 'linear-gradient(168deg,#171A20 0%,#101216 52%,#0C0E12 100%)', border: '1px solid rgba(232,163,61,.3)',
          }}>
            <span dir="ltr" style={{ font: '700 10px/1 Jost,sans-serif', color: markColor }}>{mark}</span>
            <span dir="ltr" style={{ font: '200 14px/1 Jost,sans-serif', letterSpacing: '.03em' }}>{streakDay}</span>
          </button>
          {s.streakOpen && (
            <div onClick={() => useStore.setState({ streakOpen: false })} style={{ position: 'absolute', top: 42, insetInlineEnd: 0, zIndex: 18, width: 206, padding: 15, borderRadius: 18, background: 'linear-gradient(168deg,rgba(26,22,16,.98),rgba(16,18,22,.98))', backdropFilter: 'blur(18px)', border: '1px solid rgba(232,163,61,.26)', boxShadow: '0 30px 64px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)', cursor: 'pointer', animation: 'gRise .5s cubic-bezier(.16,.84,.24,1) both' }}>
              <div style={{ ...labelFont(he, 'xs'), color: 'rgba(241,240,238,.42)' }}>{L.streakDay(streakDay)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <span dir="ltr" style={{ font: '700 16px/1 Jost,sans-serif', color: markColor }}>{mark}</span>
                <span style={{ flex: 1, minWidth: 0, font: '200 14px/1.25 Jost,sans-serif', letterSpacing: '.045em', color: gold }}>{streakCar}</span>
              </div>
              <div style={{ height: 2, borderRadius: 999, background: 'rgba(255,255,255,.07)', marginTop: 15, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(streakDay / 30) * 100}%`, background: gold }} />
              </div>
              <div style={{ font: '400 10.5px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.4)', marginTop: 11 }}>{streakDay >= 30 ? L.streakMax : ''}</div>
            </div>
          )}
          <button onClick={() => s.go('notifications')} style={{ position: 'relative', width: 42, height: 42, flex: 'none', borderRadius: 14, ...card, color: 'rgba(241,240,238,.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.05} strokeLinecap="round"><path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" /><path d="M13.7 19a2 2 0 0 1-3.4 0" /></svg>
            {s.notifications.length > 0 && <span style={{ position: 'absolute', top: 9, insetInlineEnd: 10, width: 7, height: 7, borderRadius: 999, background: '#E8734D', border: '2px solid #121419' }} />}
          </button>
        </div>
      </div>

      <div style={{ padding: '0 0 46px' }}>
        <div style={{ position: 'relative', height: 352, overflow: 'hidden', animation: 'gRise 1.2s cubic-bezier(.16,.84,.24,1) both', background: heroShot ? undefined : 'linear-gradient(160deg,#171A20,#0C0E12)' }}>
          {heroShot && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroShot})`, backgroundSize: 'cover', backgroundPosition: '50% 42%', transform: 'scale(1.04)', maskImage: 'radial-gradient(78% 62% at 50% 44%,#000 42%,transparent 92%)', WebkitMaskImage: 'radial-gradient(78% 62% at 50% 44%,#000 42%,transparent 92%)' } as any} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#08090B 0%,rgba(8,9,11,.15) 26%,rgba(8,9,11,.55) 68%,#08090B 100%)' }} />
          <div style={{ position: 'absolute', insetInline: 30, bottom: 0 }}>
            <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 26, height: 1, background: 'rgba(232,163,61,.8)', flex: 'none' }} />
              <span style={{ ...labelFont(he, 's'), color: 'rgba(241,240,238,.5)' }}>{car.make}</span>
            </div>
            <div style={{ font: '200 40px/1.05 Jost,sans-serif', letterSpacing: '.05em', marginTop: 16 }}>{car.model}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 18 }}>
              <span style={{ font: '200 15px/1 Jost,sans-serif', letterSpacing: '.08em', color: 'rgba(241,240,238,.6)' }}>{car.year}</span>
              <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,.12)' }} />
              <span style={{ font: '200 15px/1 Jost,sans-serif', letterSpacing: '.08em', color: 'rgba(241,240,238,.6)' }}>{nf(car.odo)} {L.km}</span>
              {car.plate && car.plate !== '—' && <span style={{ marginInlineStart: 'auto' }}><PlateChip plate={car.plate} /></span>}
            </div>
            <div style={{ display: 'flex', gap: 22, marginTop: 26, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <button onClick={() => s.tab('garage')} style={{ padding: 0, background: 'none', border: 'none', color: 'rgba(241,240,238,.85)', font: '400 10px/1 Jost,sans-serif', letterSpacing: '.2em', cursor: 'pointer' }}>{L.viewGarage}</button>
              <button onClick={() => s.go('details')} style={{ padding: 0, background: 'none', border: 'none', color: 'rgba(241,240,238,.4)', font: '400 10px/1 Jost,sans-serif', letterSpacing: '.2em', cursor: 'pointer' }}>{L.details}</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 30px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', padding: '20px 6px', borderRadius: 22, ...card }}>
          {[
            [L.quick[0][0], nf(car.odo), '#F1F0EE', 'fuel'],
            [L.quick[1][0], String(s.trips.length), '#F1F0EE', 'trips'],
            [L.quick[2][0], money(totalSpend), '#F5C77E', 'expenses'],
            [L.quick[3][0], nextServiceKm > 0 ? nf(nextServiceKm) + ' ' + L.km : '—', '#E8956F', 'service'],
          ].map((q, n) => (
            <button key={n} onClick={() => s.go((['fuel', 'trips', 'expenses', 'service'] as const)[n])} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 11, padding: '0 12px',
              background: 'none', cursor: 'pointer', textAlign: 'start', color: 'inherit', border: 'none',
              borderInlineStart: n ? '1px solid rgba(255,255,255,.06)' : 'none',
            }}>
              <span style={{ ...labelFont(he, 'xs'), color: 'rgba(241,240,238,.32)' }}>{q[0]}</span>
              <span style={{ font: '200 19px/1 Jost,sans-serif', letterSpacing: '.01em', color: q[2] as string }}>{q[1]}</span>
            </button>
          ))}
        </div>
      </div>

      {showServiceReminder && (
        <div style={{ padding: '0 30px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
            <div style={{ ...labelFont(he), color: 'rgba(241,240,238,.46)' }}>{L.attention}</div>
          </div>
          <button onClick={() => s.go('service')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 18, borderRadius: 18, ...card, cursor: 'pointer', textAlign: 'start', color: 'inherit' }}>
            <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'rgba(232,163,61,.14)' }}>🔧</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', font: '400 13px/1 Jost,sans-serif' }}>{L.serviceDueSoon}</span>
              <span style={{ display: 'block', font: '400 11.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.45)', marginTop: 7 }}>{L.serviceDueSub(nf(Math.max(0, nextServiceKm)))}</span>
            </span>
            <span style={{ font: '500 15px/1 Jost,sans-serif', color: 'rgba(241,240,238,.3)' }}>{he ? '‹' : '›'}</span>
          </button>
        </div>
      )}

      <div style={{ padding: '0 30px' }}>
        <div style={{ ...labelFont(he), color: 'rgba(241,240,238,.48)', marginBottom: 15 }}>{L.lastDrive}</div>
        {trip ? (
          <div style={{ borderRadius: 22, overflow: 'hidden', ...card }}>
            <div style={{ padding: '15px 16px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ font: '400 14px/1.3 Jost,sans-serif' }}>{trip.from} → {trip.to}</div>
                <div style={{ font: '500 10.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.4)' }}>{trip.date}</div>
              </div>
              <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
                {[trip.km.toFixed(1), dur(trip.min), trip.avg + ' ' + (he ? 'קמ״ש' : 'km/h')].map((v, n) => (
                  <div key={n}>
                    <div style={{ font: '300 15px/1 Jost,sans-serif', letterSpacing: '-.02em' }}>{v}</div>
                    <div style={{ font: '400 10.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.38)', marginTop: 6 }}>{L.lastStats[n]}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => { s.setTripId(trip.id); s.go('trip'); }} style={{ width: '100%', height: 44, marginTop: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)', color: ink, font: '400 12px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.viewTrip}</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '28px 22px', borderRadius: 20, border: '1px dashed rgba(255,255,255,.1)', textAlign: 'center', font: '400 11.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.46)' }}>{L.emptyLastDrive}</div>
        )}
      </div>
    </div>
  );
}
