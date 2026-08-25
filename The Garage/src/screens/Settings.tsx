import { useState } from 'react';
import { useStore } from '../store';
import { UNIT_ROWS, PRIVACY_ROWS } from '../data';
import { card, gold, ink } from '../theme';
import { ScreenHeader } from '../components/UI';

export function Units() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={L.unitsTitle} />
      <div style={{ padding: '0 30px' }}>
        <div style={{ borderRadius: 20, ...card, overflow: 'hidden' }}>
          {UNIT_ROWS.map((row, n) => (
            <div key={row.key} style={{ padding: 16, borderBottom: n < UNIT_ROWS.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
              <div style={{ font: '400 11.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.55)' }}>{he ? row.he : row.en}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 12, padding: 4, borderRadius: 14, background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.05)' }}>
                {row.opts.map((opt, oi) => {
                  const active = (s.units as any)[row.key] === oi;
                  return (
                    <button key={oi} onClick={() => s.setUnits(row.key as any, oi)} style={{ flex: 1, height: 34, borderRadius: 11, border: 'none', cursor: 'pointer', font: '400 11px/1 Jost,sans-serif', background: active ? 'rgba(232,163,61,.14)' : 'none', color: active ? gold : 'rgba(241,240,238,.45)' }}>{he ? opt[0] : opt[1]}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ font: '400 11px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.32)', marginTop: 14 }}>{L.unitsNote}</div>
      </div>
    </div>
  );
}

export function Privacy() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={L.privacyTitle} />
      <div style={{ padding: '0 30px' }}>
        <div style={{ borderRadius: 20, ...card, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, font: '400 12px/1.3 Jost,sans-serif', color: 'rgba(241,240,238,.78)' }}>{L.pushPermission}</span>
              {s.pushPermission === 'denied' ? (
                <span style={{ font: '400 10.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.4)' }}>{L.pushBlocked}</span>
              ) : (
                <button onClick={s.requestPush} style={{ width: 44, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: s.pushPermission === 'granted' ? 'rgba(232,163,61,.5)' : 'rgba(255,255,255,.12)', position: 'relative', transition: 'background .3s ease' }}>
                  <span style={{ position: 'absolute', top: 3, insetInlineStart: s.pushPermission === 'granted' ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'inset-inline-start .3s ease' }} />
                </button>
              )}
            </div>
            <div style={{ font: '400 10.5px/1.65 Jost,sans-serif', color: 'rgba(241,240,238,.38)', marginTop: 9, maxWidth: 250 }}>{L.pushAsk}</div>
          </div>
          {PRIVACY_ROWS.map((row, n) => {
            const label = he ? row.he : row.en;
            const isToggle = row.type === 'toggle';
            const val = (s.privacy as any)[row.key];
            return (
              <div key={row.key} style={{ padding: 16, borderBottom: n < PRIVACY_ROWS.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: 1, font: '400 12px/1.3 Jost,sans-serif', color: 'rgba(241,240,238,.78)' }}>{label}</span>
                  {isToggle && (
                    <button onClick={() => s.setPrivacyToggle(row.key as any)} style={{ width: 44, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: val ? 'rgba(232,163,61,.5)' : 'rgba(255,255,255,.12)', position: 'relative', transition: 'background .3s ease' }}>
                      <span style={{ position: 'absolute', top: 3, insetInlineStart: val ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'inset-inline-start .3s ease' }} />
                    </button>
                  )}
                </div>
                {row.type === 'toggle' && (row as any).dHe && (
                  <div style={{ font: '400 10.5px/1.65 Jost,sans-serif', color: 'rgba(241,240,238,.38)', marginTop: 9, maxWidth: 250 }}>{he ? (row as any).dHe : (row as any).dEn}</div>
                )}
                {row.type === 'seg' && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 12, padding: 4, borderRadius: 14, background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.05)' }}>
                    {row.opts!.map((opt, oi) => (
                      <button key={oi} onClick={() => s.setPrivacySeg(row.key as any, oi)} style={{ flex: 1, height: 34, borderRadius: 11, border: 'none', cursor: 'pointer', font: '400 11px/1 Jost,sans-serif', background: val === oi ? 'rgba(232,163,61,.14)' : 'none', color: val === oi ? gold : 'rgba(241,240,238,.45)' }}>{he ? opt[0] : opt[1]}</button>
                    ))}
                  </div>
                )}
                {row.key === 'loc' && (
                  <div style={{ font: '400 10.5px/1.65 Jost,sans-serif', color: 'rgba(241,240,238,.38)', marginTop: 9, maxWidth: 250 }}>{L.locationAsk}</div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ font: '400 11px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.32)', marginTop: 14 }}>{L.privacyNote}</div>
      </div>
    </div>
  );
}

export function Account() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const initials = s.account.name ? s.account.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '?';
  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={L.accountTitle} />
      <div style={{ padding: '0 30px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 20, borderRadius: 22, ...card }}>
          <div style={{ width: 52, height: 52, flex: 'none', borderRadius: 999, background: 'linear-gradient(150deg,#2A2C34,#16181D)', border: '1px solid rgba(232,163,61,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '300 17px/1 Jost,sans-serif', color: gold }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '300 15px/1 Jost,sans-serif' }}>{s.account.name || (he ? 'ללא שם' : 'No name set')}</div>
            <div style={{ font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 8 }}>{s.account.email || (he ? 'ללא אימייל' : 'No email set')}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 30px' }}>
        <div style={{ borderRadius: 20, ...card, overflow: 'hidden' }}>
          {(['name', 'email', 'phone'] as const).map((key, n) => (
            <div key={key} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <div style={{ font: '400 10.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)' }}>{[he ? 'שם' : 'Name', he ? 'אימייל' : 'Email', he ? 'טלפון' : 'Phone'][n]}</div>
              <input value={s.account[key]} onChange={(e) => s.setAccount(key, e.target.value)} style={{ width: '100%', height: 34, marginTop: 6, border: 'none', background: 'none', color: ink, font: '400 13.5px/1 Jost,sans-serif', padding: 0 }} />
            </div>
          ))}
          <button style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 16, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', color: 'inherit', cursor: 'pointer', textAlign: 'start' }} onClick={() => s.flash(he ? '✓ נשלח קישור' : '✓ Reset link sent')}>
            <span style={{ flex: 1, font: '400 12.5px/1 Jost,sans-serif' }}>{L.password}</span>
            <span style={{ font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.4)' }}>{L.passwordMeta}</span>
            <span style={{ font: '500 14px/1 Jost,sans-serif', color: 'rgba(241,240,238,.28)' }}>{he ? '‹' : '›'}</span>
          </button>
          {!confirmingDelete ? (
            <button style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 16, background: 'none', border: 'none', color: '#E8917C', cursor: 'pointer', textAlign: 'start' }} onClick={() => setConfirmingDelete(true)}>
              <span style={{ flex: 1, font: '400 12.5px/1 Jost,sans-serif' }}>{L.deleteAccount}</span>
              <span style={{ font: '500 14px/1 Jost,sans-serif', opacity: 0.5 }}>{he ? '‹' : '›'}</span>
            </button>
          ) : (
            <div style={{ padding: 16 }}>
              <div style={{ font: '300 15px/1.3 Jost,sans-serif' }}>{L.deleteAccountTitle}</div>
              <div style={{ font: '400 11.5px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.5)', marginTop: 9 }}>{L.deleteAccountBody}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, height: 40, borderRadius: 13, border: '1px solid rgba(255,255,255,.12)', background: 'none', color: 'rgba(241,240,238,.7)', font: '400 11.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.cancel}</button>
                <button onClick={s.resetAll} style={{ flex: 1, height: 40, borderRadius: 13, border: '1px solid rgba(180,67,47,.5)', background: 'rgba(180,67,47,.18)', color: '#E8917C', font: '400 11.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.deleteAccountCta}</button>
              </div>
            </div>
          )}
        </div>
        <button onClick={() => s.flash(L.accountSaved)} style={{ width: '100%', height: 50, marginTop: 14, borderRadius: 16, border: '1px solid rgba(232,163,61,.4)', background: 'rgba(232,163,61,.1)', color: gold, font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{he ? 'שמירת פרטי חשבון' : 'Save account details'}</button>
        <button onClick={() => useStore.setState({ phase: 'auth', screen: 'home', stack: [] })} style={{ width: '100%', height: 50, marginTop: 8, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'none', color: 'rgba(241,240,238,.6)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.signOut}</button>
      </div>
    </div>
  );
}
