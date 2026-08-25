import { useStore } from '../store';
import { NAV_ICONS, NAV_KEYS } from '../data';

const SCREEN_TO_TAB: Record<string, string> = {
  details: 'garage', documents: 'service', fuel: 'home', expenses: 'home', trip: 'trips',
  notifications: 'home', wrap: 'profile', friends: 'profile', addVehicle: 'garage',
  units: 'profile', privacy: 'profile', account: 'profile', friend: 'profile',
};

export default function BottomNav() {
  const screen = useStore((s) => s.screen);
  const tab = useStore((s) => s.tab);
  const L = useStore((s) => s.L());
  const active = (NAV_KEYS as readonly string[]).includes(screen) ? screen : (SCREEN_TO_TAB[screen] || 'home');

  return (
    <div style={{
      flex: 'none', display: 'flex', gap: 2, margin: '0 16px calc(env(safe-area-inset-bottom) + 14px)', padding: '9px 8px', borderRadius: 24,
      background: 'linear-gradient(180deg,rgba(24,26,32,.9),rgba(11,13,17,.92))', backdropFilter: 'blur(26px)', border: '1px solid rgba(255,255,255,.05)',
      boxShadow: '0 26px 56px -18px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.04)', zIndex: 15,
    }}>
      {NAV_KEYS.map((key, n) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => tab(key as any)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 0 6px',
              background: 'none', border: 'none', cursor: 'pointer', color: isActive ? '#F5C77E' : 'rgba(241,240,238,.42)',
            }}
          >
            <span style={{ height: 1, width: 16, background: isActive ? '#F5C77E' : 'transparent', transition: 'background .6s ease' }} />
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.05} strokeLinecap="round" strokeLinejoin="round" style={{ transform: isActive ? 'translateY(-1px)' : 'none', transition: 'transform .6s cubic-bezier(.16,.84,.24,1)' }}>
              <path d={NAV_ICONS[n]} />
            </svg>
            <span style={{ font: '400 9px/1 Jost,sans-serif', letterSpacing: '.1em' }}>{L.nav[n]}</span>
          </button>
        );
      })}
    </div>
  );
}
