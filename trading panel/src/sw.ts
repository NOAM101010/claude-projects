/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// App-shell precaching (basic offline support) - injected at build time by vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST)

// Any navigation (page reload/deep link) falls back to the cached shell when offline -
// simple SPA app-shell strategy, not a sophisticated per-route caching scheme.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// registerType='prompt': the new SW waits until the client explicitly asks it to
// activate (see src/pwa.ts -> updateSW(true)), instead of taking over mid-session.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

interface PushPayload {
  title: string
  body: string
  url?: string
}

const DEFAULT_PUSH_PAYLOAD: PushPayload = { title: 'TradePanel', body: 'התראה חדשה' }

/**
 * Push notifications - תשתית בסיסית בלבד (subscribe + שליחת התראת בדיקה ידנית,
 * ראה supabase/functions/send-test-push). אין כאן תזכורות אוטומטיות/מתוזמנות -
 * זה feature לעתיד לפי trading-journal-plan.md סעיף 6.
 */
self.addEventListener('push', (event) => {
  let payload = DEFAULT_PUSH_PAYLOAD
  if (event.data) {
    try {
      payload = { ...DEFAULT_PUSH_PAYLOAD, ...event.data.json() }
    } catch {
      payload = { ...DEFAULT_PUSH_PAYLOAD, body: event.data.text() }
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
