import type { CSSProperties } from 'react';

export const ink = '#F1F0EE';
export const gold = '#F5C77E';
export const goldDeep = '#E8A33D';

export const card: CSSProperties = {
  background: 'linear-gradient(168deg,#171A20 0%,#101216 52%,#0C0E12 100%)',
  border: '1px solid rgba(255,255,255,.055)',
  boxShadow: '0 26px 54px -26px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 0 1px rgba(255,255,255,.014)',
};

export function labelFont(he: boolean, size: 'md' | 's' | 'xs' = 'md'): CSSProperties {
  if (he) {
    const px = size === 'md' ? 10.5 : size === 's' ? 10 : 9.5;
    const ls = size === 'md' ? '.14em' : size === 's' ? '.13em' : '.12em';
    return { font: `600 ${px}px/1 Assistant,sans-serif`, letterSpacing: ls };
  }
  const px = size === 'md' ? 8 : size === 's' ? 7.5 : 7;
  const ls = size === 'md' ? '.3em' : size === 's' ? '.3em' : '.26em';
  return { font: `400 ${px}px/1 Michroma,sans-serif`, letterSpacing: ls };
}

export function numFont(he: boolean) {
  return he ? 'Assistant,sans-serif' : 'Jost,sans-serif';
}

export const backBtn: CSSProperties = {
  width: 38, height: 38, flex: 'none', borderRadius: 13, border: '1px solid rgba(255,255,255,.09)',
  background: '#121419', color: ink, font: '500 15px/1 Jost,sans-serif', cursor: 'pointer',
};

export const dashedBtn: CSSProperties = {
  height: 52, borderRadius: 18, border: '1px dashed rgba(255,255,255,.14)', background: 'none',
  color: 'rgba(241,240,238,.65)', font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer',
};

export const primaryBtn: CSSProperties = {
  border: '1px solid rgba(232,163,61,.42)', background: 'rgba(232,163,61,.12)', color: gold,
  font: '400 12.5px/1 Jost,sans-serif', cursor: 'pointer',
};

export const ghostBtn: CSSProperties = {
  border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.03)', color: ink,
  font: '300 13px/1 Jost,sans-serif', cursor: 'pointer',
};

export function money(n: number) {
  return '₪' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
export function nf(n: number) {
  return n.toLocaleString('en-US');
}
