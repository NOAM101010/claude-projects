import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { EXPENSE_CAT_DEFS } from '../data';
import { card, gold, money } from '../theme';
import { ScreenHeader, SectionLabel } from '../components/UI';

function parseDate(d: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

function last6Months(lang: string) {
  const out: { year: number; month: number; label: string }[] = [];
  const now = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short' }) });
  }
  return out;
}

export default function Expenses() {
  const s = useStore();
  const L = s.L(); const i = s.i(); const he = s.lang === 'he';
  const [hover, setHover] = useState(5);
  const ex = s.expenseEntries;
  const own = (n: number) => ex[n] || [];
  const total = (n: number) => own(n).reduce((a, e) => a + e.amount, 0);
  const grandTotal = EXPENSE_CAT_DEFS.reduce((a, _, n) => a + total(n), 0);
  const catMax = Math.max(1, ...EXPENSE_CAT_DEFS.map((_, n) => total(n)));

  const months = useMemo(() => last6Months(s.lang), [s.lang]);
  const monthly = months.map(({ year, month }) =>
    Object.values(ex).flat().filter((e) => { const d = parseDate(e.date); return d && d.getFullYear() === year && d.getMonth() === month; }).reduce((a, e) => a + e.amount, 0));
  const expMax = Math.max(1, ...monthly);
  const thisMonthTotal = monthly[5];

  return (
    <div style={{ animation: 'gFade .6s ease both' }}>
      <ScreenHeader title={L.expenses} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 30px 34px' }}>
        {[thisMonthTotal, grandTotal].map((v, n) => (
          <div key={n} style={{ padding: 20, borderRadius: 20, ...card }}>
            <div style={{ font: '500 9.5px/1 Jost,sans-serif', letterSpacing: '.14em', color: 'rgba(241,240,238,.46)' }}>{L.expenseTotals[n]}</div>
            <div style={{ font: '300 22px/1 Jost,sans-serif', letterSpacing: '.045em', color: gold, marginTop: 11 }}>{money(v)}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 30px 34px' }}>
        <div style={{ padding: '18px 16px', borderRadius: 20, ...card }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130 }}>
            {months.map((mo, n) => (
              <div key={n} onMouseEnter={() => setHover(n)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                <div style={{ width: '100%', borderRadius: '8px 8px 3px 3px', height: `${(monthly[n] / expMax) * 100}px`, minHeight: monthly[n] > 0 ? 3 : 0, background: n === hover ? gold : 'rgba(232,163,61,.35)', transition: 'height .5s cubic-bezier(.2,.8,.2,1), background .2s ease' }} />
                <div style={{ font: '500 9.5px/1 Jost,sans-serif', color: n === hover ? gold : 'rgba(241,240,238,.4)' }}>{mo.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <span style={{ font: '400 11.5px/1 Jost,sans-serif', color: 'rgba(241,240,238,.45)' }}>{months[hover].label}</span>
            <span style={{ font: '300 14px/1 Jost,sans-serif', color: gold }}>{money(monthly[hover])}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 30px' }}>
        <SectionLabel>{L.categories}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {EXPENSE_CAT_DEFS.map((c, n) => (
            <div key={n} style={{ padding: '15px 16px', borderRadius: 18, ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 6, height: 6, flex: 'none', borderRadius: 999, background: c.color }} />
                <span style={{ flex: 1, font: '500 12px/1 Jost,sans-serif', color: 'rgba(241,240,238,.78)' }}>{he ? c.he : c.en}</span>
                <span style={{ font: '200 15px/1 Jost,sans-serif', letterSpacing: '.02em' }}>{money(total(n))}</span>
                <button onClick={() => s.openExpSheet(n)} title={L.addExpense} style={{ width: 26, height: 26, flex: 'none', borderRadius: 9, border: '1px solid rgba(232,163,61,.35)', background: 'rgba(232,163,61,.1)', color: gold, font: '300 14px/1 Jost,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden', marginTop: 12 }}>
                <div style={{ height: '100%', width: `${Math.round((total(n) / catMax) * 100)}%`, background: c.color, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
              </div>
              {own(n).length > 0 && (
                <div style={{ marginTop: 13, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,.055)', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {own(n).map((e, k) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span dir="ltr" style={{ font: '400 10px/1 Jost,sans-serif', color: 'rgba(241,240,238,.34)', unicodeBidi: 'isolate' } as any}>{e.date}</span>
                      <span style={{ flex: 1, font: '400 11px/1.3 Jost,sans-serif', color: 'rgba(241,240,238,.5)' }}>{e.note || L.expNoNote}</span>
                      <span style={{ font: '400 11.5px/1 Jost,sans-serif', color: gold }}>{money(e.amount)}</span>
                      <button onClick={() => s.deleteExpense(n, k)} style={{ width: 20, height: 20, flex: 'none', borderRadius: 6, border: 'none', background: 'none', color: 'rgba(241,240,238,.28)', font: '400 11px/1 Jost,sans-serif', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
