# 🚀 Swing Trader - Progress Tracker

## Session 2026-08-18

### ✅ **Completed This Session**

#### Scanner Fixes
- [x] Fixed broken `yf.historical()` → switched to `yf.chart()`
- [x] Fresh breakout detection (last 3 days only, not 11% above ATH)
- [x] Gap Entry rewrite (all-history search, price interaction check)
- [x] Cup & Handle validation (handle 5-12% below lip, not broken out)
- [x] 271 results from 500+ stock universe
- [x] Proper unfilled gap verification

#### Position Calculator
- [x] Dual-tab design (Position Sizing + P&L Calculator)
- [x] Account size separate from position size
- [x] Currency toggle ($ ↔ ₪) with live rate
- [x] Fixed calculation bug ($1800 → $1500 correct)

#### Live Data
- [x] SPY, QQQ, VIX, BTC, ETH (10s refresh)
- [x] Sector heatmap 11 ETFs (15s refresh)
- [x] USD/ILS exchange rate live

#### Developer Experience
- [x] Windows auto-start on boot
- [x] Desktop shortcut "Swing Trader"
- [x] One-click start + auto-open browser
- [x] Dev server hot-reload working

#### Memory & Documentation
- [x] PROJECT_BRAIN.md in TRAIDING folder
- [x] Session summary memory
- [x] All changes documented

---

## 📋 **Next Session Tasks**

### 🥇 Priority 1: Vercel Deployment
- [ ] Deploy to Vercel (free tier)
- [ ] Set CRON_SECRET env var
- [ ] Test morning cron runs at 13:00 IL
- [ ] Setup Discord webhook notifications
- [ ] Setup push notifications opt-in
- [ ] Mobile access test

### 🥈 Priority 2: Trade Journal
- [ ] Create trades table in Prisma
- [ ] Trade entry form (entry/exit/profit/loss)
- [ ] Monthly stats page
- [ ] Success rate by setup type
- [ ] Win/loss ratio tracking

### 🥉 Priority 3 (If User Asks)
- [ ] Discord webhook step-by-step guide (Hebrew)
- [ ] Weekly high/low breakouts detection
- [ ] Better volume spike filtering
- [ ] TradingView watchlist export

---

## 🐛 **Known Issues (All Fixed)**

| Issue | Status | Fix |
|-------|--------|-----|
| Scanner returned 0 results | ✅ FIXED | yf.chart() instead of yf.historical() |
| PSX flagged 11% above ATH | ✅ FIXED | Fresh breakout check (last 3 days) |
| Position calc wrong value | ✅ FIXED | Formula: shares × entry price |
| Gap Entry false positives | ✅ FIXED | Verify unfilled gap + price interaction |
| Cup & Handle showing completed | ✅ FIXED | Constrain handle below lip |
| Prisma lock errors | ✅ FIXED | Kill node processes + regenerate |

---

## 💾 **Key Files Modified**

```
src/lib/scanner.ts              — Complete rewrite
src/lib/scanner-config.ts       — 500+ universe, tuned params
src/app/calculator/page.tsx     — Dual-tab design
src/components/market-indices   — Added BTC/ETH, 10s refresh
src/components/sector-heatmap   — 15s refresh
src/app/api/quotes/usdils       — NEW: Exchange rate
src/app/api/scanner/results     — NEW: Latest scan output
src/app/settings/page.tsx       — Removed paid features
start-swing-trader.bat          — Windows automation
```

---

## 🎯 **Current State**

- ✅ **Scanner**: Working, accurate patterns detected
- ✅ **Calculator**: Dual-function, currency support
- ✅ **Live Data**: Real-time updates
- ✅ **Dev Setup**: One-click start
- ⏳ **Production**: Not deployed yet (Vercel next)
- ⏳ **Trading Journal**: Not built yet

---

**Last Updated**: 2026-08-18 after scanner fixes + auto-start setup
**User Model**: claude-opus-4-7 (when fixes needed), claude-haiku-4-5 (for efficiency)

---

## 🧠 שלב 2 — מנוע ניקוד אחד מוגדר-משתמש (2026-09-07)

**ארכיטקטורה חדשה:** `src/lib/scoring.ts` הוא **מקור האמת היחיד** לניקוד.
לא לכתוב לוגיקת ניקוד/grade בשום מקום אחר.

- `ScoringWeights` — משקל לכל אות (6 אותות ניתוח + 8 אותות setup של הסורק). משקל 0 = האות לא נספר ולא מוצג.
- `scoreSignals(metrics, weights, mode)` → `{ score 0-100, grade A-F, signals[], verdict, summary }`.
  מתחיל ב-`BASE_SCORE = 50`; כל אות תורם `Math.round(weight × factor)`.
- **שני מצבי כיול** (`ScoreMode`):
  - `"analysis"` (ברירת מחדל, דף הניתוח) — clamp ל-0-100, grade 78/64/50/36.
  - `"scanner"` (הסורק) — הציון הגולמי **לא** נחסם ב-100 (סקאלה פתוחה ~0-190, כדי לא להידבק לתקרה),
    ה-grade נקבע ב-`scannerScoreToGrade` על ספי `SCANNER_GRADE_CUTOFFS = {A:106, B:95, C:70, D:40}`,
    והציון המוצג מנורמל ב-`normalizeScannerScore` ל-0-100 piecewise-linear כך שהספים נופלים בדיוק על 78/64/50/36.
    מכויל על סריקה אמיתית (123 תוצאות): A 7% / B 15% / C 27% / D 27% / F 24%.
- `DEFAULT_WEIGHTS` = המשקלים ההיסטוריים של דף הניתוח → התנהגות /api/analyze לא השתנתה.
- `stock-analyzer.ts` מחשב metrics בלבד וקורא ל-scoreSignals. `scanner.ts` מזהה setups (matchedSetups)
  ואז מנקד באותו מנוע — הניקוד הגס הישן (65/45/40...) והדירוג 110/80/55/30 הוסרו.

**פרופילים:** `ScannerProfile.config` = JSON של `{ filters: ScannerConfig, weights: ScoringWeights }`.
`normalizeProfileConfig()` (ב-scanner-config.ts) תומך לאחור בפורמט השטוח הישן. לכל פרופיל מובנה יש סט משקלים משלו.

**UI:** עורך פרופילים מלא בהגדרות (`scanner-profiles-editor.tsx`), מתג פרופיל בדף הסורק,
verdict + פאנל אותות נפתח לכל שורה (`signal-breakdown.tsx` — משותף עם דף הניתוח).

**DB:** `ScannerResult.signals` (JSON) + `ScannerResult.verdict`. הוחל עם `prisma db push`
(migration היסטורית כבר בדריפט בגלל טבלת Trade — אין להריץ `migrate reset`, זה ימחק את היומן).
