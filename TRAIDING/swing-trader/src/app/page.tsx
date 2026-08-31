import { prisma } from "@/lib/prisma";
import { PageContainer, Eyebrow, Display, Card, Grade, LivePulse } from "@/components/ui";
import SectorHeatmap from "@/components/sector-heatmap";
import MarketIndices from "@/components/market-indices";
import { cn, formatPercent } from "@/lib/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import Link from "next/link";
import { ArrowLeft, Radar } from "lucide-react";

export const dynamic = "force-dynamic";

const SETUP_LABELS: Record<string, string> = {
  breakout_ath: "פריצת ATH",
  near_ath: "קרוב ל־ATH",
  breakout_52w: "פריצת 52W",
  near_52w: "קרוב ל־52W",
  gap_up: "Gap Up",
  gap_entry: "נכנס לגאפ",
  high_volume: "ווליום גבוה",
  cup_and_handle: "Cup & Handle",
};

export default async function HomePage() {
  const lastRun = await prisma.scannerRun.findFirst({
    orderBy: { startedAt: "desc" },
    where: { status: "success" },
  });

  const topResults = lastRun
    ? await prisma.scannerResult.findMany({
        where: { runId: lastRun.id },
        orderBy: [{ score: "desc" }],
        take: 5,
      })
    : [];

  const now = new Date();
  const hebrewDate = format(now, "EEEE, d בMMMM yyyy", { locale: he });

  return (
    <PageContainer className="space-y-10">
      <section>
        <Eyebrow>Market Overview · סקירת שוק</Eyebrow>
        <Display className="mt-3">
          בוקר טוב.<br />
          <span className="trend-up-glow">השוק מחכה.</span>
        </Display>
        <p className="text-sm text-[var(--fg-dim)] mt-3">{hebrewDate}</p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-black tracking-tight">מדדים</h2>
          <LivePulse />
        </div>
        <MarketIndices />
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-black tracking-tight">סקטורים</h2>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--muted)]">
            11 ETFs
          </span>
        </div>
        <SectorHeatmap />
      </section>

      {topResults.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-[var(--border)]">
            <div>
              <h2 className="text-lg font-black tracking-tight">סריקה אחרונה</h2>
              {lastRun && (
                <span className="text-[10px] text-[var(--muted)]">
                  {format(lastRun.startedAt, "dd/MM HH:mm")} · {lastRun.totalMatches} תוצאות
                </span>
              )}
            </div>
            <Link href="/scanner" className="text-xs text-[var(--up)] hover:underline flex items-center gap-1">
              לכל התוצאות <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {topResults.map((r, i) => {
              const setups = r.matchedSetups ? (JSON.parse(r.matchedSetups) as string[]) : [];
              const grade = r.grade ?? "?";
              return (
                <a
                  key={r.id}
                  href={`https://www.tradingview.com/chart/?symbol=${r.symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass rounded-2xl px-4 py-3 row-hover flex items-center gap-4"
                >
                  <span className="mono text-[var(--muted)] font-bold text-sm w-6">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="ticker text-lg min-w-[70px]">{r.symbol}</span>
                  <span className="text-xs text-[var(--fg-dim)] flex-1 hidden md:block">
                    {setups.map((s) => SETUP_LABELS[s] ?? s).join(" · ")}
                  </span>
                  <span className={cn(
                    "mono text-sm font-bold",
                    (r.changePercent ?? 0) >= 0 ? "trend-up" : "trend-down"
                  )}>
                    {formatPercent(r.changePercent)}
                  </span>
                  <Grade value={grade} size="sm" />
                </a>
              );
            })}
          </div>
        </section>
      )}

      {topResults.length === 0 && (
        <Card className="text-center py-12">
          <Radar className="w-10 h-10 text-[var(--up)] mx-auto mb-4" />
          <h3 className="text-xl font-black mb-2">עדיין לא הרצת סריקה</h3>
          <p className="text-sm text-[var(--fg-dim)] mb-4">
            לך לסורק והרץ סריקה ראשונה כדי לראות תוצאות כאן
          </p>
          <Link href="/scanner" className="inline-flex items-center gap-2 text-[var(--up)] hover:underline text-sm font-bold">
            לסורק <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </Card>
      )}
    </PageContainer>
  );
}
