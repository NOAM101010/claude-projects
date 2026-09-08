"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select, EmptyState } from "@/components/ui";
import { Star, Trash2, ExternalLink, FolderPlus, Copy, Check, Plus, FolderOpen, Bell } from "lucide-react";
import AlertChecker from "@/components/alert-checker";

type Item = { id: string; symbol: string };
type Folder = { id: string; name: string; color: string | null; items: Item[] };
type Data = { folders: Folder[]; unfiled: Item[] };

type Alert = {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: "above" | "below";
  note: string | null;
  active: boolean;
  triggeredAt: string | null;
};

export default function WatchlistClient({ data }: { data: Data }) {
  const [newSymbol, setNewSymbol] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertForm, setAlertForm] = useState<string | null>(null);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertDir, setAlertDir] = useState<"above" | "below">("above");
  const [alertNote, setAlertNote] = useState("");
  const router = useRouter();

  async function loadAlerts() {
    try {
      const res = await fetch("/api/alerts");
      const json = await res.json();
      if (Array.isArray(json?.alerts)) setAlerts(json.alerts);
    } catch {
      /* דלג בשקט */
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  async function addSymbol(folderId?: string) {
    const s = newSymbol.trim().toUpperCase();
    if (!s) return;
    setLoading(true);
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: s, folderId: folderId ?? null }),
    });
    setNewSymbol("");
    setLoading(false);
    router.refresh();
  }

  async function removeSymbol(id: string) {
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  function openAlertForm(symbol: string) {
    setAlertForm((cur) => (cur === symbol ? null : symbol));
    setAlertPrice("");
    setAlertDir("above");
    setAlertNote("");
  }

  async function createAlert(symbol: string) {
    const price = parseFloat(alertPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol,
        targetPrice: price,
        direction: alertDir,
        note: alertNote.trim() || null,
      }),
    });
    setAlertForm(null);
    setAlertPrice("");
    setAlertNote("");
    setAlertDir("above");
    loadAlerts();
  }

  async function deleteAlert(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    loadAlerts();
  }

  async function createFolder() {
    const name = newFolder.trim();
    if (!name) return;
    await fetch("/api/watchlist/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewFolder("");
    setShowNewFolder(false);
    router.refresh();
  }

  async function deleteFolder(id: string) {
    if (!confirm("למחוק את התיקייה וכל המניות בתוכה?")) return;
    await fetch("/api/watchlist/folders", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  function copyToClipboard(symbols: string[], label: string) {
    const text = symbols.join(",");
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const activeAlerts = alerts.filter((a) => a.active && !a.triggeredAt);
  const triggeredAlerts = alerts.filter((a) => a.triggeredAt);

  function renderItems(items: Item[]) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1.5">
        {items.map((w, i) => (
          <div key={w.id}>
            <div className="glass rounded-xl px-4 py-3 row-hover flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <span className="mono text-[var(--muted)] font-bold text-xs w-5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <a
                  href={`https://www.tradingview.com/chart/?symbol=${w.symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 group"
                >
                  <span className="ticker text-lg group-hover:text-[var(--up)] transition-colors">
                    {w.symbol}
                  </span>
                  <ExternalLink className="w-3 h-3 text-[var(--muted)] group-hover:text-[var(--up)]" />
                </a>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openAlertForm(w.symbol)}
                  className="text-[var(--muted)] hover:text-[var(--warn)] transition-colors p-1"
                  title="התראת מחיר"
                >
                  <Bell className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeSymbol(w.id)}
                  className="text-[var(--muted)] hover:text-[var(--down)] transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {alertForm === w.symbol && (
              <div className="glass rounded-xl px-4 py-3 mt-1.5 flex flex-wrap items-center gap-2">
                <Select
                  value={alertDir}
                  onChange={(e) => setAlertDir(e.target.value as "above" | "below")}
                  className="w-auto py-2"
                >
                  <option value="above">מעל</option>
                  <option value="below">מתחת</option>
                </Select>
                <Input
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                  placeholder="מחיר יעד"
                  inputMode="decimal"
                  className="w-28 py-2"
                  onKeyDown={(e) => e.key === "Enter" && createAlert(w.symbol)}
                />
                <Input
                  value={alertNote}
                  onChange={(e) => setAlertNote(e.target.value)}
                  placeholder="הערה (אופציונלי)"
                  className="flex-1 min-w-[140px] py-2"
                  onKeyDown={(e) => e.key === "Enter" && createAlert(w.symbol)}
                />
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => createAlert(w.symbol)}
                  disabled={!alertPrice.trim()}
                >
                  צור התראה
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AlertChecker />

      <Card>
        <div className="flex gap-2">
          <Input
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="הוסף סימבול (AAPL, NVDA, MSFT...)"
            className="ticker text-lg flex-1"
            onKeyDown={(e) => e.key === "Enter" && addSymbol()}
          />
          <Button variant="accent" onClick={() => addSymbol()} disabled={loading || !newSymbol.trim()}>
            <Plus className="w-4 h-4" /> הוסף
          </Button>
        </div>
      </Card>

      {(activeAlerts.length > 0 || triggeredAlerts.length > 0) && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-[var(--warn)]" />
            <h3 className="text-base font-black">התראות מחיר</h3>
            <span className="text-[10px] text-[var(--muted)] mono">{activeAlerts.length}</span>
          </div>
          <div className="space-y-1.5">
            {activeAlerts.map((a) => (
              <div
                key={a.id}
                className="glass rounded-xl px-4 py-2.5 flex items-center justify-between gap-3"
              >
                <span className="text-sm">
                  <span className="ticker">{a.symbol}</span>{" "}
                  <span className="text-[var(--fg-dim)]">
                    {a.direction === "above" ? "מעל" : "מתחת"}
                  </span>{" "}
                  <span className="mono font-bold">${a.targetPrice}</span>
                  {a.note && <span className="text-[var(--muted)]"> · {a.note}</span>}
                </span>
                <button
                  onClick={() => deleteAlert(a.id)}
                  className="text-[var(--muted)] hover:text-[var(--down)] transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {triggeredAlerts.map((a) => (
              <div
                key={a.id}
                className="glass rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 opacity-50"
              >
                <span className="text-sm">
                  <Check className="w-3.5 h-3.5 text-[var(--up)] inline" />{" "}
                  <span className="ticker">{a.symbol}</span>{" "}
                  <span className="mono font-bold">${a.targetPrice}</span>
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {new Date(a.triggeredAt!).toLocaleDateString("he-IL")}
                  </span>
                </span>
                <button
                  onClick={() => deleteAlert(a.id)}
                  className="text-[var(--muted)] hover:text-[var(--down)] transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowNewFolder(!showNewFolder)}>
          <FolderPlus className="w-3.5 h-3.5" /> תיקייה חדשה
        </Button>
        {data.unfiled.length + data.folders.reduce((s, f) => s + f.items.length, 0) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const all = [
                ...data.unfiled.map((i) => i.symbol),
                ...data.folders.flatMap((f) => f.items.map((i) => i.symbol)),
              ];
              copyToClipboard([...new Set(all)], "all");
            }}
          >
            {copied === "all" ? <Check className="w-3.5 h-3.5 text-[var(--up)]" /> : <Copy className="w-3.5 h-3.5" />}
            {copied === "all" ? "הועתק!" : "העתק הכל ל-TradingView"}
          </Button>
        )}
      </div>

      {showNewFolder && (
        <Card className="p-4">
          <div className="flex gap-2">
            <Input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="שם התיקייה (למשל: ATH Breakouts)"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && createFolder()}
            />
            <Button variant="accent" size="sm" onClick={createFolder} disabled={!newFolder.trim()}>
              צור
            </Button>
          </div>
        </Card>
      )}

      {data.folders.map((folder) => (
        <Card key={folder.id} className="p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[var(--warn)]" />
              <h3 className="text-base font-black">{folder.name}</h3>
              <span className="text-[10px] text-[var(--muted)] mono">{folder.items.length}</span>
            </div>
            <div className="flex items-center gap-1">
              {folder.items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(folder.items.map((i) => i.symbol), folder.id)}
                >
                  {copied === folder.id ? (
                    <><Check className="w-3 h-3 text-[var(--up)]" /> הועתק!</>
                  ) : (
                    <><Copy className="w-3 h-3" /> העתק ל-TV</>
                  )}
                </Button>
              )}
              <button
                onClick={() => deleteFolder(folder.id)}
                className="text-[var(--muted)] hover:text-[var(--down)] transition-colors p-1.5"
                title="מחק תיקייה"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {folder.items.length > 0 ? renderItems(folder.items) : (
            <p className="text-xs text-[var(--muted)] text-center py-4">תיקייה ריקה</p>
          )}
        </Card>
      ))}

      {data.unfiled.length > 0 && (
        <div>
          {data.folders.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-[var(--muted)]" />
              <span className="text-sm font-bold text-[var(--muted)]">ללא תיקייה</span>
            </div>
          )}
          {renderItems(data.unfiled)}
        </div>
      )}

      {data.unfiled.length === 0 && data.folders.length === 0 && (
        <Card>
          <EmptyState
            eyebrow="ריק"
            title="רשימת המעקב ריקה"
            description="הוסף מניה למעלה, או הוסף מתוצאות הסורק."
          />
        </Card>
      )}
    </div>
  );
}
