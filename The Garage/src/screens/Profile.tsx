import { useStore, activeVehicles, archivedVehicles } from '../store';
import { card, gold, ink, labelFont } from '../theme';
import { SectionLabel } from '../components/UI';

export default function Profile() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  const active = activeVehicles(s);
  const archived = archivedVehicles(s);
  const heroShot = s.photoCats.hero?.[0] || s.photoCats.exterior?.filter(Boolean)[0] || '';
  const initials = s.account.name ? s.account.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '?';

  const settingsRows: { key: string; label: string; value: string; onPick: () => void }[] = [
    { key: 'notifications', label: L.settings[0], value: L.settingsMeta.notifications, onPick: () => s.go('notifications') },
    { key: 'units', label: L.settings[1], value: L.settingsMeta.units, onPick: () => s.go('units') },
    { key: 'friends', label: L.settings[3], value: String(s.frFriends.length), onPick: () => s.go('friends') },
    { key: 'privacy', label: L.settings[4], value: '', onPick: () => s.go('privacy') },
    { key: 'account', label: L.settings[5], value: '', onPick: () => s.go('account') },
  ];

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <div style={{ padding: '0 30px 20px' }}>
        <div style={{ font: '300 25px/1.15 Jost,sans-serif', letterSpacing: '.045em' }}>{L.profile}</div>
      </div>
      <div style={{ padding: '0 30px 34px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 22, borderRadius: 22, ...card }}>
          <div style={{ width: 56, height: 56, flex: 'none', borderRadius: 999, background: 'linear-gradient(150deg,#2A2C34,#16181D)', border: '1px solid rgba(232,163,61,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '300 18px/1 Jost,sans-serif', color: gold }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '300 16px/1 Jost,sans-serif' }}>{s.account.name || (he ? 'ללא שם' : 'No name set')}</div>
            <div style={{ font: '400 11.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 8 }}>{s.account.email || (he ? 'ללא אימייל' : 'No email set')}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 30px 34px' }}>
        <SectionLabel>{L.myVehicles}</SectionLabel>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 15, background: 'linear-gradient(168deg,#14171C,#0B0D11)', border: '1px solid rgba(255,255,255,.04)', marginBottom: 10 }}>
          {[L.activeVehicles, L.previousVehicles].map((label, n) => (
            <button key={n} onClick={() => useStore.setState({ vehTab: n })} style={{ flex: 1, height: 38, borderRadius: 12, border: 'none', cursor: 'pointer', font: '400 11.5px/1 Jost,sans-serif', transition: 'all .3s ease', background: s.vehTab === n ? 'rgba(232,163,61,.14)' : 'none', color: s.vehTab === n ? gold : 'rgba(241,240,238,.42)' }}>{label}</button>
          ))}
        </div>
        {s.vehTab === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {active.map((v) => (
              <div key={v.id} style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => s.setPrimary(v.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, ...card, cursor: 'pointer', textAlign: 'start', color: 'inherit' }}>
                  <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 13, background: (v.id === s.primaryId && heroShot) ? `url(${heroShot}) center/cover` : 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 12px/1 Jost,sans-serif' }}>{!(v.id === s.primaryId && heroShot) && (v.make[0] + v.model[0])}</span>
                  <span style={{ flex: 1, textAlign: 'start' }}>
                    <span style={{ display: 'block', font: '400 13.5px/1 Jost,sans-serif' }}>{v.make} {v.model}</span>
                    <span style={{ display: 'block', font: '400 11.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 7 }}>{v.year} · {v.plate}</span>
                  </span>
                </button>
                <button onClick={() => s.setPrimary(v.id)} style={{ width: 44, flex: 'none', borderRadius: 14, border: 'none', background: 'none', cursor: 'pointer', color: v.id === s.primaryId ? gold : 'rgba(241,240,238,.25)', fontSize: 18 }}>{v.id === s.primaryId ? '★' : '☆'}</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {archived.length > 0 ? archived.map((v) => (
              <div key={v.id} style={{ padding: 18, borderRadius: 18, background: 'linear-gradient(168deg,#14171C,#0B0D11)', border: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ font: '400 13.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.72)' }}>{v.make} {v.model}</span>
                  <span style={{ font: '400 8.5px/1 Jost,sans-serif', letterSpacing: '.14em', padding: '4px 7px', borderRadius: 999, background: 'rgba(255,255,255,.07)', color: 'rgba(241,240,238,.45)' }}>{L.soldTag}</span>
                </div>
                <div style={{ font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.35)', marginTop: 8 }}>{v.year} · {v.plate}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => s.restoreVehicle(v.id)} style={{ flex: 1, height: 40, borderRadius: 13, border: '1px solid rgba(255,255,255,.12)', background: 'none', color: ink, font: '400 11.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.restore}</button>
                  <button onClick={() => s.askConfirm('delete', v.id)} style={{ flex: 1, height: 40, borderRadius: 13, border: '1px solid rgba(180,67,47,.4)', background: 'rgba(180,67,47,.1)', color: '#E8917C', font: '400 11.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.deleteForever}</button>
                </div>
              </div>
            )) : null}
            <div style={{ font: '400 11.5px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.3)', padding: '4px 2px' }}>{archived.length === 0 ? L.noArchived : ''}</div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 30px 34px' }}>
        <SectionLabel>{he ? 'הגדרות' : 'Settings'}</SectionLabel>
        <div style={{ borderRadius: 20, ...card, overflow: 'hidden' }}>
          {settingsRows.map((r, n) => (
            <button key={r.key} onClick={r.onPick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', color: 'inherit', cursor: 'pointer', textAlign: 'start' }}>
              <span style={{ flex: 1, font: '500 12.5px/1 Jost,sans-serif' }}>{r.label}</span>
              <span style={{ font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.38)' }}>{r.value}</span>
              <span style={{ font: '500 14px/1 Jost,sans-serif', color: 'rgba(241,240,238,.28)' }}>{he ? '‹' : '›'}</span>
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
            <span style={{ flex: 1, font: '500 12.5px/1 Jost,sans-serif' }}>{L.settings[2]}</span>
            <span style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 999, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)' }}>
              {[['he', 'עב'], ['en', 'EN']].map(([k, label]) => (
                <button key={k} onClick={() => s.setLang(k as any)} style={{ padding: '7px 13px', borderRadius: 999, border: 'none', cursor: 'pointer', font: '400 11px/1 Jost,sans-serif', background: s.lang === k ? 'rgba(255,255,255,.06)' : 'none', color: s.lang === k ? ink : 'rgba(241,240,238,.45)' }}>{label}</button>
              ))}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 30px' }}>
        <button onClick={() => s.go('wrap')} style={{ position: 'relative', width: '100%', padding: 22, borderRadius: 22, border: '1px solid rgba(232,163,61,.3)', background: 'linear-gradient(140deg,#20180D,#121318)', color: 'inherit', cursor: 'pointer', textAlign: 'start' }}>
          <span style={{ display: 'block', ...labelFont(he, 's'), color: gold }}>{L.wrapTag}</span>
          <span style={{ display: 'block', font: '300 19px/1.2 Jost,sans-serif', letterSpacing: '.045em', marginTop: 11 }}>{L.wrapTitle}</span>
          <span style={{ display: 'block', font: '400 11.5px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.45)', marginTop: 9, maxWidth: 230 }}>{L.wrapSub}</span>
        </button>
      </div>
    </div>
  );
}
