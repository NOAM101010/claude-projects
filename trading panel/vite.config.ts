import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "autoUpdate": a new build now activates and reloads automatically, no
      // user action needed. Was "prompt" (a native confirm() dialog asking to
      // refresh), but a non-technical user has no way to know that dialog is
      // actionable or to recover if they dismiss it - they'd get stuck on an
      // old cached build indefinitely with no way out except manually
      // unregistering the service worker in devtools, which is not something
      // to expect a customer to do. The trade-off: a real deploy could in
      // theory auto-reload while someone has an unsaved trade form open -
      // rare (deploys aren't frequent once shipped) but worth reconsidering
      // (e.g. warn-before-reload only while TradeForm is open) before this
      // goes out to paying customers, not just during active development.
      registerType: 'autoUpdate',
      injectRegister: null,
      // injectManifest (not generateSW): a custom src/sw.ts is required for push
      // notification event handlers (see "Push Notifications" in trading-journal-plan.md).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      // No devOptions here on purpose: with strategies:'injectManifest', the
      // plugin's dev-mode SW emulation is unreliable (fails silently) - test
      // push notifications against a production build (`npm run build &&
      // npm run preview`) instead, which has a real, working service worker
      // and is what actually runs once deployed anyway.
      // manifest: false — a static public/manifest.webmanifest is used instead (below),
      // so the same file is served identically in dev and prod without relying on the
      // plugin's dev-only virtual-manifest middleware (which doesn't kick in without
      // devOptions.enabled). index.html links to it directly.
      manifest: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'manifest.webmanifest', 'icons/*.png'],
    }),
  ],
  server: {
    port: 5200,
    strictPort: true,
  },
})
