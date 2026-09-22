import { useEffect, useState } from 'react'
import { AccessCodeGate } from './components/AccessCodeGate'
import { AccessCodeModal } from './components/AccessCodeModal'
import { DemoBanner, DemoLimitBlock } from './components/DemoStatus'
import { DesktopStatBar } from './components/DesktopStatBar'
import { Footer } from './components/Footer'
import { HeaderClock } from './components/HeaderClock'
import { Home } from './components/Home'
import { InstallBanner } from './components/InstallBanner'
import { Journal } from './components/Journal'
import type { JournalSubTab } from './components/Journal'
import { OpenPositions } from './components/OpenPositions'
import { LaunchScreen } from './components/LaunchScreen'
import { MonthlyCalendar } from './components/MonthlyCalendar'
import { NotificationBell } from './components/NotificationBell'
import { PillNav } from './components/PillNav'
import type { Tab } from './components/PillNav'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { Tools } from './components/Tools'
import { TradeForm } from './components/TradeForm'
import { UndoToast } from './components/UndoToast'
import { WorkspaceSettings } from './components/WorkspaceSettings'
import { WorkspaceSwitcher } from './components/WorkspaceSwitcher'
import { REQUIRE_ACCESS_CODE_GATE, SHOW_INTRO_SPLASH } from './config/locks'
import type { RedeemResult } from './hooks/useRedeemCode'
import { useMarketData } from './hooks/useMarketData'
import { useLanguage } from './i18n/LanguageContext'
import { canCreateTrade, getAccount, updateAccountLanguage } from './lib/accountApi'
import type { AccountTier } from './lib/accountApi'
import { deleteChartImage } from './lib/chartImagesApi'
import { ensureSession, getStoredSession, isCodeVerified } from './lib/session'
import type { Session } from './lib/session'
import { listSlTpHistoryForTrades } from './lib/slTpHistoryApi'
import type { SlTpHistoryEntry } from './lib/slTpHistoryApi'
import { createTrade, deleteTrade, listTrades, updateTrade } from './lib/tradesApi'
import { TEMPLATE_FIELD_DEFAULTS, createWorkspace, ensureWorkspace, listWorkspaces } from './lib/workspacesApi'
import type { FieldSettings, Workspace, WorkspaceTemplate } from './lib/workspacesApi'
import type { Trade } from './types/trade'
import './App.css'

const ACTIVE_WORKSPACE_KEY = 'tradepanel_active_workspace_id'
/** חלון הזמן שבו "Undo" זמין אחרי מחיקת טרייד, לפני שהמחיקה בפועל (Supabase + ניקוי תמונה) קורית. */
const DELETE_UNDO_WINDOW_MS = 7000

interface PendingDelete {
  id: string
  trade: Trade
  timeoutId: number
}

export interface TradeFilter {
  type: 'symbol' | 'setup'
  value: string
}

function App() {
  const { t, language } = useLanguage()
  const [accountId, setAccountId] = useState<string | null>(null)
  const [tier, setTier] = useState<AccountTier>('demo')
  const [demoTradesCreated, setDemoTradesCreated] = useState(0)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  // היסטוריית שינויי SL/TP של ה-workspace הפעיל (ראה slTpHistoryApi.ts) - נטענת יחד עם
  // הטריידים עצמם (loadAccount/switchWorkspace) ומתרעננת אחרי כל עריכה (handleSave),
  // כדי ש-Dashboard (slTpAdjustmentStats) תמיד יראה גם רשומות היסטוריה שנוספו זה עתה.
  const [slTpHistory, setSlTpHistory] = useState<SlTpHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tradesLoading, setTradesLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  // ברמת App כדי לשרוד מעברי טאב (Home נכנס/יוצא מה-DOM) - ראה תיעוד ב-useMarketData.ts.
  // ready=Boolean(accountId): לא מתחיל לשלוף עד ש-ensureSession()/loadAccount() הצליחו -
  // אחרת ה-effect כאן והרצה המקבילה של ensureSession() ב-init() למטה מתחרים על מי יוצר
  // ראשון את ה-Supabase client (anon vs. עם token), מה שגורם ל"Multiple GoTrueClient
  // instances" ועלול לגרום ל-market-indices (Edge Function עם verify_jwt) להישלח עם
  // הטוקן הלא-נכון בטעינה הראשונה.
  const marketData = useMarketData(Boolean(accountId))

  const [tab, setTab] = useState<Tab>('home')
  const [journalSubTab, setJournalSubTab] = useState<JournalSubTab>('trades')
  // נקרא בכל לחיצה על התראה בפעמון (ראה NotificationBell) כדי לגרום ל-Tools לעבור
  // לתת-הטאב Watchlist - counter (לא boolean) כדי שלחיצה חוזרת על אותה התראה תמיד
  // תפעיל את ה-effect מחדש גם אם כבר נמצאים ב-Watchlist.
  const [focusWatchlistSignal, setFocusWatchlistSignal] = useState(0)
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<TradeFilter | null>(null)
  // מחיקות "ממתינות": הטרייד כבר הוסר אופטימית מ-`trades` (למטה), אבל ה-delete בפועל
  // (Supabase + ניקוי תמונה) נדחה עד שחלון ה-Undo פג - ראה `handleDelete`/`handleUndoDelete`.
  // כל מחיקה עצמאית (מערך, לא ערך יחיד) כדי שכמה מחיקות ברצף לא ידרסו זו את זו.
  const [pendingDeletes, setPendingDeletes] = useState<PendingDelete[]>([])
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [accessModalHint, setAccessModalHint] = useState<string | null>(null)
  const [codeVerified, setCodeVerified] = useState(() => isCodeVerified())
  // מוצג בתחילת כל טעינה (state תמיד מתחיל `true`, גם למי שכבר יש session שמור) -
  // בניגוד ל-gate שמאחוריו, זה לא persist-י בכוונה. ראה `SHOW_INTRO_SPLASH`.
  const [showLaunch, setShowLaunch] = useState(SHOW_INTRO_SPLASH)

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null
  const isDemoLimitReached = tier === 'demo' && !canCreateTrade(tier, demoTradesCreated)
  const chartImageCount = trades.filter((t) => Boolean(t.chartImageUrl)).length

  const openAccessModal = (hint?: string) => {
    setAccessModalHint(hint ?? null)
    setShowAccessModal(true)
  }

  /** טוען חשבון+workspaces+טריידים עבור session נתון. משמש גם באתחול הראשוני וגם אחרי redeemCode. */
  async function loadAccount(session: Session) {
    const account = await getAccount(session.accountId)
    let ws = await listWorkspaces(session.accountId)
    if (ws.length === 0) {
      ws = [await ensureWorkspace(session.accountId)]
    }
    const storedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
    const initialWorkspace = ws.find((w) => w.id === storedId) ?? ws[0]
    const loadedTrades = await listTrades(initialWorkspace.id)
    const loadedSlTpHistory = await listSlTpHistoryForTrades(loadedTrades.map((t) => t.id))
    setAccountId(session.accountId)
    setTier(account.tier)
    setDemoTradesCreated(account.demoTradesCreated)
    setWorkspaces(ws)
    setActiveWorkspaceId(initialWorkspace.id)
    setTrades(loadedTrades)
    setSlTpHistory(loadedSlTpHistory)
  }

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const session = await ensureSession()
        if (cancelled) return
        await loadAccount(session)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : t('app.loadFailedGeneric'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  // מסנכרן את השפה הנוכחית (localStorage, ראה LanguageContext.tsx) לעמודת
  // accounts.language בכל טעינה ובכל שינוי שפה - כדי ש-Edge Functions בצד שרת
  // (check-price-alerts) ידעו לבנות טקסט התראות בשפה הנכונה. כיוון-כתיבה אחד בלבד
  // (local → DB), בכוונה: לא קוראים מה-DB חזרה ל-state המקומי, כדי לא לסתור את ההחלטה
  // המתועדת ב-LanguageContext.tsx שלא "מפתיעים" משתמש עם שפה שלא בחר בעצמו במפורש
  // במכשיר הזה. ריצה ראשונה (ברגע ש-accountId נטען) גם ממלאת בדיעבד את העמודה עבור
  // חשבונות קיימים שכבר בחרו שפה לפני ה-migration הזה - best-effort, לא חוסם UI.
  useEffect(() => {
    if (!accountId) return
    updateAccountLanguage(accountId, language).catch((err) => {
      console.error('[App] failed to persist language preference to account:', err)
    })
  }, [accountId, language])

  const openAddForm = () => {
    setEditingTrade(undefined)
    setShowForm(true)
  }

  const openEditForm = (trade: Trade) => {
    setEditingTrade(trade)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingTrade(undefined)
  }

  const handleSave = async (trade: Trade) => {
    if (!workspace || !accountId) return
    const exists = trades.some((t) => t.id === trade.id)
    const saved = exists ? await updateTrade(trade.id, trade) : await createTrade(workspace.id, accountId, trade)
    setTrades((prev) => (exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev]))
    // מונה טריידי-הדמו מתעדכן בשרת ע"י טריגר DB בכל insert (008_demo_trades_created.sql) -
    // מעדכנים גם מקומית כדי שהמגבלה תשתקף מיד, בלי fetch נוסף לחשבון.
    if (!exists) setDemoTradesCreated((prev) => prev + 1)
    // עריכת טרייד קיים עשויה הייתה ליצור רשומת היסטוריית SL/TP (updateTrade, best-effort) -
    // מרעננים מהשרת במקום לנחש בצד קליינט אם/מה נוצר.
    if (exists) {
      setSlTpHistory(await listSlTpHistoryForTrades(trades.map((t) => t.id)))
    }
    closeForm()
  }

  /** מבצע את המחיקה האמיתית אחרי שחלון ה-Undo פג - זהה למה שהיה קורה מיד לפני הוספת Undo. */
  const finalizeDelete = async (id: string, trade: Trade) => {
    try {
      await deleteTrade(id)
      if (trade.chartImageUrl) {
        // מוחק גם את קובץ התמונה מה-Storage כדי לא להשאיר קבצים יתומים ולא "לתפוס" מקום ממגבלת ה-50.
        await deleteChartImage(trade.chartImageUrl).catch(() => {})
      }
    } finally {
      setPendingDeletes((prev) => prev.filter((p) => p.id !== id))
    }
  }

  /**
   * מבצע מיד את כל המחיקות הממתינות (Undo עדיין לא פג) - נקרא לפני מעבר workspace, כדי
   * שטרייד שנמחק ב-workspace אחד לעולם לא "יחזור" בטעות ל-workspace אחר דרך handleUndoDelete
   * (ש-restore-ת תמיד לתוך ה-trades הנוכחי, בלי לדעת מאיזה workspace הטרייד המקורי הגיע).
   */
  const finalizeAllPendingDeletes = () => {
    setPendingDeletes((prev) => {
      for (const p of prev) {
        window.clearTimeout(p.timeoutId)
        void finalizeDelete(p.id, p.trade)
      }
      return prev
    })
  }

  /** הסרה אופטימית מיידית מהרשימה + טיימר שמריץ את המחיקה האמיתית בשרת רק אם לא בוטל. */
  const handleDelete = (id: string) => {
    const trade = trades.find((t) => t.id === id)
    if (!trade) return
    setTrades((prev) => prev.filter((t) => t.id !== id))
    const timeoutId = window.setTimeout(() => {
      void finalizeDelete(id, trade)
    }, DELETE_UNDO_WINDOW_MS)
    setPendingDeletes((prev) => [...prev, { id, trade, timeoutId }])
  }

  /** מבטל מחיקה ממתינה - מחזיר את הטרייד לרשימה בלי שום קריאת API, כי המחיקה בפועל טרם קרתה. */
  const handleUndoDelete = (id: string) => {
    setPendingDeletes((prev) => {
      const pending = prev.find((p) => p.id === id)
      if (pending) {
        window.clearTimeout(pending.timeoutId)
        setTrades((current) => [pending.trade, ...current])
      }
      return prev.filter((p) => p.id !== id)
    })
  }

  const handleFieldSettingsChange = (fieldSettings: FieldSettings) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? { ...w, fieldSettings } : w)))
  }

  const handleWorkspaceUpdated = (patch: Partial<Workspace>) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? { ...w, ...patch } : w)))
  }

  /** נקרא אחרי ש-TemplatePicker כבר שמר את התבנית+fieldSettings ב-DB (ראה setWorkspaceTemplate) -
   * מעדכן את שני השדות יחד ב-state המקומי, כמו handleFieldSettingsChange. */
  const handleTemplateSelected = (template: WorkspaceTemplate) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? { ...w, template, fieldSettings: TEMPLATE_FIELD_DEFAULTS[template] } : w)),
    )
  }

  const switchWorkspace = async (id: string) => {
    if (id === activeWorkspaceId) return
    closeForm()
    finalizeAllPendingDeletes()
    setTradesLoading(true)
    setLoadError(null)
    try {
      const loadedTrades = await listTrades(id)
      const loadedSlTpHistory = await listSlTpHistoryForTrades(loadedTrades.map((t) => t.id))
      setActiveWorkspaceId(id)
      setTrades(loadedTrades)
      setSlTpHistory(loadedSlTpHistory)
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, id)
      setFilter(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('app.switchWorkspaceFailed'))
    } finally {
      setTradesLoading(false)
    }
  }

  const handleCreateWorkspace = async (name: string, template?: WorkspaceTemplate) => {
    if (!accountId) return
    const created = await createWorkspace(accountId, tier, name, template)
    setWorkspaces((prev) => [...prev, created])
    await switchWorkspace(created.id)
  }

  /** נקרא אחרי "Clear Trading Data" מוצלח (`WorkspaceSettings`) - החשבון/דרגה/קוד/session
   * נשארים כמו שהם, רק הטריידים/watchlist נמחקו בשרת; טוענים מחדש workspaces+trades
   * באותה צורה כמו אחרי redeem (`loadAccount`), בלי לעבור מסך "account deleted". */
  const handleTradingDataCleared = async () => {
    const session = getStoredSession()
    if (!session) return
    await loadAccount(session)
  }

  /**
   * אחרי מימוש קוד גישה מוצלח: ה-session שהתקבל עשוי להצביע על חשבון קבוע אחר
   * (זה שאליו הקוד היה משויך), לכן טוענים מחדש את כל המצב במקום רק לעדכן tier.
   * משמש הן ממודל השדרוג (`AccessCodeModal`) והן משער הכניסה (`AccessCodeGate`).
   */
  const handleRedeemed = async ({ session, switchedAccount }: RedeemResult) => {
    setLoadError(null)
    try {
      await loadAccount(session)
      // switchedAccount=true means this code was already tied to a *different* account -
      // the user is now looking at that account's data, not whatever they had a moment ago.
      // This must never happen silently (see session.ts/useRedeemCode.ts) - a native blocking
      // alert is deliberate here: it cannot be missed or lost behind other UI, unlike a banner.
      if (switchedAccount) {
        window.alert(t('accessCode.switchedAccountAlert'))
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('app.reloadAccountFailed'))
    } finally {
      setShowAccessModal(false)
      closeForm()
    }
  }

  /** נקרא אחרי אימות מוצלח בשער הכניסה (`AccessCodeGate` כבר שמר את דגל ה-localStorage). */
  const handleGateVerified = async (result: RedeemResult) => {
    setCodeVerified(true)
    await handleRedeemed(result)
  }

  const goToFilteredTrades = (next: TradeFilter) => {
    closeForm()
    setFilter(next)
    setTab('journal')
    setJournalSubTab('trades')
  }

  /** מחליף טאב דרך `PillNav` - סוגר טופס טרייד פתוח קודם (כמו לחיצה על Cancel), אחרת ה-ternary
   * שמציג את התוכן הראשי ממשיך להראות את הטופס גם אחרי שה-tab כבר התחלף. */
  const handleChangeTab = (newTab: Tab) => {
    if (showForm) closeForm()
    setTab(newTab)
  }

  /** נקרא אחרי ייבוא מוצלח מ-`WorkspaceSettings` - מוסיף את הטריידים שנוצרו בפועל ל-state בלי query נוסף. */
  const handleTradesImported = (imported: Trade[]) => {
    setTrades((prev) => [...imported, ...prev])
    setDemoTradesCreated((prev) => prev + imported.length)
  }

  /** נקרא אחרי מיזוג/השלמת שדות מ-ייבוא Excel (`importOrUpdateTrades`) - מחליף את הטריידים
   * שעודכנו ב-state הקיים לפי id (בלי query נוסף), בלי לגעת בשאר הטריידים. */
  const handleTradesUpdated = (updated: Trade[]) => {
    if (updated.length === 0) return
    const byId = new Map(updated.map((t) => [t.id, t]))
    setTrades((prev) => prev.map((t) => byId.get(t.id) ?? t))
  }

  if (showLaunch) {
    // מסך פתיחה חובה בכל טעינה, לפני כל בדיקה אחרת (גם לפני ה-gate) - ראה `LaunchScreen`.
    return (
      <div className="app">
        <LaunchScreen onDismiss={() => setShowLaunch(false)} />
      </div>
    )
  }

  if (REQUIRE_ACCESS_CODE_GATE && !codeVerified) {
    // שער חובה לפני האפליקציה - ראה `src/config/locks.ts`. מוצג גם בזמן שה-session/
    // account/workspaces נטענים ברקע (init() למעלה) - הם לא נחוצים לשער עצמו.
    return (
      <div className="app">
        <AccessCodeGate onVerified={handleGateVerified} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app">
        <main className="appMain">
          <p className="loadingState">{t('app.loading')}</p>
        </main>
      </div>
    )
  }

  if (loadError || !workspace || !accountId) {
    return (
      <div className="app">
        <main className="appMain">
          <p className="loadingState">
            {t('app.loadErrorPrefix')} {loadError ?? t('app.noWorkspace')}
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <InstallBanner />
      {tier === 'demo' && <DemoBanner tradeCount={trades.length} onOpenAccessCode={() => openAccessModal()} />}
      <div className="stickyHeader">
        <PillNav
          tab={tab}
          onChangeTab={handleChangeTab}
          actions={
            <>
              <WorkspaceSwitcher
                accountId={accountId}
                workspaces={workspaces}
                activeWorkspaceId={workspace.id}
                tier={tier}
                onSwitch={switchWorkspace}
                onCreate={handleCreateWorkspace}
                onOpenAccessCode={() => openAccessModal(t('workspaceSwitcher.modalHint'))}
              />
              <ThemeSwitcher />
              <NotificationBell
                accountId={accountId}
                onOpenWatchlist={() => {
                  handleChangeTab('tools')
                  setFocusWatchlistSignal((s) => s + 1)
                }}
              />
              <HeaderClock />
            </>
          }
        />
      </div>
      <DesktopStatBar trades={trades} baseCurrency={workspace.baseCurrency} />

      <div className="appBody">
        <main className="appMain">
          {/* MarketRail (desktop side rail) removed for now per user feedback - was
              confusing/duplicative next to Home. Revisit desktop layout separately. */}
          {tradesLoading ? (
            <p className="loadingState">{t('app.loadingTrades')}</p>
          ) : showForm && !editingTrade && isDemoLimitReached ? (
            <DemoLimitBlock onOpenAccessCode={() => openAccessModal()} onCancel={closeForm} />
          ) : showForm ? (
            <TradeForm
              initialTrade={editingTrade}
              fieldSettings={workspace.fieldSettings}
              accountId={accountId}
              tier={tier}
              chartImageCount={chartImageCount}
              onOpenAccessCode={() => openAccessModal(t('tradeForm.modalHint'))}
              onSave={handleSave}
              onCancel={closeForm}
            />
          ) : tab === 'home' ? (
            <Home
              indices={marketData.indices}
              indicesLoading={marketData.indicesLoading}
              indicesFailed={marketData.indicesFailed}
              crypto={marketData.crypto}
              cryptoLoading={marketData.cryptoLoading}
              cryptoFailed={marketData.cryptoFailed}
              fearGreed={marketData.fearGreed}
            />
          ) : tab === 'positions' ? (
            <OpenPositions trades={trades} baseCurrency={workspace.baseCurrency} />
          ) : tab === 'journal' ? (
            <Journal
              trades={trades}
              slTpHistory={slTpHistory}
              baseCurrency={workspace.baseCurrency}
              tier={tier}
              template={workspace.template}
              dailyRiskBudget={workspace.dailyRiskBudget}
              onOpenAccessCode={() => openAccessModal(t('dashboard.weeklyRecapModalHint'))}
              subTab={journalSubTab}
              onSubTabChange={setJournalSubTab}
              filter={filter}
              onClearFilter={() => setFilter(null)}
              onAdd={openAddForm}
              onEdit={openEditForm}
              onDelete={handleDelete}
              onSelectSymbol={(symbol) => goToFilteredTrades({ type: 'symbol', value: symbol })}
              onSelectSetup={(setup) => goToFilteredTrades({ type: 'setup', value: setup })}
            />
          ) : tab === 'tools' ? (
            <Tools
              accountId={accountId}
              workspaceId={workspace.id}
              tier={tier}
              template={workspace.template}
              focusWatchlistSignal={focusWatchlistSignal}
              onOpenAccessCode={() => openAccessModal(t('tools.watchlist.modalHint'))}
              onTemplateSelected={handleTemplateSelected}
            />
          ) : tab === 'calendar' ? (
            <MonthlyCalendar trades={trades} baseCurrency={workspace.baseCurrency} onEditTrade={openEditForm} />
          ) : (
            <WorkspaceSettings
              workspace={workspace}
              accountId={accountId}
              workspaceIds={workspaces.map((w) => w.id)}
              tier={tier}
              trades={trades}
              onFieldSettingsChange={handleFieldSettingsChange}
              onWorkspaceUpdated={handleWorkspaceUpdated}
              onTradingDataCleared={handleTradingDataCleared}
              onTradesImported={handleTradesImported}
              onTradesUpdated={handleTradesUpdated}
              onOpenAccessCode={() => openAccessModal(t('workspaceSettings.modalHint'))}
              onTemplateSelected={handleTemplateSelected}
            />
          )}
        </main>
      </div>
      {tab !== 'calendar' && <Footer />}
      <UndoToast
        items={pendingDeletes.map((p) => ({ id: p.id, symbol: p.trade.symbol }))}
        onUndo={handleUndoDelete}
      />
      {showAccessModal && (
        <AccessCodeModal
          contextHint={accessModalHint}
          onRedeemed={handleRedeemed}
          onClose={() => setShowAccessModal(false)}
        />
      )}
    </div>
  )
}

export default App
