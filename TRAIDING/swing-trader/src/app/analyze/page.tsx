import { PageContainer, Eyebrow, Display } from "@/components/ui";
import AnalyzeClient from "@/components/analyze-client";

export const dynamic = "force-dynamic";

export default function AnalyzePage() {
  return (
    <PageContainer className="space-y-8">
      <section>
        <Eyebrow>Analyze · ניתוח מניה</Eyebrow>
        <Display className="mt-3">
          שאל על<br /><span className="trend-up-glow">כל מניה.</span>
        </Display>
        <p className="text-sm text-[var(--fg-dim)] mt-4 max-w-lg">
          הזן סימבול וקבל ניתוח מיידי — האם המניה טובה לכניסה, לפי אילו קריטריונים, ובעיקר
          <span className="text-[var(--fg)] font-semibold"> למה כן או למה לא</span>. מבוסס על נתוני שוק
          אמיתיים וכללים טכניים (פריצה, מומנטום, מגמה, נפח). חינם לגמרי.
        </p>
      </section>

      <AnalyzeClient />
    </PageContainer>
  );
}
