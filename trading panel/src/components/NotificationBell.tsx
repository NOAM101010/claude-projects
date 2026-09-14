import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { formatDateTime } from '../lib/format'
import {
  countUnread,
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
export function NotificationBell({ accountId, onOpenWatchlist }: { accountId: string; onOpenWatchlist?: () => void }) {
  const { t, locale } = useLanguage()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const [justArrived, setJustArrived] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const firstLoadRef = useRef(true)

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

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.button} btn-metal ${justArrived ? styles.pulse : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notifications.bellLabel')}
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
        <div className={`${styles.dropdown} metal-panel holo-edge count-in`}>
          <div className={styles.header}>
            <span className={styles.title}>{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button type="button" className={styles.markAllButton} onClick={handleMarkAllRead}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className={styles.empty}>{t('notifications.empty')}</p>
          ) : (
            <ul className={styles.list}>
              {notifications.map((notification) => (
                <li key={notification.id}>
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
