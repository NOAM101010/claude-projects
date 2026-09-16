import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LanguageProvider } from './i18n/LanguageContext'
import { ThemeProvider } from './theme/ThemeContext'
import { initPwa } from './pwa'

initPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)
