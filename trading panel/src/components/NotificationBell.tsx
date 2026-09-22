import { Bell, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useModalEscape } from '../hooks/useModalEscape'
import { formatDateTime } from '../lib/format'
import {
  clearAllNotifications,
  countUnread,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../lib/notificationsApi'
import { LIVE_PRICE_REFRESH_MS } from '../lib/marketData'
import styles from './NotificationBell.module.css'

/**
 * פעמון התראות בהדר - in-app בלבד, נפרד לגמרי מ-push (device-level, ראה _shared/push.ts).
 * נשלף מזדמן: אותה תדירות בדיוק כמו רענון המחירים החי הקיים (LIVE_PRICE_REFRESH_MS,
 * ~2 דקות) + רענון מיידי על focus/mount - בלי לולאת polling עצמאית ותכופה יותר, לפי
 * הנחיית הביצועים המפורשת בספק.
 */
/** זמן שבו כפתור "Clear all" נשאר במצב "לאשר?" - אותו אישור-קליק-שני-קל כמו
 * Clear History ב-Tools.tsx (CLEAR_HISTORY_CONFIRM_TIMEOUT_MS), לא אישור כבד. */
const CLEAR_ALL_CONFIRM_TIMEOUT_MS = 4000

export function NotificationBell({ accountId, onOpenWatchlist }: { accountId: string; onOpenWatchlist?: () => void }) {
  const { t, locale } = useLanguage()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const [justArrived, setJustArrived] = useState(false)
  const [confirmingClearAll, setConfirmingClearAll] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const firstLoadRef = useRef(true)
  const clearAllTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const refresh = () => {
      listNotifications(accountId)
        .then((rows) => {
          if (cancelled) return
          const isFirstLoad = firstLoadRef.current
          firstLoadRef.current = false
          const hasNewArrival = !isFirstLoad && rows.some((n) => !knownIdsRef.current.has(n.id))
          knownIdsRef.current = new Set(rows.map((n) => n.id))
          setNotifications(rows)
          if (hasNewArrival) {
            setJustArrived(true)
            window.setTimeout(() => setJustArrived(false), 1600)
          }
        })
        .catch(() => {
          // best-effort - הפעמון פשוט לא יתעדכן הפעם, אין צורך במסך שגיאה על זה.
        })
    }

    refresh()
    const interval = window.setInterval(refresh, LIVE_PRICE_REFRESH_MS)
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [accountId])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const closeDropdown = () => setOpen(false)
  const dropdownRef = useModalEscape<HTMLDivElement>(open, closeDropdown)

  const unreadCount = countUnread(notifications)

  async function handleItemClick(notification: AppNotification) {
    if (notification.readAt === null) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)))
      try {
        await markNotificationRead(notification.id)
      } catch {
        // best-effort - לכל היותר יראה שוב כלא-נקרא ברענון הבא.
      }
    }
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.readAt === null ? { ...n, readAt: now } : n)))
    try {
      await markAllNotificationsRead(accountId)
    } catch {
      // best-effort - ראה הערה למעלה.
    }
  }

  /** מחיקת התראה בודדת - עדכון אופטימי, משחזר את הרשימה אם השרת נכשל. */
  async function handleDelete(id: string) {
    const previous = notifications
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      await deleteNotification(id)
    } catch {
      setNotifications(previous)
    }
  }

  /** "Clear all" - אישור-קליק-שני-קל (לא מודאל), אותו דפוס כמו Clear History ב-Tools.tsx. */
  function requestClearAll() {
    if (confirmingClearAll) {
      if (clearAllTimerRef.current) window.clearTimeout(clearAllTimerRef.current)
      setConfirmingClearAll(false)
      const previous = notifications
      setNotifications([])
      clearAllNotifications(accountId).catch(() => setNotifications(previous))
      return
    }
    setConfirmingClearAll(true)
    clearAllTimerRef.current = window.setTimeout(() => setConfirmingClearAll(false), CLEAR_ALL_CONFIRM_TIMEOUT_MS)
  }

  useEffect(() => {
    return () => {
      if (clearAllTimerRef.current) window.clearTimeout(clearAllTimerRef.current)
    }
  }, [])

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.button} btn-metal ${justArrived ? styles.pulse : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notifications.bellLabel')}
        aria-expanded={open}
        title={t('notifications.bellLabel')}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span key={unreadCount} className={`${styles.badge} value-pop`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div ref={dropdownRef} className={`${styles.dropdown} metal-panel holo-edge count-in`}>
          <div className={styles.header}>
            <span className={styles.title}>{t('notifications.title')}</span>
            <div className={styles.headerActions}>
              {unreadCount > 0 && (
                <button type="button" className={styles.markAllButton} onClick={handleMarkAllRead}>
                  {t('notifications.markAllRead')}
                </button>
              )}
              {notifications.length > 0 && (
                <button type="button" className={styles.clearAllButton} onClick={requestClearAll}>
                  {confirmingClearAll ? t('notifications.clearAllConfirm') : t('notifications.clearAll')}
                </button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t('notifications.empty')}</p>
              <p className={styles.emptyHint}>{t('notifications.emptyHint')}</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {notifications.map((notification) => (
                <li key={notification.id} className={styles.itemRow}>
                  <button
                    type="button"
                    className={`${styles.item} ${notification.readAt === null ? styles.itemUnread : ''}`}
                    onClick={() => {
                      handleItemClick(notification)
                      if (onOpenWatchlist) {
                        onOpenWatchlist()
                        setOpen(false)
                      }
                    }}
                  >
                    {notification.readAt === null && <span className={styles.dot} aria-hidden="true" />}
                    <div className={styles.itemBody}>
                      <span className={styles.itemSymbol}>{notification.symbol}</span>
                      <span className={styles.itemMessage}>{notification.message}</span>
                      <span className={styles.itemTime}>{formatDateTime(notification.createdAt, locale)}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => handleDelete(notification.id)}
                    aria-label={t('notifications.deleteOne')}
                    title={t('notifications.deleteOne')}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
