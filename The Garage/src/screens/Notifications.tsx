import { useStore } from '../store';
import { card } from '../theme';
import { ScreenHeader } from '../components/UI';

function timeAgo(ts: number, he: boolean) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000), hr = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000);
  if (min < 1) return he ? 'עכשיו' : 'now';
  if (hr < 1) return he ? min + 'ד' : min + 'm';
  if (day < 1) return he ? hr + 'ש' : hr + 'h';
  return he ? day + 'י' : day + 'd';
}

export default function Notifications() {
  const s = useStore();
  const L = s.L(); const he = s.lang === 'he';
  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={L.notifications} />
      {s.notifications.length === 0 ? (
        <div style={{ margin: '0 30px', padding: '38px 22px', borderRadius: 20, border: '1px dashed rgba(255,255,255,.1)', textAlign: 'center', font: '400 11.5px/1.7 Jost,sans-serif', color: 'rgba(241,240,238,.46)' }}>{L.emptyNotifications}</div>
      ) : (
        <div style={{ padding: '0 30px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {s.notifications.map((n) => (
            <button key={n.id} onClick={() => n.to && s.go(n.to)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 15, borderRadius: 18, cursor: n.to ? 'pointer' : 'default', textAlign: 'start', color: 'inherit', ...card }}>
              <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{n.icon}</span>
              <span style={{ flex: 1, textAlign: 'start' }}>
                <span style={{ display: 'block', font: '400 12.5px/1.35 Jost,sans-serif' }}>{n.title}</span>
                <span style={{ display: 'block', font: '400 11.5px/1.55 Jost,sans-serif', color: 'rgba(241,240,238,.45)', marginTop: 7 }}>{n.body}</span>
              </span>
              <span style={{ font: '500 9.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.3)' }}>{timeAgo(n.when, he)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
