import { useWallet } from '../state/useWallet'
import { t } from '../i18n/he'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="font-display text-lg font-bold tabular-nums text-white">{value}</div>
    </div>
  )
}

export default function StatsPanel() {
  const s = useWallet()
  const decided = s.wins + s.losses
  const rate = decided > 0 ? Math.round((s.wins / decided) * 100) : 0

  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label={t('handsPlayed')} value={String(s.handsPlayed)} />
      <Stat label={t('wins')} value={String(s.wins)} />
      <Stat label={t('losses')} value={String(s.losses)} />
      <Stat label={t('pushes')} value={String(s.pushes)} />
      <Stat label={t('blackjacks')} value={String(s.blackjacks)} />
      <Stat label={t('winRate')} value={`${rate}%`} />
      <div className="col-span-3">
        <Stat label={t('biggestWin')} value={Math.round(s.biggestWin).toLocaleString('he-IL')} />
      </div>
    </div>
  )
}
