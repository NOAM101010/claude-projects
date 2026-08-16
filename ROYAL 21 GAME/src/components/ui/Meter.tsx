interface Props {
  value: number;
  max: number;
  tone?: 'gold' | 'jade';
  height?: number;
  label?: string;
}

export function Meter({ value, max, tone = 'gold', height = 8, label }: Props) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div>
      {label && <div className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>{label}</div>}
      <div
        className="rounded-full overflow-hidden border border-white/10"
        style={{ height, background: 'rgba(255,255,255,.06)' }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${pct}%`,
            background: tone === 'gold'
              ? 'linear-gradient(90deg, var(--gold-deep), var(--gold-hi))'
              : 'linear-gradient(90deg, #1c6b48, var(--jade-hi))',
            boxShadow: tone === 'gold' ? '0 0 12px var(--glow-gold)' : '0 0 12px rgba(79,211,154,.3)',
          }}
        />
      </div>
    </div>
  );
}
