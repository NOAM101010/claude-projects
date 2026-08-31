# 🧠 Swing Trader - PROJECT BRAIN

## 📊 **Current Status: Session 2026-08-18**

### ✅ **What's Working**

#### **Scanner** 🎯 (FIXED PROPERLY THIS SESSION)
- ✅ Uses `yf.chart()` (not broken `yf.historical()`)
- ✅ **Fresh breakout detection** — only patterns that broke out in **last 3 days**
- ✅ Scans 500+ stocks (S&P 500 + NASDAQ $5B+)

**Detection Algorithms (all fixed):**
- **ATH Breakout**: Requires cross above previous ATH in last 3 bars + price within 2% of new ATH (was flagging PSX 11% above ATH before fix)
- **52W Breakout**: Same fresh-cross logic
- **Cup & Handle**: Handle 5-12% below lip, cup 18-38% deep, NOT yet broken out
- **Gap Entry**: All-history search, price entering (1-1.5% away) or inside unfilled gap
- **Gap Up (today)**: Real gap check — today's OPEN vs yesterday's CLOSE (not just intraday %)

#### **Position Calculator** 💰
- **Tab 1**: Account size → Position size → Entry/Stop → Results
- **Tab 2 (P&L)**: Entry + shares → Target/% gain → USD/ILS profit
- Currency toggle: $ ↔ ₪ with live rate

#### **Live Data** 📈
- SPY, QQQ, VIX, BTC, ETH: **10-second refresh**
- Sector heatmap (11 ETFs): **15-second refresh**
- USD/ILS: Live

### 🖥️ **Local Setup — Auto-start Windows**

Created this session:
- ✅ `C:\CLAUDE AI\TRAIDING\start-swing-trader.bat` — starts server + opens browser after 8s
- ✅ Windows Startup shortcut — auto-launches on boot
- ✅ Desktop shortcut "Swing Trader" — double-click to start everything

### 🔧 **Technical Stack**

| Component | Tech |
|-----------|------|
| Framework | Next.js 16.3.1 + Turbopack + TypeScript |
| Styling | Tailwind CSS v4 + RTL Hebrew |
| Database | Prisma 6 + SQLite (local file) |
| Market Data | yahoo-finance2 v4 (singleton: `src/lib/yf.ts`) |
| Cron | Vercel Cron — daily 13:00 IL (10:00 UTC) — **NOT running locally** |

### 📁 **Key Files**

```
src/lib/
  ├── scanner.ts          (fresh breakout logic, all 3 detections fixed)
  ├── scanner-config.ts   (500+ universe, gapUpMin=2, minRsi=50)
  └── yf.ts               (yahoo-finance singleton)

src/app/
  ├── calculator/page.tsx (dual-tab: Position + P&L)
  ├── scanner/page.tsx    (3 categories, run button)
  ├── settings/page.tsx   (Discord webhook, push notifs, NO API keys)
  └── api/
      ├── quotes/ticker     (5 symbols live)
      ├── quotes/usdils     (exchange rate)
      ├── sectors           (11 ETF heatmap)
      ├── scanner/cron      (daily scan → push + Discord)
      └── scanner/results   (latest scan output)

src/components/
  ├── market-indices.tsx  (5 live cards)
  └── sector-heatmap.tsx  (11-grid)
```

### 🎯 **Scanner Scoring**

```
breakout_ath       +65   (FRESH: last 3 days, ≤2% from ATH)
breakout_52w       +45   (FRESH: last 3 days, ≤2% from 52W high)
cup_and_handle     +40   (handle formation, not broken out)
gap_entry          +35   (entering or inside unfilled gap)
near_ath           +25   (0.5-5% below ATH)
gap_up (today)     +20   (real OPEN vs prev CLOSE gap ≥2%)
high_volume        +20   (volume ratio ≥1.5x)
near_52w           +18   (within 5% of 52W high)
RSI 50-80          +10
Volume ratio       +up to 25
Above MA150        +5
```

### 🔔 **Auto Scanner (Cron)**

- **Schedule**: `0 10 * * 1-5` = 13:00 Israel, Mon-Fri
- **What**: Scans 500+ stocks, takes TOP 10
- **Sends to**:
  1. **Push Notifications** (browser/mobile) — free, needs opt-in
  2. **Discord Webhook** — free, user configures URL in Settings
- ⚠️ **Only works when deployed to Vercel** — NOT on localhost

### 📝 **User Preferences**

- **Language**: Hebrew (תמיד)
- **Trading Style**: Large Cap breakouts (S&P 500 + NASDAQ)
- **Patterns**: ATH / 52W / Gap & Go / Cup & Handle
- **Position**: LONG only (no shorts, no TP field)
- **Music**: Mute when testing in browser
- **UX**: Wants everything in one click, hates manual setup

### 🚀 **What's Next (User's Choice)**

- [ ] **Deploy to Vercel** ⭐ (biggest win — cron works, mobile access, 24/7)
- [ ] Trade Journal (log own trades, track success rate per setup)
- [ ] Discord webhook setup guide in Hebrew (step-by-step)

### ⚠️ **Do NOT Add**

Per user request:
- ❌ AI image analysis (costs money)
- ❌ Anthropic API integration
- ❌ Complex charts (TradingView does it better)
- ❌ Social features
- ❌ Anything that costs money

### 🐛 **Recent Bugs Fixed**

1. **Scanner returned 0 results** → yf.historical() didn't exist in v4 → switched to yf.chart()
2. **PSX flagged as breakout when 11% above ATH** → added fresh-breakout check (last 3 days only)
3. **Position calc showed $1800 for $1500 target** → formula fixed
4. **Gap Entry false positives** → rewrite: search all history + verify unfilled + price interaction
5. **Cup & Handle showed completed breakouts** → constrained handle 5-12% below lip + verify handleHigh < lip
6. **Prisma EPERM lock** → kill all node processes then regenerate

---

**Last Updated**: 2026-08-18 (after scanner fresh-breakout fix + Windows auto-start setup)  
**Next Session Should**: Deploy to Vercel OR add Trade Journal
