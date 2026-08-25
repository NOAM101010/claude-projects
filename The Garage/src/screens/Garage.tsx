import { useRef } from 'react';
import { useStore, activeCar, activeVehicles } from '../store';
import { CONTROL_ICONS, VIEW_KEYS, VIEW_CAT, SHOTS } from '../data';
import { card, gold, ink, labelFont } from '../theme';
import { EmptyDash, PlateChip } from '../components/UI';

export default function Garage() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const car = activeCar(s);
  const heroShot = s.photoCats.hero?.[0] || s.photoCats.exterior?.filter(Boolean)[0] || '';
  const drag = useRef<{ x: number; y: number } | null>(null);
  const normAngle = ((s.angle % 360) + 360) % 360;
  const viewCat = VIEW_CAT[s.view];
  const catPhotos = (s.photoCats[viewCat] || []).filter(Boolean);
  const catEmpty = catPhotos.length === 0;
  const stagePhoto = catPhotos[0] || '';
  const vIdx = VIEW_KEYS.indexOf(s.view);
  const exteriorFrames = SHOTS.exterior
    .map((shot, n) => ({ deg: Number((shot.deg || '0').replace('°', '')), src: (s.photoCats.exterior || [])[n] }))
    .filter((f) => f.src);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    s.setDragging(true);
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    if (s.view === 'interior') {
      useStore.setState((st) => ({ panX: Math.max(0, Math.min(100, st.panX - dx * 0.25)), panY: Math.max(0, Math.min(100, st.panY - dy * 0.25)) }));
    } else {
      s.setAngle((a) => a + dx * 0.5);
    }
  };
  const onUp = () => { drag.current = null; s.setDragging(false); };

  if (!car) return null;
  const vehicleThumb = (v: NonNullable<ReturnType<typeof activeCar>>) => v.make[0] + v.model[0];

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 34px' }}>
        <div>
          {car.plate && car.plate !== '—' && <div style={{ display: 'flex' }}><PlateChip plate={car.plate} /></div>}
          <div style={{ font: '300 25px/1.15 Jost,sans-serif', letterSpacing: '.045em', marginTop: 9 }}>{L.myGarage}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 999, background: 'rgba(78,190,130,.1)', border: '1px solid rgba(78,190,130,.28)' }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#4EBE82', animation: 'gPulse 2s ease-in-out infinite' }} />
          <span style={{ font: '400 9.5px/1 Jost,sans-serif', letterSpacing: '.12em', color: '#7FD6A6' }}>3D READY</span>
        </div>
      </div>

      <div style={{ padding: '0 30px 20px' }}>
        <button onClick={() => s.pickPhoto('hero', 0)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 12, borderRadius: 16, ...card, cursor: 'pointer', textAlign: 'start', color: 'inherit' }}>
          <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, background: heroShot ? `url(${heroShot}) center/cover` : 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '200 18px/1 Jost,sans-serif', color: 'rgba(241,240,238,.3)' }}>{!heroShot && '+'}</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', font: '400 12.5px/1 Jost,sans-serif' }}>{L.heroPhotoLabel}</span>
            <span style={{ display: 'block', font: '400 10.5px/1.5 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 6 }}>{L.heroPhotoSub}</span>
          </span>
          <span style={{ font: '400 10.5px/1 Jost,sans-serif', color: gold, flex: 'none' }}>{L.changePhoto}</span>
        </button>
      </div>

      <div style={{ padding: '0 30px 14px' }}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp} style={{
          position: 'relative', width: '100%', height: 408, borderRadius: 30, overflow: 'hidden', border: '1px solid rgba(255,255,255,.07)',
          touchAction: 'none', userSelect: 'none', background: 'radial-gradient(75% 60% at 50% 78%,#1C1F26 0%,#0C0D11 72%)', cursor: s.dragging ? 'grabbing' : 'grab',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(58% 34% at 50% 84%,rgba(232,163,61,.13),transparent 72%)', pointerEvents: 'none' }} />
          {s.view === 'r360' ? exteriorFrames.map((f) => {
            const d = Math.abs(((f.deg - normAngle + 540) % 360) - 180);
            const near = 180 - d;
            return (
              <div key={f.deg} style={{
                position: 'absolute', inset: 0, backgroundImage: `url(${f.src})`, backgroundSize: 'cover', backgroundPosition: 'center',
                transform: `scale(${s.dragging ? 1.06 : 1.02})`,
                transition: 'opacity .16s linear, transform .4s ease', opacity: near >= 157.5 ? 1 : 0,
              } as any} />
            );
          }) : !catEmpty && (
            <div style={{
              position: 'absolute', inset: 0, backgroundImage: `url(${stagePhoto})`, backgroundSize: 'cover',
              backgroundPosition: s.view === 'interior' ? `${s.panX}% ${s.panY}%` : 'center', backgroundRepeat: 'no-repeat',
              transition: 'background-position .3s ease',
            }} />
          )}
          {s.view === 'lights' && !catEmpty && (
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 30% at 22% 62%,rgba(255,238,196,.4),transparent 70%),radial-gradient(40% 30% at 78% 62%,rgba(255,238,196,.24),transparent 70%)', mixBlendMode: 'screen', pointerEvents: 'none' }} />
          )}
          {s.view === 'r360' && exteriorFrames.length === 0 && (
            <EmptyDash text={L.catEmptyTitle} cta={L.catEmptyCta} onClick={() => s.openFrameSheet('exterior')} />
          )}
          {catEmpty && s.view !== 'r360' && (
            <EmptyDash text={L.catEmptyTitle} cta={L.catEmptyCta} onClick={() => s.openFrameSheet(viewCat)} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(8,9,11,.4) 0%,transparent 32%,rgba(8,9,11,.72) 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 14, insetInlineEnd: 14, display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end', pointerEvents: 'none' }}>
            <span style={{ font: '400 9.5px/1 Jost,sans-serif', letterSpacing: '.14em', padding: '7px 10px', borderRadius: 999, background: 'rgba(232,163,61,.16)', border: '1px solid rgba(232,163,61,.4)', color: gold }}>{L.stageBadges[vIdx < 0 ? 0 : vIdx]}</span>
          </div>
          <div style={{ position: 'absolute', top: 14, insetInlineStart: 14, display: 'flex', gap: 6 }}>
            <button onClick={s.toggleAutospin} style={{ width: 34, height: 34, borderRadius: 11, border: '1px solid rgba(255,255,255,.14)', background: s.autospin ? 'rgba(232,163,61,.18)' : 'rgba(8,9,11,.55)', backdropFilter: 'blur(12px)', color: s.autospin ? gold : ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.05} strokeLinecap="round" strokeLinejoin="round"><path d="M20.4 12a8.4 8.4 0 1 1-2.6-6.1M20.4 4.2v4.2h-4.2" /></svg>
            </button>
            <button onClick={() => s.openFrameSheet(viewCat)} style={{ width: 34, height: 34, borderRadius: 11, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(8,9,11,.55)', backdropFilter: 'blur(12px)', color: ink, font: '500 15px/1 Jost,sans-serif', cursor: 'pointer' }}>+</button>
          </div>
          <div style={{ position: 'absolute', insetInline: 18, bottom: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, pointerEvents: 'none' }}>
            <div style={{ font: '500 10.5px/1.5 Jost,sans-serif', color: 'rgba(241,240,238,.5)', maxWidth: 180 }}>{s.view === 'interior' ? L.stageHints[1] : L.stageHints[vIdx < 0 ? 0 : vIdx]}</div>
            {s.view === 'r360' && <div dir="ltr" style={{ font: '400 13px/1 Jost,sans-serif', color: gold }}>{Math.round(normAngle)}°</div>}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 30px 34px' }}>
        <div style={{ ...labelFont(he, 's'), color: 'rgba(241,240,238,.42)', marginBottom: 12 }}>{L.inspection}</div>
        <div style={{ display: 'flex', gap: 7, overflow: 'auto', paddingBottom: 2 }}>
          {VIEW_KEYS.map((v, n) => {
            const isActive = s.view === v;
            const count = v === 'r360' ? (s.photoCats.exterior || []).filter(Boolean).length : (s.photoCats[VIEW_CAT[v]] || []).filter(Boolean).length;
            return (
              <button key={v} onClick={() => s.setView(v)} style={{
                flex: 'none', display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', borderRadius: 13, cursor: 'pointer',
                border: isActive ? '1px solid rgba(232,163,61,.4)' : '1px solid rgba(255,255,255,.07)',
                background: isActive ? 'rgba(232,163,61,.12)' : 'rgba(255,255,255,.03)', color: isActive ? gold : ink,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.05} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d={CONTROL_ICONS[n]} /></svg>
                <span style={{ font: '400 10px/1 Jost,sans-serif', whiteSpace: 'nowrap' }}>{L.controls[n]}</span>
                {count > 0 && <span style={{ font: '400 9px/1 Jost,sans-serif', color: 'rgba(241,240,238,.35)' }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '0 30px 34px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 18, ...card }}>
          <button onClick={() => s.setAngle((a) => a - 15)} style={{ width: 32, height: 32, flex: 'none', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)', color: ink, font: '500 14px/1 Jost,sans-serif', cursor: 'pointer' }}>‹</button>
          <div dir="ltr" style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 24 }}>
            {Array.from({ length: 24 }, (_, n) => {
              const d = Math.abs(((n * 15 - normAngle + 540) % 360) - 180);
              const on = 180 - d >= 172;
              const stop = n % 3 === 0;
              return <span key={n} style={{ width: 2, borderRadius: 999, height: on ? 22 : stop ? 13 : 8, background: on ? gold : stop ? 'rgba(241,240,238,.28)' : 'rgba(241,240,238,.13)', transition: 'all .15s ease' }} />;
            })}
          </div>
          <button onClick={() => s.setAngle((a) => a + 15)} style={{ width: 32, height: 32, flex: 'none', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)', color: ink, font: '500 14px/1 Jost,sans-serif', cursor: 'pointer' }}>›</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
          <span style={{ font: '400 10.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.38)' }}>{L.dragHint}</span>
          <button onClick={() => s.openFrameSheet('exterior')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: '400 10.5px/1 Jost,sans-serif', color: gold }}>{L.frameCount((s.photoCats.exterior || []).filter(Boolean).length, SHOTS.exterior.length)}</button>
        </div>
      </div>

      <div style={{ padding: '0 30px 20px' }}>
        <div style={{ ...labelFont(he), color: 'rgba(241,240,238,.48)', marginBottom: 15 }}>{L.myVehicles}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeVehicles(s).map((v) => (
            <div key={v.id} style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => s.setPrimary(v.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, ...card, cursor: 'pointer', textAlign: 'start', color: 'inherit' }}>
                <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 13, background: (v.id === s.primaryId && heroShot) ? `url(${heroShot}) center/cover` : 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 12px/1 Jost,sans-serif' }}>{!(v.id === s.primaryId && heroShot) && vehicleThumb(v)}</span>
                <span style={{ flex: 1, textAlign: 'start' }}>
                  <span style={{ display: 'block', font: '400 13.5px/1 Jost,sans-serif' }}>{v.make} {v.model}</span>
                  <span style={{ display: 'block', font: '400 11.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 7 }}>{v.year} · {v.plate}</span>
                </span>
              </button>
              <button onClick={() => s.setPrimary(v.id)} title={L.primary} style={{ width: 44, flex: 'none', borderRadius: 14, border: 'none', background: 'none', cursor: 'pointer', color: v.id === s.primaryId ? gold : 'rgba(241,240,238,.25)', fontSize: 18 }}>{v.id === s.primaryId ? '★' : '☆'}</button>
            </div>
          ))}
          <button onClick={() => useStore.setState((st) => ({ screen: 'addVehicle', stack: [...st.stack, st.screen] }))} style={{ height: 52, borderRadius: 18, border: '1px dashed rgba(255,255,255,.14)', background: 'none', color: 'rgba(241,240,238,.65)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.addVehicle}</button>
        </div>
      </div>
    </div>
  );
}
