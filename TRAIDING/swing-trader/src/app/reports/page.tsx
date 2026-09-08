import { PageContainer, Eyebrow, Display } from "@/components/ui";
import ReportsClient from "@/components/reports/reports-client";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <PageContainer className="space-y-10">
      <section>
        <Eyebrow>Reports</Eyebrow>
        <Display className="mt-3">
          דוחות<br />
          <span className="trend-up-glow">ביצועים.</span>
        </Display>
        <p className="text-sm text-[var(--fg-dim)] mt-4 max-w-lg">
          לוח שנה חודשי של רווח והפסד יומי, סטטיסטיקות לחודש הנבחר, וסיכומי שבוע —
          הכל מהטריידים הסגורים ביומן.
        </p>
      </section>

      <ReportsClient />
    </PageContainer>
  );
}
