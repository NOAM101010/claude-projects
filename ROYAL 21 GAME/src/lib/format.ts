export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export const fmtSigned = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));

export const pct = (part: number, total: number) =>
  total <= 0 ? '0%' : `${Math.round((part / total) * 100)}%`;

export const shortDate = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export const todayKey = () => new Date().toISOString().slice(0, 10);
