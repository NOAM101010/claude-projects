import { lazy, Suspense, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { AccountTier } from '../lib/accountApi'
import { TradeList } from './TradeList'
import { DEFAULT_TRADE_FILTERS, type TradeFiltersState } from '../lib/tradeFilters'
import type { TradeFilter } from '../App'
import type { CurrencyCode, Trade } from '../types/trade'
import styles from './Journal.module.css'

// recharts (טעון ע"י Dashboard) הוא תלות כבדה שלא צריכה להיכנס ל-chunk הראשי - Home/Trades לא
// צריכים אותה בכלל. נטענת רק כשהמשתמש בפועל עובר לתת-הטאב הזה.
const Dashboard = lazy(() => import('./Dashboard').then((m) => ({ default: m.Dashboard })))

export type JournalSubTab = 'trades' | 'dashboard'

interface JournalProps {
  trades: Trade[]
  baseCurrency: CurrencyCode
  tier: AccountTier
  /** פותח את מודל קוד הגישה (שדרוג) - מועבר עד ה-Dashboard (Weekly Recap, Pro-only). */
  onOpenAccessCode: () => void
  subTab: JournalSubTab
  onSubTabChange: (tab: JournalSubTab) => void
  filter: TradeFilter | null
  onClearFilter: () => void
  onAdd: () => void
  onEdit: (trade: Trade) => void
  onDelete: (id: string) => void
  onSelectSymbol: (symbol: string) => void
  onSelectSetup: (setup: string) => void
}

/**
 * מסך "Journal": sub-nav פנימי בין Trades/Dashboard (אותו דפוס segmented control כמו
 * `Tools.tsx`). מקפל את `TradeList`/`Dashboard` - הזרימה של לחיצה על שורת סימבול/setup
 * ב-Dashboard שמסננת את Trades (`goToFilteredTrades` ב-`App.tsx`) לא השתנתה, רק ה-subTab
 * עצמו מנוהל כאן ולא כ-tab עליון נפרד. Open Positions קודם היה תת-טאב שלישי כאן - קיבל
 * טאב עליון משלו (ראה `PillNav.tsx` tab='positions') כי המשתמש רצה גישה ישירה מ-Home.
 */
export function Journal({
  trades,
  baseCurrency,
  tier,
  onOpenAccessCode,
  subTab,
  onSubTabChange,
  filter,
  onClearFilter,
  onAdd,
  onEdit,
  onDelete,
  onSelectSymbol,
  onSelectSetup,
}: JournalProps) {
  const { t } = useLanguage()
  // ראה TradeList.tsx: המצב הועבר לכאן (במקום useState מקומי בתוך TradeList) כדי לשרוד
  // מעבר בין תת-הטאבים (TradeList נכנס/יוצא מה-DOM בכל מעבר subTab).
  const [advFilters, setAdvFilters] = useState<TradeFiltersState>(DEFAULT_TRADE_FILTERS)

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.subNav} btn-metal`}>
        <button type="button" data-active={subTab === 'trades'} onClick={() => onSubTabChange('trades')}>
          {t('nav.trades')}
        </button>
        <button type="button" data-active={subTab === 'dashboard'} onClick={() => onSubTabChange('dashboard')}>
          {t('nav.dashboard')}
        </button>
      </div>

      {subTab === 'trades' ? (
        <TradeList
          trades={trades}
          filter={filter}
          onClearFilter={onClearFilter}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          advFilters={advFilters}
          setAdvFilters={setAdvFilters}
        />
      ) : (
        <Suspense fallback={<p className="loadingState">{t('app.loading')}</p>}>
          <Dashboard
            trades={trades}
            baseCurrency={baseCurrency}
            tier={tier}
            onOpenAccessCode={onOpenAccessCode}
            onSelectSymbol={onSelectSymbol}
            onSelectSetup={onSelectSetup}
          />
        </Suspense>
      )}
    </div>
  )
}
