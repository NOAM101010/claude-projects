import { useStore, allPeople } from '../store';
import { card, gold, ink } from '../theme';
import { ScreenHeader } from '../components/UI';

export function Friends() {
  const s = useStore();
  const L = s.L(); const i = s.i(); const he = s.lang === 'he';
  const byId = (id: string) => allPeople().find((p) => p.initials === id);
  const friends = s.frFriends.map(byId).filter(Boolean) as ReturnType<typeof allPeople>;
  const requests = s.frRequests.map(byId).filter(Boolean) as ReturnType<typeof allPeople>;
  const q = s.frQuery.trim().toLowerCase();
  const results = !q ? [] : allPeople()
    .filter((p) => s.frFriends.indexOf(p.initials) < 0 && s.frRequests.indexOf(p.initials) < 0)
    .filter((p) => p.name[i].toLowerCase().includes(q) || (p.handle || '').toLowerCase().includes(q));

  const list = [friends, requests, results][s.frTab];
  const emptyText = [L.frEmptyFriends, L.frEmptyReq, q ? L.frEmptySearch : L.frSearchHint][s.frTab];
  const tabs = L.frTabs.map((label, n) => n === 1 && requests.length ? `${label} · ${requests.length}` : label);

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={L.friends} />
      <div style={{ padding: '0 30px' }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 15, background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.05)' }}>
          {tabs.map((label, n) => (
            <button key={n} onClick={() => s.setFrTab(n)} style={{ flex: 1, height: 38, borderRadius: 12, border: 'none', cursor: 'pointer', font: '400 11.5px/1 Jost,sans-serif', transition: 'all .3s ease', background: s.frTab === n ? 'rgba(232,163,61,.14)' : 'none', color: s.frTab === n ? gold : 'rgba(241,240,238,.42)' }}>{label}</button>
          ))}
        </div>

        {s.frTab === 2 && (
          <input value={s.frQuery} onChange={(e) => s.setFrQuery(e.target.value)} placeholder={L.friendPlaceholder}
            style={{ width: '100%', height: 46, marginTop: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,.09)', background: '#121419', color: ink, padding: '0 14px', font: '400 12.5px/1 Jost,sans-serif' }} />
        )}

        {list.length === 0 ? (
          <div style={{ marginTop: 16, padding: '38px 22px', borderRadius: 20, border: '1px dashed rgba(255,255,255,.1)', textAlign: 'center', font: '400 11.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.46)' }}>{emptyText}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {list.map((p) => {
              const isRequest = s.frTab === 1;
              const isSearch = s.frTab === 2;
              const isSent = s.frSent.indexOf(p.initials) >= 0;
              return (
                <div key={p.initials} style={{ padding: '16px 18px', borderRadius: 18, ...card }}>
                  <button onClick={() => s.openFriend(p.initials)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'start' }}>
                    <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, background: 'linear-gradient(150deg,#2A2C34,#16181D)', border: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '300 13px/1 Jost,sans-serif', color: 'rgba(241,240,238,.7)' }}>{p.initials}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', font: '400 13px/1 Jost,sans-serif' }}>{p.name[i]}</span>
                      <span style={{ display: 'block', font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 7 }}>{p.car[i]}</span>
                    </span>
                    <span style={{ textAlign: 'end', flex: 'none' }}>
                      <span style={{ display: 'block', font: '300 12.5px/1 Jost,sans-serif', color: gold }}>{p.km} {L.km}</span>
                      <span style={{ display: 'block', font: '400 10px/1 Jost,sans-serif', color: 'rgba(241,240,238,.34)', marginTop: 6 }}>{L.frThisMonth}</span>
                    </span>
                  </button>
                  {isRequest && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 13, borderTop: '1px solid rgba(255,255,255,.055)' }}>
                      <span style={{ flex: 1, font: '400 10px/1 Jost,sans-serif', color: 'rgba(241,240,238,.32)' }}>{p.mutual ? L.frMutual(p.mutual) : L.frNoMutual}</span>
                      <button onClick={() => s.declineFriend(p.initials)} style={{ height: 34, padding: '0 14px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'none', color: 'rgba(241,240,238,.5)', font: '400 11px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.frDecline}</button>
                      <button onClick={() => s.acceptFriend(p.initials)} style={{ height: 34, padding: '0 16px', borderRadius: 11, border: '1px solid rgba(232,163,61,.42)', background: 'rgba(232,163,61,.12)', color: gold, font: '400 11px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.frAccept}</button>
                    </div>
                  )}
                  {isSearch && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 13, borderTop: '1px solid rgba(255,255,255,.055)' }}>
                      <span dir="ltr" style={{ flex: 1, font: '400 10px/1 Jost,sans-serif', color: 'rgba(241,240,238,.32)', textAlign: 'start' }}>{p.handle}</span>
                      {!isSent ? (
                        <button onClick={() => s.requestFriend(p.initials)} style={{ height: 34, padding: '0 16px', borderRadius: 11, border: '1px solid rgba(232,163,61,.42)', background: 'rgba(232,163,61,.12)', color: gold, font: '400 11px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.frRequest}</button>
                      ) : (
                        <span style={{ height: 34, display: 'flex', alignItems: 'center', padding: '0 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,.09)', font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.38)' }}>{L.frPendingBtn}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function FriendProfile() {
  const s = useStore();
  const L = s.L(); const i = s.i(); const he = s.lang === 'he';
  const prof = s.frProfile ? allPeople().find((p) => p.initials === s.frProfile) : null;
  if (!prof) return null;
  const isFriend = s.frFriends.indexOf(prof.initials) >= 0;
  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={prof.name[i]} />
      <div style={{ padding: '0 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 20, borderRadius: 22, ...card }}>
          <span style={{ width: 54, height: 54, flex: 'none', borderRadius: 999, background: 'linear-gradient(150deg,#2A2C34,#16181D)', border: '1px solid rgba(232,163,61,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '300 17px/1 Jost,sans-serif', color: gold }}>{prof.initials}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', font: '300 16px/1 Jost,sans-serif' }}>{prof.name[i]}</span>
            <span dir="ltr" style={{ display: 'block', font: '400 11px/1 Jost,sans-serif', color: 'rgba(241,240,238,.42)', marginTop: 8, textAlign: 'start' }}>{prof.handle}</span>
          </span>
        </div>

        <div style={{ ...{ font: '600 10.5px/1 Assistant,sans-serif', letterSpacing: '.14em' }, color: 'rgba(241,240,238,.48)', margin: '32px 0 15px' }}>{L.frProfileCar}</div>
        <div style={{ padding: 20, borderRadius: 22, ...card }}>
          <div style={{ font: '200 19px/1.2 Jost,sans-serif', letterSpacing: '.06em' }}>{prof.car[i]}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 18, paddingTop: 15, borderTop: '1px solid rgba(255,255,255,.055)' }}>
            <span style={{ font: '400 10px/1 Jost,sans-serif', letterSpacing: '.12em', color: 'rgba(241,240,238,.46)' }}>{L.frThisMonth}</span>
            <span style={{ font: '200 20px/1 Jost,sans-serif', letterSpacing: '.02em', color: gold, marginInlineStart: 'auto' }}>{prof.km} {L.km}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 13 }}>
            <span style={{ font: '400 10px/1 Jost,sans-serif', letterSpacing: '.12em', color: 'rgba(241,240,238,.46)' }}>{L.frSince}</span>
            <span style={{ font: '400 11.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.6)', marginInlineStart: 'auto' }}>{L.frSinceVal}</span>
          </div>
        </div>
        <div style={{ font: '400 10.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.3)', marginTop: 14 }}>{L.frProfileNote}</div>

        {isFriend && (
          <button onClick={() => s.removeFriend(prof.initials)} style={{ width: '100%', height: 50, marginTop: 18, borderRadius: 16, border: '1px solid rgba(232,145,124,.3)', background: 'none', color: '#E8917C', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer' }}>{L.frRemove}</button>
        )}
      </div>
    </div>
  );
}
