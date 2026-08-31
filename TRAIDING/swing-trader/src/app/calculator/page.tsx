"use client";

import { useEffect, useState } from "react";
import { PageContainer, Eyebrow, Display, Card, Input, Label, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Calculator as CalcIcon, Wallet, Target, Save, ArrowLeftRight, TrendingUp } from "lucide-react";

const PRESET_KEY = "swing-trader:calc-preset";

function fmt(n: number, currency: "USD" | "ILS"): string {
  return n.toLocaleString("he-IL", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "ILS" ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg font-bold text-sm transition-colors",
        active
          ? "bg-[var(--up)]/20 border border-[var(--up)]/40 text-[var(--up)]"
          : "bg-white/5 border border-[var(--border)] text-[var(--fg-dim)] hover:bg-white/10"
      )}
    >
      {label}
    </button>
  );
}

export default function CalculatorPage() {
  const [tab, setTab] = useState<"position" | "pnl">("position");

  // Position Sizing State
  const [accountSize, setAccountSize] = useState("10000");
  const [positionAmount, setPositionAmount] = useState("");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");

  // P&L Calculator State
  const [pnlShares, setPnlShares] = useState("");
  const [pnlEntry, setPnlEntry] = useState("");
  const [pnlTarget, setPnlTarget] = useState("");
  const [pnlPercent, setPnlPercent] = useState("");

  // Common State
  const [currency, setCurrency] = useState<"USD" | "ILS">("USD");
  const [usdIls, setUsdIls] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.accountSize) setAccountSize(p.accountSize);
      }
    } catch {}
  }, []);

  useEffect(() => {
    async function fetchRate() {
      try {
        const res = await fetch("/api/quotes/usdils");
        const json = await res.json();
        if (json.ok && json.rate) setUsdIls(json.rate);
      } catch {}
    }
    fetchRate();
  }, []);

  const savePreset = () => {
    localStorage.setItem(PRESET_KEY, JSON.stringify({ accountSize }));
  };

  const rate = usdIls ?? 3.65;
  const sym = currency === "USD" ? "$" : "₪";

  // Position Sizing Logic
  const acc = parseFloat(accountSize) || 0;
  const posAmt = parseFloat(positionAmount) || 0;
  const e = parseFloat(entry) || 0;
  const s = parseFloat(stop) || 0;

  const accUsd = currency === "USD" ? acc : acc / rate;
  const posAmtUsd = currency === "USD" ? posAmt : posAmt / rate;

  const stopDistance = e && s ? Math.abs(e - s) : 0;
  const stopPct = e && s ? (stopDistance / e) * 100 : 0;
  const shares = e > 0 && posAmtUsd > 0 ? Math.floor(posAmtUsd / e) : 0;
  const actualPositionUsd = shares * e;
  const positionPct = accUsd > 0 ? (actualPositionUsd / accUsd) * 100 : 0;
  const maxLossUsd = shares * stopDistance;
  const riskPctOfAccount = accUsd > 0 ? (maxLossUsd / accUsd) * 100 : 0;

  const validStop = s > 0 && s < e;
  const readyToCalc = shares > 0 && validStop;

  // P&L Logic
  const pnlSharesNum = parseFloat(pnlShares) || 0;
  const pnlEntryNum = parseFloat(pnlEntry) || 0;
  const pnlTargetNum = parseFloat(pnlTarget) || 0;
  const pnlPercentNum = parseFloat(pnlPercent) || 0;

  const pnlMode = pnlTargetNum > 0 ? "target" : "percent";
  const exitPrice = pnlMode === "target" ? pnlTargetNum : pnlEntryNum * (1 + pnlPercentNum / 100);
  const pnlPerShare = exitPrice - pnlEntryNum;
  const totalPnlUsd = pnlPerShare * pnlSharesNum;
  const pnlPct = pnlEntryNum > 0 ? (pnlPerShare / pnlEntryNum) * 100 : 0;

  const readyPnl = pnlSharesNum > 0 && pnlEntryNum > 0 && (pnlTargetNum > 0 || pnlPercentNum !== 0);

  function toDisplay(usd: number): string {
    return fmt(currency === "USD" ? usd : usd * rate, currency);
  }

  function toggleCurrency() {
    const newCurrency = currency === "USD" ? "ILS" : "USD";
    const r = rate;
    if (acc) setAccountSize(String(Math.round(currency === "USD" ? acc * r : acc / r)));
    if (posAmt) setPositionAmount(String(Math.round(currency === "USD" ? posAmt * r : posAmt / r)));
    setCurrency(newCurrency);
  }

  return (
    <PageContainer className="space-y-10">
      <section>
        <Eyebrow>מחשבון עסקה · Position Sizing & P&L</Eyebrow>
        <Display className="mt-3">
          כמה מניות<br /><span className="trend-up-glow">לקנות?</span>
        </Display>
      </section>

      {/* Currency Toggle + Tabs */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex gap-2">
          <Tab label="Position Sizing" active={tab === "position"} onClick={() => setTab("position")} />
          <Tab label="P&L Calculator" active={tab === "pnl"} onClick={() => setTab("pnl")} />
        </div>
        <button
          onClick={toggleCurrency}
          className="glass rounded-full px-4 py-2 flex items-center gap-2 text-sm font-bold hover:bg-white/10 transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4" />
          {currency === "USD" ? "עבור לשקלים ₪" : "עבור לדולר $"}
        </button>
      </div>

      {usdIls && (
        <div className="text-xs text-[var(--muted)] mono text-center">
          $1 = ₪{usdIls.toFixed(2)}
        </div>
      )}

      {/* POSITION SIZING TAB */}
      {tab === "position" && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--info)]/10 border border-[var(--info)]/30 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-[var(--info)]" />
                </div>
                <div>
                  <h2 className="text-lg font-black">שלב 1 — החשבון שלי</h2>
                  <p className="text-xs text-[var(--muted)]">כמה שווה החשבון הכולל</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={savePreset}>
                <Save className="w-3.5 h-3.5" /> שמור
              </Button>
            </div>

            <div>
              <Label>שווי החשבון ({sym})</Label>
              <Input type="number" value={accountSize} onChange={(ev) => setAccountSize(ev.target.value)} className="mono text-lg" />
            </div>

            {currency === "ILS" && acc > 0 && (
              <div className="mt-2 text-xs text-[var(--muted)] mono">
                = ${(acc / rate).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--up)]/10 border border-[var(--up)]/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-[var(--up)]" />
              </div>
              <div>
                <h2 className="text-lg font-black">שלב 2 — גודל הפוזיציה</h2>
                <p className="text-xs text-[var(--muted)]">כמה כסף נכנס לעסקה הזו מתוך החשבון</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>סכום כניסה לפוזיציה ({sym})</Label>
                <Input
                  type="number"
                  value={positionAmount}
                  onChange={(ev) => setPositionAmount(ev.target.value)}
                  placeholder={currency === "USD" ? "5000" : "18000"}
                  className="mono text-lg"
                />
                {currency === "ILS" && posAmt > 0 && (
                  <div className="mt-2 text-xs text-[var(--muted)] mono">
                    = ${(posAmt / rate).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-end">
                {acc > 0 && posAmt > 0 && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-[var(--border)]">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)] font-bold">אחוז מהחשבון</div>
                    <div className="mono text-2xl font-black mt-1">
                      {((posAmt / acc) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--warn)]/10 border border-[var(--warn)]/30 flex items-center justify-center">
                <CalcIcon className="w-5 h-5 text-[var(--warn)]" />
              </div>
              <div>
                <h2 className="text-lg font-black">שלב 3 — מחירי כניסה וסטופ</h2>
                <p className="text-xs text-[var(--muted)]">תמיד בדולר (מחירי המניות)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>מחיר כניסה ($)</Label>
                <Input type="number" step="0.01" value={entry} onChange={(ev) => setEntry(ev.target.value)} placeholder="150.50" className="mono text-lg" />
              </div>
              <div>
                <Label>סטופ לוס ($)</Label>
                <Input
                  type="number" step="0.01" value={stop} onChange={(ev) => setStop(ev.target.value)}
                  placeholder="מתחת לכניסה"
                  className={cn("mono text-lg", stop && !validStop && "border-[var(--down)]/60")}
                />
                {stop && !validStop && (
                  <div className="text-[10px] text-[var(--down)] mt-1.5">
                    סטופ חייב להיות מתחת למחיר הכניסה
                  </div>
                )}
              </div>
            </div>

            {readyToCalc && (
              <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-[var(--border)] flex items-center justify-between">
                <span className="text-sm text-[var(--fg-dim)]">מרחק לסטופ</span>
                <span className="mono font-bold">${stopDistance.toFixed(2)} ({stopPct.toFixed(2)}%)</span>
              </div>
            )}
          </Card>

          {readyToCalc && (
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[var(--up)]/10 border border-[var(--up)]/30 flex items-center justify-center">
                  <CalcIcon className="w-5 h-5 text-[var(--up)]" />
                </div>
                <div>
                  <h2 className="text-lg font-black">התוצאות</h2>
                  <p className="text-xs text-[var(--muted)]">הנה מה שאתה צריך לדעת</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[var(--up)]/[0.06] border border-[var(--up)]/25 text-center mb-6">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] font-bold mb-2">כמות מניות לקנייה</div>
                <div className="mono text-6xl font-black text-[var(--up)]">
                  {shares.toLocaleString()}
                </div>
                <div className="text-sm text-[var(--fg-dim)] mt-2">מניות</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <ResultBox label="ערך פוזיציה בפועל" value={toDisplay(actualPositionUsd)} sub={currency === "ILS" ? `$${actualPositionUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : undefined} />
                <ResultBox label="אחוז מהחשבון" value={`${positionPct.toFixed(1)}%`} />
                <ResultBox label="מרחק לסטופ" value={`${stopPct.toFixed(2)}%`} />
                <ResultBox label="סיכון מהחשבון" value={`${riskPctOfAccount.toFixed(2)}%`} warn={riskPctOfAccount > 2} />
              </div>

              <div className="p-5 rounded-xl bg-[var(--down)]/[0.08] border border-[var(--down)]/25">
                <div className="text-[10px] uppercase tracking-wider text-[var(--down)] font-bold mb-1">הפסד מקסימלי (אם נפגע בסטופ)</div>
                <div className="mono text-3xl font-black trend-down">
                  {toDisplay(maxLossUsd)}
                </div>
                <div className="mono text-xs text-[var(--down)]/70 mt-1">
                  {riskPctOfAccount.toFixed(2)}% מהחשבון
                  {currency === "ILS" && ` · $${maxLossUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* P&L TAB */}
      {tab === "pnl" && (
        <>
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--info)]/10 border border-[var(--info)]/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-[var(--info)]" />
              </div>
              <div>
                <h2 className="text-lg font-black">פרטי העסקה</h2>
                <p className="text-xs text-[var(--muted)]">כמה מניות וב-איזה מחיר כנסת</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>מחיר כניסה ($)</Label>
                <Input type="number" step="0.01" value={pnlEntry} onChange={(ev) => setPnlEntry(ev.target.value)} placeholder="150.50" className="mono text-lg" />
              </div>
              <div>
                <Label>כמות מניות</Label>
                <Input type="number" value={pnlShares} onChange={(ev) => setPnlShares(ev.target.value)} placeholder="33" className="mono text-lg" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--up)]/10 border border-[var(--up)]/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[var(--up)]" />
              </div>
              <div>
                <h2 className="text-lg font-black">מחיר היעד</h2>
                <p className="text-xs text-[var(--muted)]">באיזה מחיר אתה רוצה לצאת, או כמה אחוז עלייה</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>מחיר יעד ($)</Label>
                <Input type="number" step="0.01" value={pnlTarget} onChange={(ev) => setPnlTarget(ev.target.value)} placeholder="175.00" className="mono text-lg" />
              </div>
              <div>
                <Label>או אחוז עלייה (%)</Label>
                <Input type="number" step="0.1" value={pnlPercent} onChange={(ev) => setPnlPercent(ev.target.value)} placeholder="15" className="mono text-lg" />
                <div className="text-[9px] text-[var(--muted)] mt-1">הקלד רק אחד משניים</div>
              </div>
            </div>
          </Card>

          {readyPnl && (
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[var(--up)]/10 border border-[var(--up)]/30 flex items-center justify-center">
                  <CalcIcon className="w-5 h-5 text-[var(--up)]" />
                </div>
                <div>
                  <h2 className="text-lg font-black">רווח / הפסד</h2>
                  <p className="text-xs text-[var(--muted)]">כמה תרוויח או תפסיד</p>
                </div>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border text-center mb-6",
                totalPnlUsd >= 0
                  ? "bg-[var(--up)]/[0.06] border-[var(--up)]/25"
                  : "bg-[var(--down)]/[0.06] border-[var(--down)]/25"
              )}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] font-bold mb-2">רווח/הפסד</div>
                <div className={cn("mono text-5xl font-black", totalPnlUsd >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
                  {toDisplay(Math.abs(totalPnlUsd))}
                </div>
                <div className={cn("text-sm mt-2", totalPnlUsd >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
                  {totalPnlUsd >= 0 ? "רווח" : "הפסד"} — {pnlPct.toFixed(2)}% לכל מניה
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <ResultBox label="מחיר היציאה" value={`$${exitPrice.toFixed(2)}`} />
                <ResultBox label="רווח לכל מניה" value={`$${pnlPerShare.toFixed(2)}`} />
                <ResultBox label="סך הרווח" value={toDisplay(totalPnlUsd)} />
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-[var(--border)] text-xs text-[var(--fg-dim)] leading-relaxed">
                <b>סיכום:</b> אם תקנה <span className="mono text-[var(--fg)] font-bold">{pnlSharesNum}</span> מניות
                ב־<span className="mono text-[var(--fg)] font-bold">${pnlEntryNum.toFixed(2)}</span> וְתַּמְכוּר
                ב־<span className="mono text-[var(--fg)] font-bold">${exitPrice.toFixed(2)}</span>,
                תרוויח <span className={cn("mono font-bold", totalPnlUsd >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
                  {toDisplay(totalPnlUsd)}
                </span> ({pnlPct.toFixed(2)}% לכל מניה).
              </div>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  );
}

function ResultBox({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={cn("p-3 rounded-xl border", warn ? "bg-[var(--down)]/[0.05] border-[var(--down)]/25" : "bg-white/[0.03] border-[var(--border)]")}>
      <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)] font-bold">{label}</div>
      <div className={cn("mono text-lg font-bold mt-1", warn && "text-[var(--down)]")}>{value}</div>
      {sub && <div className="mono text-[10px] text-[var(--muted)] mt-0.5">{sub}</div>}
    </div>
  );
}
