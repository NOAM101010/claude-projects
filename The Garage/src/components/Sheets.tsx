import { useStore } from '../store';
import { card, gold, ink, ghostBtn, primaryBtn } from '../theme';
import { EXPENSE_CAT_DEFS, SHOTS, PhotoCat, CAT_ORDER } from '../data';

const inputStyle = { width: '100%', height: 50, borderRadius: 15, border: '1px solid rgba(255,255,255,.1)', background: '#101216', color: ink, padding: '0 15px', font: '400 14px/1 Jost,sans-serif' };

export function ConfirmSheet() {
  const s = useStore();
  if (!s.confirm) return null;
  const L = s.L();
  const target = s.vehicles.find((v) => v.id === s.confirmTarget);
  const name = target ? `${target.make} ${target.model}` : '';
  const isDelete = s.confirm === 'delete';
  const title = isDelete ? L.deleteTitle : L.archiveTitle;
  const body = isDelete ? L.deleteBody(name) : L.archiveBody(name);
  const cta = isDelete ? L.deleteCta : L.archiveCta;
  const canRun = !isDelete || s.confirmText.trim().toUpperCase() === L.deleteWord.toUpperCase();
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 24, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={s.cancelConfirm} style={{ position: 'absolute', inset: 0, background: 'rgba(4,5,7,.66)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'relative', borderRadius: '28px 28px 0 0', background: 'linear-gradient(180deg,#191C22,#0D0F13)', borderTop: '1px solid rgba(255,255,255,.07)', boxShadow: '0 -30px 60px rgba(0,0,0,.7)', padding: '18px 26px 34px', animation: 'gRise .5s cubic-bezier(.16,.84,.24,1) both' }}>
        <div style={{ width: 38, height: 4, borderRadius: 999, background: 'rgba(255,255,255,.14)', margin: '0 auto 18px' }} />
        <div style={{ font: '300 18px/1.25 Jost,sans-serif', letterSpacing: '.045em' }}>{title}</div>
        <div style={{ font: '400 12.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.5)', marginTop: 12 }}>{body}</div>
        {isDelete && (
          <input value={s.confirmText} onChange={(e) => s.setConfirmText(e.target.value)} placeholder={L.deleteWord}
            style={{ width: '100%', height: 46, marginTop: 16, borderRadius: 14, border: '1px solid rgba(180,67,47,.35)', background: 'linear-gradient(180deg,#0B0D11,#111318)', color: ink, padding: '0 14px', font: '400 13px/1 Jost,sans-serif' }} />
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={s.cancelConfirm} style={{ flex: 1, height: 48, borderRadius: 15, border: '1px solid rgba(255,255,255,.12)', background: 'none', color: 'rgba(241,240,238,.7)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.cancel}</button>
          <button onClick={s.runConfirm} disabled={!canRun} style={{ flex: 1, height: 48, borderRadius: 15, cursor: canRun ? 'pointer' : 'not-allowed', opacity: canRun ? 1 : 0.5, border: '1px solid rgba(180,67,47,.4)', background: 'rgba(180,67,47,.12)', color: '#E8917C', font: '400 12.5px/1 Jost,sans-serif' }}>{cta}</button>
        </div>
      </div>
    </div>
  );
}

export function ExpenseSheet() {
  const s = useStore();
  if (s.expSheet == null) return null;
  const L = s.L(); const he = s.lang === 'he';
  const catDef = EXPENSE_CAT_DEFS[s.expSheet];
  const catName = he ? catDef.he : catDef.en;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 26 }}>
      <div onClick={s.closeExpSheet} style={{ position: 'absolute', inset: 0, background: 'rgba(4,5,7,.72)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, padding: '26px 26px 34px', borderRadius: '30px 30px 0 0', background: 'linear-gradient(168deg,#191C22 0%,#111318 56%,#0A0B0F 100%)', borderTop: '1px solid rgba(255,255,255,.08)', boxShadow: '0 -30px 70px rgba(0,0,0,.75)', animation: 'gRise .5s cubic-bezier(.16,.84,.24,1) both' }}>
        <div style={{ width: 36, height: 3, borderRadius: 999, background: 'rgba(255,255,255,.14)', margin: '0 auto 22px' }} />
        <div style={{ font: '200 20px/1.2 Jost,sans-serif', letterSpacing: '.06em' }}>{L.addExpense} · {catName}</div>
        <div style={{ font: '400 11.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 10 }}>{L.expSheetSub}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22 }}>
          <div>
            <div style={{ font: '600 10px/1 Assistant,sans-serif', color: 'rgba(241,240,238,.46)', marginBottom: 9 }}>{L.expAmount}</div>
            <input value={s.expForm.amount} onChange={(e) => s.setExpForm('amount', e.target.value)} placeholder="120" style={inputStyle} />
            {s.expErrs.amount && <div style={{ font: '400 10.5px/1 Jost,sans-serif', color: '#E8917C', marginTop: 8 }}>{s.expErrs.amount}</div>}
          </div>
          <div>
            <div style={{ font: '600 10px/1 Assistant,sans-serif', color: 'rgba(241,240,238,.46)', marginBottom: 9 }}>{L.expDate}</div>
            <input value={s.expForm.date} onChange={(e) => s.setExpForm('date', e.target.value)} placeholder="24/08/2026" style={inputStyle} />
            {s.expErrs.date && <div style={{ font: '400 10.5px/1 Jost,sans-serif', color: '#E8917C', marginTop: 8 }}>{s.expErrs.date}</div>}
          </div>
          <div>
            <div style={{ font: '600 10px/1 Assistant,sans-serif', color: 'rgba(241,240,238,.46)', marginBottom: 9 }}>{L.expNote}</div>
            <input value={s.expForm.note} onChange={(e) => s.setExpForm('note', e.target.value)} placeholder={L.expNotePh} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button onClick={s.closeExpSheet} style={{ flex: 1, height: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'none', color: 'rgba(241,240,238,.5)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.cancel}</button>
          <button onClick={s.saveExpense} style={{ flex: 2, height: 52, borderRadius: 16, ...primaryBtn }}>{L.save}</button>
        </div>
      </div>
    </div>
  );
}

export function ServiceSheet() {
  const s = useStore();
  if (!s.serviceSheet) return null;
  const L = s.L();
  const fields = L.serviceFields;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
      <div onClick={s.closeServiceSheet} style={{ position: 'absolute', inset: 0, background: 'rgba(4,5,7,.62)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, borderRadius: '28px 28px 0 0', background: 'linear-gradient(180deg,#191C22,#0D0F13)', borderTop: '1px solid rgba(255,255,255,.07)', boxShadow: '0 -30px 60px rgba(0,0,0,.7)', padding: '18px 26px 34px', animation: 'gRise .55s cubic-bezier(.16,.84,.24,1) both', maxHeight: '82%', overflow: 'auto' }}>
        <div style={{ width: 38, height: 4, borderRadius: 999, background: 'rgba(255,255,255,.14)', margin: '0 auto 18px' }} />
        <div style={{ font: '300 19px/1.2 Jost,sans-serif', letterSpacing: '.045em' }}>{L.addService}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          {fields.map((f, n) => (
            <div key={n}>
              <div style={{ font: '500 10.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginBottom: 8 }}>{f[0]}</div>
              <input value={s.serviceForm[n] || ''} onChange={(e) => s.setServiceForm(n, e.target.value)} placeholder={f[1]}
                style={{ width: '100%', height: 46, borderRadius: 14, border: '1px solid rgba(255,255,255,.09)', background: 'linear-gradient(180deg,#0B0D11,#111318)', color: ink, padding: '0 14px', font: '400 13px/1 Jost,sans-serif' }} />
              {s.serviceErrs[n] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: '#E8734D', flex: 'none' }} />
                  <span style={{ font: '500 10.5px/1.3 Jost,sans-serif', color: '#E8956F' }}>{s.serviceErrs[n]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={s.submitService} style={{ width: '100%', height: 52, marginTop: 20, borderRadius: 16, ...ghostBtn }}>{L.save}</button>
      </div>
    </div>
  );
}

export function FrameSheet() {
  const s = useStore();
  if (!s.frameSheet) return null;
  const L = s.L(); const he = s.lang === 'he';
  const cat = s.frameCat;
  const shots = SHOTS[cat];
  const photos = s.photoCats[cat] || [];
  const filled = photos.filter(Boolean).length;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 22, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={s.closeFrameSheet} style={{ position: 'absolute', inset: 0, background: 'rgba(4,5,7,.62)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'relative', borderRadius: '28px 28px 0 0', background: 'linear-gradient(180deg,#191C22,#0D0F13)', borderTop: '1px solid rgba(255,255,255,.07)', boxShadow: '0 -30px 60px rgba(0,0,0,.7)', padding: '18px 26px 34px', animation: 'gRise .55s cubic-bezier(.16,.84,.24,1) both', maxHeight: '84%', overflow: 'auto' }}>
        <div style={{ width: 38, height: 4, borderRadius: 999, background: 'rgba(255,255,255,.14)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ font: '300 19px/1.2 Jost,sans-serif', letterSpacing: '.045em', flex: 1 }}>{L.catNames[CAT_ORDER.indexOf(cat)]}</div>
          <div style={{ font: '400 10.5px/1 Jost,sans-serif', color: gold }}>{filled}/{shots.length}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, overflow: 'auto', marginTop: 16, paddingBottom: 2 }}>
          {(CAT_ORDER as PhotoCat[]).filter((c) => c !== 'hero').map((c, n) => (
            <button key={c} onClick={() => useStore.setState({ frameCat: c })} style={{
              flex: 'none', height: 32, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              font: '400 11px/1 Jost,sans-serif', transition: 'all .3s ease',
              background: cat === c ? 'rgba(232,163,61,.14)' : 'rgba(255,255,255,.05)', color: cat === c ? gold : 'rgba(241,240,238,.5)',
            }}>{L.catNames[CAT_ORDER.indexOf(c)]}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 16 }}>
          {shots.map((shot, n) => {
            const url = photos[n];
            return (
              <div key={n}>
                <button onClick={() => (url ? undefined : s.pickPhoto(cat, n))} style={{
                  position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 14, border: '1px solid rgba(255,255,255,.09)',
                  background: url ? `url(${url}) center/cover` : 'rgba(255,255,255,.03)', cursor: 'pointer', padding: 0,
                }}>
                  {!url && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '200 24px/1 Jost,sans-serif', color: 'rgba(241,240,238,.3)' }}>+</span>}
                  {url && (
                    <span onClick={(e) => { e.stopPropagation(); s.clearPhoto(cat, n); }} style={{ position: 'absolute', top: 6, insetInlineEnd: 6, width: 24, height: 24, borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(8,9,11,.72)', backdropFilter: 'blur(8px)', color: ink, font: '400 12px/1 Jost,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</span>
                  )}
                </button>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                  <span style={{ font: '400 10px/1.3 Jost,sans-serif', color: 'rgba(241,240,238,.6)', flex: 1 }}>{he ? shot.he : shot.en}</span>
                  {shot.deg && <span dir="ltr" style={{ font: '400 9px/1 Jost,sans-serif', color: 'rgba(241,240,238,.3)' }}>{shot.deg}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={s.closeFrameSheet} style={{ width: '100%', height: 50, marginTop: 16, borderRadius: 16, ...ghostBtn }}>{L.done}</button>
      </div>
    </div>
  );
}

export function RefuelSheet() {
  const s = useStore();
  if (!s.refuelSheet) return null;
  const L = s.L();
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 26 }}>
      <div onClick={s.closeRefuelSheet} style={{ position: 'absolute', inset: 0, background: 'rgba(4,5,7,.72)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, padding: '26px 26px 34px', borderRadius: '30px 30px 0 0', background: 'linear-gradient(168deg,#191C22 0%,#111318 56%,#0A0B0F 100%)', borderTop: '1px solid rgba(255,255,255,.08)', boxShadow: '0 -30px 70px rgba(0,0,0,.75)', animation: 'gRise .5s cubic-bezier(.16,.84,.24,1) both' }}>
        <div style={{ width: 36, height: 3, borderRadius: 999, background: 'rgba(255,255,255,.14)', margin: '0 auto 22px' }} />
        <div style={{ font: '200 20px/1.2 Jost,sans-serif', letterSpacing: '.06em' }}>{L.addRefuel2}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22 }}>
          <div>
            <div style={{ font: '600 10px/1 Assistant,sans-serif', color: 'rgba(241,240,238,.46)', marginBottom: 9 }}>{L.refuelLiters}</div>
            <input value={s.refuelForm.litres} onChange={(e) => s.setRefuelForm('litres', e.target.value)} placeholder="38" style={inputStyle} />
            {s.refuelErrs.litres && <div style={{ font: '400 10.5px/1 Jost,sans-serif', color: '#E8917C', marginTop: 8 }}>{s.refuelErrs.litres}</div>}
          </div>
          <div>
            <div style={{ font: '600 10px/1 Assistant,sans-serif', color: 'rgba(241,240,238,.46)', marginBottom: 9 }}>{L.refuelCost}</div>
            <input value={s.refuelForm.cost} onChange={(e) => s.setRefuelForm('cost', e.target.value)} placeholder="307" style={inputStyle} />
            {s.refuelErrs.cost && <div style={{ font: '400 10.5px/1 Jost,sans-serif', color: '#E8917C', marginTop: 8 }}>{s.refuelErrs.cost}</div>}
          </div>
          <div>
            <div style={{ font: '600 10px/1 Assistant,sans-serif', color: 'rgba(241,240,238,.46)', marginBottom: 9 }}>{L.refuelStation}</div>
            <input value={s.refuelForm.station} onChange={(e) => s.setRefuelForm('station', e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button onClick={s.closeRefuelSheet} style={{ flex: 1, height: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'none', color: 'rgba(241,240,238,.5)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.cancel}</button>
          <button onClick={s.submitRefuel} style={{ flex: 2, height: 52, borderRadius: 16, ...primaryBtn }}>{L.save}</button>
        </div>
      </div>
    </div>
  );
}
