import { CSSProperties, ReactNode } from 'react';
import { useStore } from '../store';
import { card, backBtn, labelFont, ink, gold } from '../theme';
import { PLATES } from '../data';

export function ScreenHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  const back = useStore((s) => s.back);
  const he = useStore((s) => s.lang === 'he');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 30px 32px' }}>
      <button onClick={back} style={backBtn}>{he ? '→' : '←'}</button>
      <div style={{ flex: 1 }}>
        {sub && <div style={labelFont(he, 's')}>{sub}</div>}
        <div style={{ font: '200 22px/1.15 inherit', letterSpacing: '.09em', marginTop: sub ? 8 : 0 }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const he = useStore((s) => s.lang === 'he');
  return <div style={{ ...labelFont(he), color: 'rgba(241,240,238,.48)', marginBottom: 15, ...style }}>{children}</div>;
}

export function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} style={{ ...card, borderRadius: 18, padding: 18, ...(onClick ? { cursor: 'pointer', textAlign: 'start', color: 'inherit', width: '100%', border: card.border } : {}), ...style }}>
      {children}
    </Tag>
  );
}

export function PlateChip({ plate }: { plate: string }) {
  const cur = useStore((s) => s.units.cur);
  const i = useStore((s) => s.i());
  const P = PLATES[cur] || PLATES[0];
  return (
    <span dir="ltr" style={{ display: 'inline-flex', alignItems: 'stretch', overflow: 'hidden', borderRadius: 4, height: 24, background: P.face, border: `1px solid ${P.edge}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45), 0 2px 8px -3px rgba(0,0,0,.8)' }}>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '0 4px', font: '600 6px/1 Assistant,sans-serif', letterSpacing: '.02em', background: P.band, color: '#F4F4F1' }}>{P.code[i]}</span>
      <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', font: '600 13px/1 Jost,sans-serif', letterSpacing: '.06em', color: P.ink }}>{plate}</span>
    </span>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div style={{ position: 'absolute', insetInline: 24, bottom: 104, padding: '14px 16px', borderRadius: 16, background: 'rgba(20,22,27,.95)', backdropFilter: 'blur(18px)', border: '1px solid rgba(78,190,130,.4)', display: 'flex', alignItems: 'center', gap: 10, animation: 'gRise .3s cubic-bezier(.2,.8,.2,1) both', boxShadow: '0 14px 34px rgba(0,0,0,.5)', zIndex: 40 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: '#4EBE82', flex: 'none' }} />
      <span style={{ font: '500 12px/1.4 Jost,sans-serif', color: ink }}>{toast}</span>
    </div>
  );
}

export function EmptyDash({ text, cta, onClick }: { text: string; cta: string; onClick: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 22px', background: 'radial-gradient(72% 60% at 50% 50%,#15181E 0%,#0A0B0F 78%)' }}>
      <div style={{ width: 46, height: 46, borderRadius: 15, border: '1px dashed rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '200 22px/1 Jost,sans-serif', color: 'rgba(241,240,238,.4)' }}>+</div>
      <div style={{ font: '400 11.5px/1.6 Jost,sans-serif', color: 'rgba(241,240,238,.48)', textAlign: 'center', maxWidth: 180 }}>{text}</div>
      <button onClick={onClick} style={{ height: 38, padding: '0 18px', borderRadius: 13, border: '1px solid rgba(232,163,61,.4)', background: 'rgba(232,163,61,.1)', color: gold, font: '400 11px/1 Jost,sans-serif', cursor: 'pointer' }}>{cta}</button>
    </div>
  );
}
